"""
Gidede — Redis Client
Фаза 4.A.9: Кэш, сессии, Pub/Sub

Три функции Redis (из спецификации 3.9.4.3 + 3.10):
1. Кэш промптов — ключи gidede:prompt_cache:{hash}, TTL по спецификации 3.9
2. Сессии пользователей — ключи gidede:session:{user_id}, контекст текущего проекта
3. Event Bus — каналы gidede:events:{project_id}, уведомления об изменениях Project State

Дополнительно:
- Connection pooling (redis-py default pool)
- Автоматическое переподключение
- Health check
- Fallback на in-memory при недоступности Redis

Пример использования:
    redis = RedisClient(redis_url="redis://localhost:6379")
    await redis.initialize()

    # Кэш
    await redis.set_cache("CLASSIFY_GENRE:abc123", {"genre": "RPG"}, ttl=3600)
    result = await redis.get_cache("CLASSIFY_GENRE:abc123")

    # Сессии
    await redis.set_session("user123", {"project_id": "proj456", "current_block": 1})
    session = await redis.get_session("user123")

    # Pub/Sub
    await redis.publish_event("proj456", {"event": "concept_updated", "block": 1})
    await redis.subscribe("proj456", callback=my_callback)
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


# ============================================================
# KEY PREFIXES
# ============================================================

CACHE_PREFIX = "gidede:prompt_cache:"
SESSION_PREFIX = "gidede:session:"
EVENT_PREFIX = "gidede:events:"
RATE_LIMIT_PREFIX = "gidede:rate_limit:"
HEALTH_KEY = "gidede:health:ping"


# ============================================================
# REDIS CLIENT
# ============================================================

class RedisClient:
    """
    Единый клиент Redis для Gidede.

    Три функции:
    1. Кэш промптов — get_cache/set_cache с TTL
    2. Сессии пользователей — get_session/set_session
    3. Event Bus — publish_event/subscribe

    Фичи:
    - Connection pooling (встроен в redis-py)
    - Автоматическое переподключение
    - Fallback на in-memory при недоступности
    - Health check
    """

    def __init__(self, redis_url: str = "redis://localhost:6379"):
        """
        Args:
            redis_url: URL Redis сервера (redis://host:port/db)
        """
        self._redis_url = redis_url
        self._redis = None
        self._available = False

        # In-memory fallback
        self._memory_cache: dict[str, tuple[Any, float]] = {}  # key -> (value, expires_at)
        self._memory_sessions: dict[str, dict] = {}
        self._subscribers: dict[str, list[Callable]] = {}  # channel -> [callbacks]
        self._pubsub = None
        self._listener_task = None

    # ============================================================
    # ИНИЦИАЛИЗАЦИЯ И ЗДОРОВЬЕ
    # ============================================================

    async def initialize(self) -> bool:
        """
        Инициализация подключения к Redis.

        Returns:
            True если подключение успешно, False если используем in-memory fallback
        """
        try:
            import redis.asyncio as aioredis

            self._redis = aioredis.from_url(
                self._redis_url,
                decode_responses=True,
                max_connections=20,           # Connection pool size
                socket_timeout=5.0,           # Таймаут сокета
                socket_connect_timeout=5.0,   # Таймаут подключения
                retry_on_timeout=True,        # Автоповтор при таймауте
                health_check_interval=30,     # Проверка здоровья каждые 30 сек
            )

            # Проверка подключения
            await self._redis.ping()
            self._available = True
            logger.info(f"RedisClient: подключён к {self._redis_url}")

            # Запуск periodic health check
            asyncio.create_task(self._periodic_health_check())

            return True

        except ImportError:
            logger.warning("RedisClient: redis не установлен, используется in-memory fallback")
            self._available = False
            return False

        except Exception as e:
            logger.warning(f"RedisClient: ошибка подключения к Redis — {e}")
            self._available = False
            return False

    async def close(self):
        """Закрытие подключения к Redis."""
        if self._listener_task:
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass

        if self._pubsub:
            try:
                await self._pubsub.unsubscribe()
                await self._pubsub.close()
            except Exception:
                pass

        if self._redis:
            try:
                await self._redis.close()
            except Exception:
                pass

        self._available = False
        logger.info("RedisClient: подключение закрыто")

    async def _periodic_health_check(self):
        """Периодическая проверка здоровья Redis (каждые 30 секунд)."""
        while True:
            try:
                await asyncio.sleep(30)
                if self._redis:
                    await self._redis.ping()
                    self._available = True
            except Exception as e:
                logger.warning(f"RedisClient: health check failed — {e}")
                self._available = False

                # Попытка переподключения
                try:
                    await self._redis.close()
                except Exception:
                    pass

                try:
                    import redis.asyncio as aioredis
                    self._redis = aioredis.from_url(
                        self._redis_url,
                        decode_responses=True,
                        max_connections=20,
                        socket_timeout=5.0,
                        socket_connect_timeout=5.0,
                        retry_on_timeout=True,
                        health_check_interval=30,
                    )
                    await self._redis.ping()
                    self._available = True
                    logger.info("RedisClient: переподключение успешно")
                except Exception as re:
                    logger.warning(f"RedisClient: переподключение не удалось — {re}")

    @property
    def is_available(self) -> bool:
        """Доступен ли Redis."""
        return self._available

    async def health_check(self) -> dict:
        """Полная проверка здоровья Redis."""
        result = {
            "available": self._available,
            "backend": "redis" if self._available else "in-memory",
            "url": self._redis_url if self._available else "memory",
        }

        if self._available and self._redis:
            try:
                info = await self._redis.info()
                result.update({
                    "redis_version": info.get("redis_version", "unknown"),
                    "used_memory_human": info.get("used_memory_human", "unknown"),
                    "connected_clients": info.get("connected_clients", 0),
                    "keyscount": await self._redis.dbsize(),
                })
            except Exception as e:
                result["error"] = str(e)

        # In-memory статистика
        result["memory_cache_entries"] = len(self._memory_cache)
        result["memory_session_entries"] = len(self._memory_sessions)

        return result

    # ============================================================
    # 1. КЭШ ПРОМПТОВ
    # ============================================================

    async def get_cache(self, key: str) -> Optional[Any]:
        """
        Получить значение из кэша.

        Args:
            key: Полный ключ кэша (с префиксом)

        Returns:
            Распарсенное значение или None
        """
        full_key = f"{CACHE_PREFIX}{key}" if not key.startswith(CACHE_PREFIX) else key

        # Пробуем Redis
        if self._available and self._redis:
            try:
                cached = await self._redis.get(full_key)
                if cached:
                    return json.loads(cached)
            except Exception as e:
                logger.warning(f"RedisClient: ошибка GET кэша — {e}")

        # Fallback на in-memory
        if full_key in self._memory_cache:
            value, expires_at = self._memory_cache[full_key]
            if time.time() < expires_at:
                return value
            else:
                del self._memory_cache[full_key]

        return None

    async def set_cache(
        self,
        key: str,
        value: Any,
        ttl: int = 600,
    ) -> bool:
        """
        Сохранить значение в кэш.

        Args:
            key: Полный ключ кэша (с префиксом)
            value: Значение для кэширования
            ttl: Время жизни в секундах (по умолчанию 10 мин)

        Returns:
            True если успешно
        """
        full_key = f"{CACHE_PREFIX}{key}" if not key.startswith(CACHE_PREFIX) else key

        # Redis
        if self._available and self._redis:
            try:
                await self._redis.setex(
                    full_key,
                    ttl,
                    json.dumps(value, ensure_ascii=False),
                )
                return True
            except Exception as e:
                logger.warning(f"RedisClient: ошибка SET кэша — {e}")

        # In-memory fallback
        self._memory_cache[full_key] = (value, time.time() + ttl)

        # Очистка устаревших записей (раз в 100 добавлений)
        if len(self._memory_cache) % 100 == 0:
            self._cleanup_memory_cache()

        return True

    async def delete_cache(self, key: str) -> bool:
        """Удалить значение из кэша."""
        full_key = f"{CACHE_PREFIX}{key}" if not key.startswith(CACHE_PREFIX) else key
        deleted = False

        if self._available and self._redis:
            try:
                deleted = await self._redis.delete(full_key) > 0
            except Exception:
                pass

        if full_key in self._memory_cache:
            del self._memory_cache[full_key]
            deleted = True

        return deleted

    async def clear_cache(self) -> int:
        """Очистить весь кэш промптов."""
        count = 0

        if self._available and self._redis:
            try:
                keys = await self._redis.keys(f"{CACHE_PREFIX}*")
                if keys:
                    count = await self._redis.delete(*keys)
            except Exception:
                pass

        mem_count = len([k for k in self._memory_cache if k.startswith(CACHE_PREFIX)])
        for k in list(self._memory_cache.keys()):
            if k.startswith(CACHE_PREFIX):
                del self._memory_cache[k]
        count += mem_count

        return count

    # ============================================================
    # 2. СЕССИИ ПОЛЬЗОВАТЕЛЕЙ
    # ============================================================

    async def get_session(self, user_id: str) -> Optional[dict]:
        """
        Получить сессию пользователя.

        Сессия содержит:
        - project_id: текущий активный проект
        - current_block: текущий блок (1-8)
        - last_activity: timestamp последней активности
        - preferences: настройки пользователя (тема, язык, и т.д.)
        """
        key = f"{SESSION_PREFIX}{user_id}"

        # Redis
        if self._available and self._redis:
            try:
                data = await self._redis.get(key)
                if data:
                    return json.loads(data)
            except Exception as e:
                logger.warning(f"RedisClient: ошибка GET сессии — {e}")

        # In-memory
        return self._memory_sessions.get(user_id)

    async def set_session(
        self,
        user_id: str,
        session_data: dict,
        ttl: int = 86400,  # 24 часа по умолчанию
    ) -> bool:
        """
        Сохранить сессию пользователя.

        Args:
            user_id: ID пользователя
            session_data: Данные сессии
            ttl: Время жизни (по умолчанию 24 часа)
        """
        key = f"{SESSION_PREFIX}{user_id}"

        # Обновляем last_activity
        session_data["last_activity"] = time.time()

        # Redis
        if self._available and self._redis:
            try:
                await self._redis.setex(
                    key,
                    ttl,
                    json.dumps(session_data, ensure_ascii=False),
                )
                return True
            except Exception as e:
                logger.warning(f"RedisClient: ошибка SET сессии — {e}")

        # In-memory
        self._memory_sessions[user_id] = session_data
        return True

    async def update_session(
        self,
        user_id: str,
        updates: dict,
    ) -> bool:
        """
        Обновить отдельные поля сессии.

        Args:
            user_id: ID пользователя
            updates: Поля для обновления
        """
        session = await self.get_session(user_id)
        if session is None:
            session = {}

        session.update(updates)
        return await self.set_session(user_id, session)

    async def delete_session(self, user_id: str) -> bool:
        """Удалить сессию пользователя (logout)."""
        key = f"{SESSION_PREFIX}{user_id}"
        deleted = False

        if self._available and self._redis:
            try:
                deleted = await self._redis.delete(key) > 0
            except Exception:
                pass

        if user_id in self._memory_sessions:
            del self._memory_sessions[user_id]
            deleted = True

        return deleted

    # ============================================================
    # 3. EVENT BUS (Pub/Sub)
    # ============================================================

    async def publish_event(
        self,
        project_id: str,
        event_data: dict,
    ) -> bool:
        """
        Опубликовать событие об изменении Project State.

        Канал: gidede:events:{project_id}
        События используются для:
        - Уведомления зависимых блоков об обновлении данных
        - Обновления UI в реальном времени (через WebSocket)
        - Логирования изменений

        Типы событий:
        - concept_updated: Блок 1 обновлён
        - core_loop_updated: Блок 2 обновлён
        - mda_updated: Блок 3 обновлён
        - balance_updated: Блок 4 обновлён
        - progression_updated: Блок 5 обновлён
        - economy_updated: Блок 5 обновлён
        - gdd_updated: Блок 6 обновлён
        - validation_completed: Валидация завершена

        Args:
            project_id: ID проекта
            event_data: Данные события (event type + payload)

        Returns:
            True если опубликовано успешно
        """
        channel = f"{EVENT_PREFIX}{project_id}"

        # Добавляем timestamp
        event_data["timestamp"] = time.time()

        message = json.dumps(event_data, ensure_ascii=False)

        # Redis Pub/Sub
        if self._available and self._redis:
            try:
                receivers = await self._redis.publish(channel, message)
                logger.debug(f"Event published to {channel}, {receivers} receivers")
                return True
            except Exception as e:
                logger.warning(f"RedisClient: ошибка PUBLISH — {e}")

        # In-memory: вызываем локальные подписчики
        if channel in self._subscribers:
            for callback in self._subscribers[channel]:
                try:
                    if asyncio.iscoroutinefunction(callback):
                        await callback(event_data)
                    else:
                        callback(event_data)
                except Exception as e:
                    logger.warning(f"RedisClient: ошибка в callback подписчика — {e}")

        return True

    async def subscribe(
        self,
        project_id: str,
        callback: Callable[[dict], Any],
    ) -> bool:
        """
        Подписаться на события проекта.

        Args:
            project_id: ID проекта
            callback: Функция-обработчик события (sync или async)

        Returns:
            True если подписка успешна
        """
        channel = f"{EVENT_PREFIX}{project_id}"

        # Добавляем в локальные подписчики
        if channel not in self._subscribers:
            self._subscribers[channel] = []
        self._subscribers[channel].append(callback)

        # Redis Pub/Sub
        if self._available and self._redis:
            try:
                if not self._pubsub:
                    self._pubsub = self._redis.pubsub()
                    # Запускаем listener
                    self._listener_task = asyncio.create_task(self._pubsub_listener())

                await self._pubsub.subscribe(channel)
                logger.info(f"RedisClient: подписка на {channel}")
                return True
            except Exception as e:
                logger.warning(f"RedisClient: ошибка SUBSCRIBE — {e}")

        return True

    async def unsubscribe(
        self,
        project_id: str,
        callback: Optional[Callable] = None,
    ) -> bool:
        """
        Отписаться от событий проекта.

        Args:
            project_id: ID проекта
            callback: Конкретный callback (None = отписать все)
        """
        channel = f"{EVENT_PREFIX}{project_id}"

        # Удаляем из локальных подписчиков
        if channel in self._subscribers:
            if callback:
                self._subscribers[channel] = [
                    cb for cb in self._subscribers[channel] if cb != callback
                ]
            else:
                del self._subscribers[channel]

        # Redis
        if self._available and self._redis and self._pubsub:
            try:
                await self._pubsub.unsubscribe(channel)
            except Exception:
                pass

        return True

    async def _pubsub_listener(self):
        """Слушатель Redis Pub/Sub — перенаправляет сообщения локальным подписчикам."""
        while True:
            try:
                message = await self._pubsub.get_message(
                    ignore_subscribe_messages=True,
                    timeout=1.0,
                )
                if message and message["type"] == "message":
                    channel = message["channel"]
                    data = json.loads(message["data"])

                    # Вызываем локальных подписчиков
                    if channel in self._subscribers:
                        for callback in self._subscribers[channel]:
                            try:
                                if asyncio.iscoroutinefunction(callback):
                                    await callback(data)
                                else:
                                    callback(data)
                            except Exception as e:
                                logger.warning(f"Ошибка в Pub/Sub callback: {e}")

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"Ошибка Pub/Sub listener: {e}")
                await asyncio.sleep(1)

    # ============================================================
    # 4. RATE LIMITING (дополнительно)
    # ============================================================

    async def check_rate_limit(
        self,
        user_id: str,
        action: str = "ai_call",
        limit: int = 50,
        window: int = 86400,  # 24 часа
    ) -> dict:
        """
        Проверить лимит действий для пользователя.

        Args:
            user_id: ID пользователя
            action: Тип действия (ai_call, export, и т.д.)
            limit: Максимум действий за window
            window: Окно в секундах

        Returns:
            {"allowed": bool, "remaining": int, "reset_at": float}
        """
        key = f"{RATE_LIMIT_PREFIX}{action}:{user_id}"

        if self._available and self._redis:
            try:
                # Sliding window counter
                current = await self._redis.get(key)
                current_count = int(current) if current else 0

                if current_count >= limit:
                    ttl = await self._redis.ttl(key)
                    return {
                        "allowed": False,
                        "remaining": 0,
                        "reset_at": time.time() + max(ttl, 0),
                        "limit": limit,
                    }

                # Increment
                pipe = self._redis.pipeline()
                pipe.incr(key)
                pipe.expire(key, window)
                results = await pipe.execute()

                return {
                    "allowed": True,
                    "remaining": limit - results[0],
                    "reset_at": time.time() + window,
                    "limit": limit,
                }

            except Exception as e:
                logger.warning(f"RedisClient: ошибка rate limit — {e}")

        # Fallback: без лимитов в in-memory режиме
        return {
            "allowed": True,
            "remaining": limit,
            "reset_at": time.time() + window,
            "limit": limit,
        }

    # ============================================================
    # UTILITY
    # ============================================================

    def _cleanup_memory_cache(self):
        """Очистка устаревших записей in-memory кэша."""
        now = time.time()
        expired_keys = [k for k, (_, exp) in self._memory_cache.items() if now >= exp]
        for k in expired_keys:
            del self._memory_cache[k]

        if expired_keys:
            logger.debug(f"RedisClient: очищено {len(expired_keys)} устаревших записей кэша")


# ============================================================
# SINGLETON
# ============================================================

_redis_client: Optional[RedisClient] = None


async def get_redis_client() -> RedisClient:
    """
    Получить singleton RedisClient.

    Инициализирует при первом вызове.
    """
    global _redis_client
    if _redis_client is None:
        from app.core.config import settings
        _redis_client = RedisClient(redis_url=settings.REDIS_URL)
        await _redis_client.initialize()
    return _redis_client


async def close_redis_client():
    """Закрыть singleton RedisClient."""
    global _redis_client
    if _redis_client:
        await _redis_client.close()
        _redis_client = None
