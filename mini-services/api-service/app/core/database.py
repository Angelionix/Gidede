"""
Gidede — Настройка подключения к БД (SQLAlchemy + AsyncPG/Aiosqlite)
Фаза 4.A.4: Схема PostgreSQL (Project State)
Фаза 4.A.10: pgvector для RAG (эмбеддинги)
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
import os
import logging

logger = logging.getLogger(__name__)


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
}

# Специфичные настройки для SQLite
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

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
    """Зависимость FastAPI для получения сессии БД."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


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
