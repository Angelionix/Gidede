"""
Gidede — Настройка подключения к БД (SQLAlchemy + AsyncPG/Aiosqlite)
Фаза 4.A.4: Схема PostgreSQL (Project State)
Фаза 4.A.10: pgvector для RAG (эмбеддинги)
Фаза 4.E.4: Connection loss recovery с auto-reconnect
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
from sqlalchemy.exc import OperationalError, DisconnectionError
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)


# ============================================================
# Connection Recovery Configuration (4.E.4)
# ============================================================

# Maximum number of reconnection attempts
MAX_RECONNECT_ATTEMPTS = 3
# Base delay between reconnection attempts (in seconds)
RECONNECT_BASE_DELAY = 1.0
# Maximum reconnection delay (in seconds)
RECONNECT_MAX_DELAY = 10.0
# Connection pool recycle time (in seconds) — prevent stale connections
POOL_RECYCLE_SECONDS = 1800  # 30 minutes
# Connection pool pre-ping — verify connections before use
POOL_PRE_PING = True


def get_database_url() -> str:
    """
    Получить URL БД из окружения с автоматической конвертацией для async драйвера.

    Поддерживаемые форматы DATABASE_URL:
    - Пустое значение → SQLite для локальной разработки
    - postgresql://user:pass@host:port/db → postgresql+asyncpg://...
    - postgres://user:pass@host:port/db → postgresql+asyncpg://...
    - sqlite+aiosqlite:///path → как есть
    - file:/path → конвертация в sqlite+aiosqlite:///path
    """
    url = os.getenv("DATABASE_URL", "")
    if not url:
        # Fallback для локальной разработки (SQLite)
        return "sqlite+aiosqlite:///./gidede_dev.db"

    # Конвертация Prisma-style file: URL в SQLite
    if url.startswith("file:"):
        path = url[5:]  # Убираем "file:"
        return f"sqlite+aiosqlite:///{path}"

    # Уже правильный SQLite URL
    if url.startswith("sqlite"):
        if "+" not in url:
            # sqlite:/// → sqlite+aiosqlite:///
            url = url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
        return url

    # Конвертация postgresql:// → postgresql+asyncpg://
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)

    return url


DATABASE_URL = get_database_url()

# Настройка engine
engine_kwargs = {
    "echo": os.getenv("SQL_ECHO", "false").lower() == "true",
    # 4.E.4: Connection pool settings for resilience
    "pool_pre_ping": POOL_PRE_PING,            # Verify connections before use
    "pool_recycle": POOL_RECYCLE_SECONDS,      # Recycle stale connections
    "pool_size": 5,                            # Base pool size
    "max_overflow": 10,                        # Extra connections under load
}

# Специфичные настройки для SQLite
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
    # SQLite не поддерживает pool_pre_ping и pool_recycle
    engine_kwargs.pop("pool_pre_ping", None)
    engine_kwargs.pop("pool_recycle", None)
    engine_kwargs.pop("pool_size", None)
    engine_kwargs.pop("max_overflow", None)

engine = create_async_engine(DATABASE_URL, **engine_kwargs)

# Фабрика сессий
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Базовый класс для всех ORM-моделей."""
    pass


async def get_db() -> AsyncSession:
    """
    Зависимость FastAPI для получения сессии БД.
    4.E.4: Добавлена обработка потери подключения с авто-переподключением.
    """
    last_error = None

    for attempt in range(MAX_RECONNECT_ATTEMPTS):
        try:
            async with async_session() as session:
                try:
                    yield session
                    await session.commit()
                    return
                except (OperationalError, DisconnectionError) as db_err:
                    # Потеря подключения — пробуем переподключиться
                    await session.rollback()
                    last_error = db_err
                    logger.warning(
                        f"DB connection lost (attempt {attempt + 1}/{MAX_RECONNECT_ATTEMPTS}): {db_err}"
                    )
                    break  # Exit yield context, try reconnect
                except Exception:
                    await session.rollback()
                    raise
                finally:
                    await session.close()
        except (OperationalError, DisconnectionError) as db_err:
            last_error = db_err
            logger.warning(
                f"DB session creation failed (attempt {attempt + 1}/{MAX_RECONNECT_ATTEMPTS}): {db_err}"
            )

        # Exponential backoff before reconnect
        if attempt < MAX_RECONNECT_ATTEMPTS - 1:
            import asyncio
            delay = min(RECONNECT_BASE_DELAY * (2 ** attempt), RECONNECT_MAX_DELAY)
            logger.info(f"Reconnecting to DB in {delay:.1f}s...")
            await asyncio.sleep(delay)

    # All reconnection attempts failed
    logger.error(f"DB connection failed after {MAX_RECONNECT_ATTEMPTS} attempts: {last_error}")
    if last_error:
        raise last_error
    raise OperationalError("DB connection failed", params=None, orig=Exception("Unknown error"))


