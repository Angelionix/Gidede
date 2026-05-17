"""
Gidede — Prompt Cache
Фаза 4.A.7 + 4.A.9: Кэширование результатов AI-промптов

Обновлено в 4.A.9: Использует RedisClient из app.core.redis_client
для унифицированного доступа к Redis с connection pooling,
автопереподключением и fallback на in-memory.

Стратегия (из спецификации 3.9.4.3):
- Ключ кэша = hash(system_prompt + context_prompt + task_prompt + inputs)
- Хранилище: RedisClient (основное) → in-memory dict (fallback)
- TTL: по спецификации для каждого промпта (из PROMPT_REGISTRY)

Кэшируемые промпты (cacheable=True в PROMPT_REGISTRY):
- CLASSIFY_GENRE: TTL 3600s (жанр не меняется)
- EXTRACT_AESTHETICS: TTL 1800s
- ESTIMATE_WEIGHTS: TTL 1800s
- APPLY_LENS_*: TTL 900s
- CHECK_PROGRESSION_AESTHETICS: TTL 900s
- И другие (см. registry.py для полного списка)

Некэшируемые промпты (cacheable=False):
- GENERATE_CORE_LOOPS, GENERATE_USP, и другие креативные
"""

import hashlib
import json
import logging
import time
from typing import Optional, Any

from app.prompts.registry import get_prompt_spec

logger = logging.getLogger(__name__)


class PromptCache:
    """
    Кэш промптов с поддержкой RedisClient (основное) и in-memory (fallback).

    Обновлено в 4.A.9: Интеграция с RedisClient из app.core.redis_client.
    Если RedisClient доступен — использует его для хранения.
    Иначе — fallback на in-memory dict.

    Ключ: gidede:prompt_cache:{prompt_id}:{hash}
    """

    KEY_PREFIX = "gidede:prompt_cache:"

    def __init__(self, redis_url: Optional[str] = None):
        self._redis_client = None
        self._redis_url = redis_url
        self._memory_cache: dict[str, tuple[Any, float]] = {}  # key -> (value, expires_at)
        self._initialized = False

    async def initialize(self):
        """Инициализация RedisClient (ленивая)."""
        if self._initialized:
            return

        try:
            from app.core.redis_client import get_redis_client
            self._redis_client = await get_redis_client()
            self._initialized = True
            logger.info("PromptCache: RedisClient подключён")
        except Exception as e:
            logger.warning(f"PromptCache: RedisClient недоступен, in-memory fallback — {e}")
            self._redis_client = None
            self._initialized = True

    def _compute_key(self, prompt_id: str, inputs: dict) -> str:
        """Вычисление ключа кэша."""
        # Сериализуем входные данные для стабильного хеша
        serialized = json.dumps(
            {"prompt_id": prompt_id, "inputs": inputs},
            sort_keys=True,
            ensure_ascii=False,
        )
        hash_val = hashlib.sha256(serialized.encode()).hexdigest()[:16]
        return f"{prompt_id}:{hash_val}"

    def is_cacheable(self, prompt_id: str) -> bool:
        """
        Можно ли кэшировать результат данного промпта.
        Использует данные из PROMPT_REGISTRY (4.A.8).
        """
        spec = get_prompt_spec(prompt_id)
        if spec:
            return spec.guarantees.cacheable
        # Fallback для неизвестных промптов — кэшируем по умолчанию
        return True

    def get_ttl(self, prompt_id: str) -> int:
        """
        Получить TTL для промпта (в секундах).
        Использует данные из PROMPT_REGISTRY (4.A.8).
        """
        spec = get_prompt_spec(prompt_id)
        if spec and spec.guarantees.cache_ttl is not None:
            return spec.guarantees.cache_ttl
        # По умолчанию 10 минут
        return 600

    async def get(self, prompt_id: str, inputs: dict) -> Optional[Any]:
        """Получить результат из кэша."""
        cache_key = self._compute_key(prompt_id, inputs)
        full_key = f"{self.KEY_PREFIX}{cache_key}"

        # Пробуем через RedisClient
        if self._redis_client and self._redis_client.is_available:
            try:
                result = await self._redis_client.get_cache(cache_key)
                if result is not None:
                    logger.debug(f"PromptCache: HIT (Redis) для {prompt_id}")
                    return result
            except Exception as e:
                logger.warning(f"PromptCache: ошибка Redis GET — {e}")

        # Fallback на in-memory
        if full_key in self._memory_cache:
            value, expires_at = self._memory_cache[full_key]
            if time.time() < expires_at:
                logger.debug(f"PromptCache: HIT (memory) для {prompt_id}")
                return value
            else:
                del self._memory_cache[full_key]

        return None

    async def set(
        self,
        prompt_id: str,
        inputs: dict,
        result: Any,
        ttl: Optional[int] = None,
    ) -> None:
        """Сохранить результат в кэш."""
        if not self.is_cacheable(prompt_id):
            return

        cache_key = self._compute_key(prompt_id, inputs)
        full_key = f"{self.KEY_PREFIX}{cache_key}"
        ttl = ttl or self.get_ttl(prompt_id)

        # Через RedisClient
        if self._redis_client and self._redis_client.is_available:
            try:
                await self._redis_client.set_cache(cache_key, result, ttl=ttl)
                logger.debug(f"PromptCache: SET (Redis) для {prompt_id}, TTL={ttl}s")
                return
            except Exception as e:
                logger.warning(f"PromptCache: ошибка Redis SET — {e}")

        # In-memory fallback
        self._memory_cache[full_key] = (result, time.time() + ttl)
        logger.debug(f"PromptCache: SET (memory) для {prompt_id}, TTL={ttl}s")

        # Очистка устаревших записей in-memory (раз в 100 записей)
        if len(self._memory_cache) > 100:
            self._cleanup_memory_cache()

    async def invalidate(self, prompt_id: str, inputs: dict) -> bool:
        """Инвалидация кэша для конкретного промпта."""
        cache_key = self._compute_key(prompt_id, inputs)
        full_key = f"{self.KEY_PREFIX}{cache_key}"
        deleted = False

        if self._redis_client and self._redis_client.is_available:
            try:
                deleted = await self._redis_client.delete_cache(cache_key)
            except Exception:
                pass

        if full_key in self._memory_cache:
            del self._memory_cache[full_key]
            deleted = True

        return deleted

    async def invalidate_project(self, project_id: str) -> int:
        """
        Инвалидация всего кэша, связанного с проектом.
        Вызывается при изменении Project State.
        """
        count = 0

        # Инвалидируем через Event Bus (уведомляем подписчиков)
        if self._redis_client and self._redis_client.is_available:
            try:
                await self._redis_client.publish_event(
                    project_id,
                    {"event": "cache_invalidated", "reason": "project_state_changed"},
                )
            except Exception:
                pass

        # In-memory: удаляем все ключи, содержащие project_id
        keys_to_delete = [
            k for k in self._memory_cache
            if project_id in k
        ]
        for k in keys_to_delete:
            del self._memory_cache[k]
            count += 1

        return count

    async def clear_all(self) -> int:
        """Очистка всего кэша."""
        count = 0

        if self._redis_client and self._redis_client.is_available:
            try:
                count = await self._redis_client.clear_cache()
            except Exception:
                pass

        mem_count = len(self._memory_cache)
        self._memory_cache.clear()
        count += mem_count

        return count

    def _cleanup_memory_cache(self):
        """Очистка устаревших записей in-memory кэша."""
        now = time.time()
        expired_keys = [k for k, (_, exp) in self._memory_cache.items() if now >= exp]
        for k in expired_keys:
            del self._memory_cache[k]
