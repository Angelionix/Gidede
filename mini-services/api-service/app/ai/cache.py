"""
Gidede — Prompt Cache
Фаза 4.A.7: Кэширование результатов AI-промптов

Стратегия (из спецификации 3.9.4.3):
- Ключ кэша = hash(system_prompt + context_prompt + task_prompt + inputs)
- Хранилище: Redis (основное) → in-memory dict (fallback)
- TTL: по спецификации для каждого промпта

Кэшируемые промпты:
- CLASSIFY_GENRE: TTL 3600s (жанр не меняется)
- EXTRACT_AESTHETICS: TTL 1800s
- ESTIMATE_WEIGHTS: TTL 1800s
- APPLY_LENS_*: TTL 900s

Некэшируемые промпты:
- GENERATE_CORE_LOOPS, GENERATE_USP, и другие креативные
"""

import hashlib
import json
import logging
import time
from typing import Optional, Any

logger = logging.getLogger(__name__)

# TTL для кэшируемых промптов (из спецификации 3.9.4.3)
CACHE_TTL_RULES: dict[str, int] = {
    "CLASSIFY_GENRE": 3600,                # 1 час — жанр не меняется
    "EXTRACT_AESTHETICS": 1800,             # 30 мин — эстетика стабильна
    "ESTIMATE_WEIGHTS": 1800,               # 30 мин
    "EVALUATE_SITUATIONAL_VALUE": 1800,     # 30 мин
    "CHECK_PROGRESSION_AESTHETICS": 900,    # 15 мин
    "APPLY_LENS_MDA": 900,                  # 15 мин
    "APPLY_LENS_VAL": 900,                  # 15 мин
}

# Промпты, которые НЕ кэшируются (креативные)
NON_CACHEABLE = {
    "GENERATE_CORE_LOOPS",
    "GENERATE_USP",
    "GENERATE_OUTER_LOOPS",
    "GENERATE_META_LOOP",
    "SUGGEST_DYNAMICS",
    "SUGGEST_MECHANICS",
    "SIMULATE_GAMEPLAY",
    "SUGGEST_INTRANSITIVE_CORRECTIONS",
    "GENERATE_CHARACTERS_SECTION",
    "GENERATE_VISUAL_STYLE",
    "ENRICH_SECTION",
}


class PromptCache:
    """
    Кэш промптов с поддержкой Redis (основное) и in-memory (fallback).

    Ключ: gidede:prompt_cache:{hash}
    """

    KEY_PREFIX = "gidede:prompt_cache:"

    def __init__(self, redis_url: Optional[str] = None):
        self._redis = None
        self._memory_cache: dict[str, tuple[Any, float]] = {}  # key -> (value, expires_at)
        self._redis_url = redis_url

        # Пробуем подключить Redis
        if redis_url:
            self._init_redis(redis_url)

    def _init_redis(self, redis_url: str):
        """Инициализация Redis-подключения."""
        try:
            import redis.asyncio as aioredis
            self._redis = aioredis.from_url(redis_url, decode_responses=True)
            logger.info(f"PromptCache: Redis подключён ({redis_url})")
        except ImportError:
            logger.warning("PromptCache: redis не установлен, используется in-memory cache")
            self._redis = None
        except Exception as e:
            logger.warning(f"PromptCache: ошибка подключения Redis — {e}")
            self._redis = None

    def _compute_key(self, prompt_id: str, inputs: dict) -> str:
        """Вычисление ключа кэша."""
        # Сериализуем входные данные для стабильного хеша
        serialized = json.dumps(
            {"prompt_id": prompt_id, "inputs": inputs},
            sort_keys=True,
            ensure_ascii=False,
        )
        hash_val = hashlib.sha256(serialized.encode()).hexdigest()[:16]
        return f"{self.KEY_PREFIX}{prompt_id}:{hash_val}"

    def is_cacheable(self, prompt_id: str) -> bool:
        """Можно ли кэшировать результат данного промпта."""
        return prompt_id not in NON_CACHEABLE

    def get_ttl(self, prompt_id: str) -> int:
        """Получить TTL для промпта (в секундах)."""
        return CACHE_TTL_RULES.get(prompt_id, 600)  # По умолчанию 10 минут

    async def get(self, prompt_id: str, inputs: dict) -> Optional[Any]:
        """Получить результат из кэша."""
        key = self._compute_key(prompt_id, inputs)

        # Пробуем Redis
        if self._redis:
            try:
                cached = await self._redis.get(key)
                if cached:
                    logger.debug(f"PromptCache: HIT (Redis) для {prompt_id}")
                    return json.loads(cached)
            except Exception as e:
                logger.warning(f"PromptCache: ошибка Redis GET — {e}")

        # Fallback на in-memory
        if key in self._memory_cache:
            value, expires_at = self._memory_cache[key]
            if time.time() < expires_at:
                logger.debug(f"PromptCache: HIT (memory) для {prompt_id}")
                return value
            else:
                del self._memory_cache[key]

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

        key = self._compute_key(prompt_id, inputs)
        ttl = ttl or self.get_ttl(prompt_id)

        # Redis
        if self._redis:
            try:
                await self._redis.setex(key, ttl, json.dumps(result, ensure_ascii=False))
                logger.debug(f"PromptCache: SET (Redis) для {prompt_id}, TTL={ttl}s")
                return
            except Exception as e:
                logger.warning(f"PromptCache: ошибка Redis SET — {e}")

        # In-memory fallback
        self._memory_cache[key] = (result, time.time() + ttl)
        logger.debug(f"PromptCache: SET (memory) для {prompt_id}, TTL={ttl}s")

        # Очистка устаревших записей in-memory (раз в 100 записей)
        if len(self._memory_cache) > 100:
            self._cleanup_memory_cache()

    async def invalidate(self, prompt_id: str, inputs: dict) -> bool:
        """Инвалидация кэша для конкретного промпта."""
        key = self._compute_key(prompt_id, inputs)
        deleted = False

        if self._redis:
            try:
                deleted = await self._redis.delete(key) > 0
            except Exception:
                pass

        if key in self._memory_cache:
            del self._memory_cache[key]
            deleted = True

        return deleted

    async def clear_all(self) -> int:
        """Очистка всего кэша."""
        count = 0

        if self._redis:
            try:
                keys = await self._redis.keys(f"{self.KEY_PREFIX}*")
                if keys:
                    count = await self._redis.delete(*keys)
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