async def init_db():
    """Инициализация БД — создание таблиц (для dev без Alembic) + включение pgvector."""
    async with engine.begin() as conn:
        # Включить расширение pgvector (только для PostgreSQL)
        if not DATABASE_URL.startswith("sqlite"):
            try:
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
                logger.info("pgvector extension enabled")
            except Exception as e:
                logger.warning(f"Could not enable pgvector extension: {e}")
        await conn.run_sync(Base.metadata.create_all)


async def close_db():
    """Закрытие подключения к БД."""
    await engine.dispose()


# ============================================================
# 4.E.4: Project State Cache with Redis (graceful degradation)
# ============================================================

# In-memory cache for Project State when Redis unavailable
_project_state_cache: dict[str, tuple[dict, float]] = {}  # project_id -> (state, expires_at)
_PROJECT_STATE_CACHE_TTL = 300  # 5 minutes


async def get_cached_project_state(project_id: str) -> Optional[dict]:
    """
    Получить Project State из кэша (Redis или in-memory).
    4.E.3: Кэширование часто используемых данных Project State.
    4.E.4: Graceful degradation при недоступности Redis.
    """
    import time as _time

    # Try Redis first
    try:
        from app.core.redis_client import get_redis_client
        redis = await get_redis_client()
        if redis.is_available:
            cached = await redis.get_cache(f"project_state:{project_id}")
            if cached is not None:
                logger.debug(f"Project State cache HIT (Redis) for {project_id}")
                return cached
    except Exception as e:
        logger.debug(f"Redis unavailable for project state cache: {e}")

    # Fallback to in-memory
    if project_id in _project_state_cache:
        state, expires_at = _project_state_cache[project_id]
        if _time.time() < expires_at:
            logger.debug(f"Project State cache HIT (memory) for {project_id}")
            return state
        else:
            del _project_state_cache[project_id]

    return None


async def set_cached_project_state(project_id: str, state: dict, ttl: int = _PROJECT_STATE_CACHE_TTL) -> bool:
    """
    Сохранить Project State в кэш (Redis + in-memory).
    4.E.3: Кэширование часто используемых данных Project State.
    4.E.4: Graceful degradation при недоступности Redis.
    """
    import time as _time

    # Try Redis first
    try:
        from app.core.redis_client import get_redis_client
        redis = await get_redis_client()
        if redis.is_available:
            await redis.set_cache(f"project_state:{project_id}", state, ttl=ttl)
    except Exception as e:
        logger.debug(f"Redis unavailable for project state cache write: {e}")

    # Always store in-memory as backup
    _project_state_cache[project_id] = (state, _time.time() + ttl)

    # Cleanup old entries (every 100 writes)
    if len(_project_state_cache) % 100 == 0:
        now = _time.time()
        expired = [k for k, (_, exp) in _project_state_cache.items() if now >= exp]
        for k in expired:
            del _project_state_cache[k]

    return True


async def invalidate_cached_project_state(project_id: str) -> bool:
    """
    Инвалидировать кэш Project State (при обновлении данных).
    """
    # Redis
    try:
        from app.core.redis_client import get_redis_client
        redis = await get_redis_client()
        if redis.is_available:
            await redis.delete_cache(f"project_state:{project_id}")
    except Exception:
        pass

    # In-memory
    if project_id in _project_state_cache:
        del _project_state_cache[project_id]

    return True
