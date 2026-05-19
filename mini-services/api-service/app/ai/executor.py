"""
Gidede — Prompt Executor
Фаза 4.A.7: Ядро AI-интеграции
Фаза 4.A.10: RAG-интеграция (обогащение промптов контекстом из базы знаний)
Фаза 4.E.3: Batch/parallel execution, performance optimization
Фаза 4.E.4: Timeout handling, exponential backoff retry

Единый интерфейс вызова AI-промптов с:
- Трёхслойной архитектурой (System + Context + Task)
- RAG-обогащением контекста (Библия геймдизайна + книги)
- Автоматической маршрутизацией
- Кэшированием
- Fallback-цепочками
- Валидацией выхода
- Логированием каждого вызова
- Таймауты: 30s для Sonnet-level, 15s для Haiku-level
- Экспоненциальный backoff при ошибках (макс. 3 попытки)
- Batch/parallel выполнение через asyncio.gather

Интерфейс (из спецификации 3.9.6):
    executor = PromptExecutor(providers, cache, router, validator)
    result = await executor.execute("CLASSIFY_GENRE", {"idea": "..."})
    results = await executor.execute_batch([
        ("CLASSIFY_GENRE", {"idea": "..."}),
        ("EXTRACT_AESTHETICS", {"idea": "...", "genre": "rpg"}),
    ])
"""

import asyncio
import time
import uuid
import logging
from dataclasses import dataclass, field
from typing import Any, Optional

from app.ai.providers.base import AIProvider, AIResponse
from app.ai.router import PromptRouter, RouteResult
from app.ai.cache import PromptCache
from app.ai.validator import PromptValidator, ValidationResult

logger = logging.getLogger(__name__)


# ============================================================
# Data classes
# ============================================================

# ============================================================
# Timeout configuration (4.E.4)
# ============================================================

# Sonnet-level models: generation/analysis — 30s timeout
SONNET_LEVEL_TIMEOUT = 30
# Haiku-level models: classification/evaluation/recommendation — 15s timeout
HAIKU_LEVEL_TIMEOUT = 15
# Default max retries with exponential backoff
DEFAULT_MAX_RETRIES = 3
# Base delay for exponential backoff (in seconds)
BACKOFF_BASE_DELAY = 1.0
# Maximum backoff delay (in seconds)
BACKOFF_MAX_DELAY = 10.0


@dataclass
class PromptExecutionOptions:
    """Опции выполнения промпта."""
    skip_cache: bool = False                     # Пропустить кэш
    override_model: Optional[str] = None         # Переопределить модель
    override_provider: Optional[str] = None      # Переопределить провайдер
    max_retries: Optional[int] = None            # Максимум попыток
    temperature: Optional[float] = None          # Переопределить температуру
    max_tokens: Optional[int] = None             # Переопределить max_tokens
    timeout: Optional[int] = None                # Таймаут в секундах


@dataclass
class PromptResult:
    """Результат выполнения промпта."""
    data: Any                                    # Валидированный результат
    metadata: dict = field(default_factory=dict) # Метаданные

    def __post_init__(self):
        # Гарантируем наличие всех полей metadata
        defaults = {
            "prompt_id": "",
            "model": "",
            "provider": "",
            "attempts": 0,
            "from_cache": False,
            "latency_ms": 0,
            "tokens_used": {"input": 0, "output": 0},
            "cost_usd": 0.0,
            "validation_passed": True,
            "was_repaired": False,
        }
        for k, v in defaults.items():
            if k not in self.metadata:
                self.metadata[k] = v


# ============================================================
# System Prompt (Слой 1 — статичный)
# ============================================================

SYSTEM_PROMPT = """Ты — AI-ассистент Gidede, интеллектуальной системы для геймдизайна. Твои знания основаны на 17 книгах по геймдизайну и формализованных фреймворках.

Твои основные фреймворки:
- MDA Framework (ЛеБланк): 8 эстетических ценностей (Чувственное, Фантазия, Нарратив, Вызов, Товарищество, Открытие, Выражение, Подчинение)
- MechanicsDB: 127 механик в 15 группах (SW.BAND)
- Типология Селлерса: Engines / Economies / Ecologies
- Core Loop Model: иерархия петель (микро → мета)
- Баланс-модели: transitive, intransitive, cost-power curves
- Machinations (Адамс/Дорманс): визуальный язык экономики игр

Твои принципы:
1. Ты предлагаешь, а не диктуешь. Окончательные решения принимает дизайнер.
2. Каждое рекомендация обоснована теорией. Цитируй: [Автор, Концепция].
3. Проверяй совместимость: новые элементы должны работать с существующими.
4. Учитывай жанровые конвенции, но не бойся их нарушать с обоснованием.
5. При конфликте между теорией и интуицией дизайнера — покажи оба варианта."""


# ============================================================
# Context Prompt (Слой 2 — динамический)
# ============================================================

def build_context_prompt(project_state: Optional[dict] = None) -> str:
    """
    Генерация Context Prompt из текущего Project State.
    Обновляется при каждом изменении модели проекта.
    """
    if not project_state:
        return "Контекст проекта: Не выбран. Работа без контекста проекта."

    parts = []
    if project_state.get("name"):
        parts.append(f"Текущий проект: {project_state['name']}")

    concept = project_state.get("concept", {})
    if concept.get("genre"):
        parts.append(f"Жанр: {concept['genre']}")
    if concept.get("primary_aesthetic"):
        parts.append(f"Целевая эстетика: {concept['primary_aesthetic']}")

    core_loop = project_state.get("core_loop", {})
    if core_loop.get("structural_type"):
        parts.append(f"Структурный тип: {core_loop['structural_type']}")

    mda = project_state.get("mda", {})
    if mda.get("mechanics"):
        parts.append(f"Механики: {', '.join(mda['mechanics'][:5])}")

    progression = project_state.get("progression", {})
    if progression.get("total_levels"):
        parts.append(f"Уровни прогрессии: {progression['total_levels']}")

    if not parts:
        return "Контекст проекта: Проект создан, данные ещё не заполнены."

    return "\n".join(parts)


# ============================================================
# Prompt Registry (Фаза 4.A.8 — полный реестр из 31 промптов)
# ============================================================

from app.prompts.registry import PROMPT_REGISTRY, get_prompt_spec
from app.prompts.schemas import PromptSpec


def _spec_to_dict(spec: PromptSpec) -> dict:
    """Конвертировать PromptSpec в dict для совместимости."""
    return {
        "id": spec.id,
        "module": spec.module.value,
        "task_type": spec.task_type.value,
        "output_format": spec.output_format.value,
        "output_schema": spec.output_schema,
        "system_prompt": spec.system_prompt,
        "user_prompt_template": spec.user_prompt_template,
        "model_requirements": {
            "primary": {"provider": spec.model_requirements.primary.provider.value, "model": spec.model_requirements.primary.model},
            "fallback": {"provider": spec.model_requirements.fallback.provider.value, "model": spec.model_requirements.fallback.model},
            "temperature": spec.model_requirements.temperature,
            "max_tokens": spec.model_requirements.max_tokens,
            "response_format": spec.model_requirements.response_format.value,
        },
        "guarantees": {
            "cacheable": spec.guarantees.cacheable,
            "cache_ttl": spec.guarantees.cache_ttl,
            "max_retries": spec.guarantees.max_retries,
            "json_output": spec.guarantees.json_output,
            "fallback_on_failure": spec.guarantees.fallback_on_failure,
        },
    }


# ============================================================
# Prompt Executor
# ============================================================

class PromptExecutor:
    """
    Ядро AI-интеграции Gidede.

    Единый интерфейс для всех AI-вызовов:
    - execute(prompt_id, inputs, options) → PromptResult
    - Автоматическая маршрутизация по провайдерам
    - Трёхслойная архитектура промптов
    - Кэширование с TTL
    - Fallback-цепочки
    - Валидация выхода
    - Логирование каждого вызова
    """

    def __init__(
        self,
        providers: list[AIProvider],
        router: PromptRouter,
        cache: PromptCache,
        validator: PromptValidator,
    ):
        self.providers = {p.name: p for p in providers}
        self.router = router
        self.cache = cache
        self.validator = validator
        self._system_prompt = SYSTEM_PROMPT

    # ========================================================
    # Timeout helper (4.E.4)
    # ========================================================

    def _get_timeout_for_task(self, task_type: str, options: PromptExecutionOptions) -> int:
        """
        Определить таймаут для типа задачи.
        Sonnet-level (generation, analysis) → 30s
        Haiku-level (classification, evaluation, recommendation) → 15s
        """
        if options.timeout is not None:
            return options.timeout

        sonnet_tasks = {"generation", "analysis"}
        if task_type in sonnet_tasks:
            return SONNET_LEVEL_TIMEOUT
        return HAIKU_LEVEL_TIMEOUT

    # ========================================================
    # Exponential backoff helper (4.E.4)
    # ========================================================

    @staticmethod
    def _calculate_backoff_delay(attempt: int) -> float:
        """
        Рассчитать задержку для exponential backoff.
        attempt 0 → 1s, attempt 1 → 2s, attempt 2 → 4s, capped at 10s.
        """
        delay = BACKOFF_BASE_DELAY * (2 ** attempt)
        return min(delay, BACKOFF_MAX_DELAY)

    # ========================================================
    # Batch/parallel execution (4.E.3)
    # ========================================================

    async def execute_batch(
        self,
        tasks: list[tuple[str, dict[str, Any]]],
        project_state: Optional[dict] = None,
        user_plan: str = "free",
        options: Optional[PromptExecutionOptions] = None,
    ) -> list[PromptResult]:
        """
        Выполнить несколько AI-промптов параллельно через asyncio.gather.

        Args:
            tasks: Список (prompt_id, inputs) кортежей
            project_state: Текущее состояние проекта
            user_plan: План пользователя (free/pro)
            options: Опциональные настройки (применяются ко всем задачам)

        Returns:
            Список PromptResult в том же порядке, что и tasks.
            Ошибки не прерывают другие задачи — возвращается PromptResult с ошибкой.
        """
        async def _safe_execute(prompt_id: str, inputs: dict[str, Any]) -> PromptResult:
            try:
                return await self.execute(
                    prompt_id=prompt_id,
                    inputs=inputs,
                    project_state=project_state,
                    user_plan=user_plan,
                    options=options,
                )
            except Exception as e:
                logger.error(f"Batch task {prompt_id} failed: {e}")
                return PromptResult(
                    data=None,
                    metadata={
                        "prompt_id": prompt_id,
                        "model": "error",
                        "provider": "none",
                        "attempts": 0,
                        "from_cache": False,
                        "latency_ms": 0,
                        "tokens_used": {"input": 0, "output": 0},
                        "cost_usd": 0.0,
                        "validation_passed": False,
                        "was_repaired": False,
                        "error": str(e),
                    },
                )

        coroutines = [_safe_execute(pid, inp) for pid, inp in tasks]
        results = await asyncio.gather(*coroutines)
        return list(results)

    async def execute(
        self,
        prompt_id: str,
        inputs: dict[str, Any],
        project_state: Optional[dict] = None,
        user_plan: str = "free",
        options: Optional[PromptExecutionOptions] = None,
    ) -> PromptResult:
        """
        Выполнить AI-промпт с автоматической маршрутизацией, кэшированием и fallback.

        Args:
            prompt_id: ID промпта (CLASSIFY_GENRE, и т.д.)
            inputs: Входные параметры
            project_state: Текущее состояние проекта (для Context Prompt)
            user_plan: План пользователя (free/pro)
            options: Опциональные настройки

        Returns:
            PromptResult с валидированными данными и метаданными
        """
        options = options or PromptExecutionOptions()
        start_time = time.time()

        # 1. Получить спецификацию промпта из полного реестра (4.A.8)
        prompt_spec = get_prompt_spec(prompt_id)
        if prompt_spec:
            spec = _spec_to_dict(prompt_spec)
        else:
            # Fallback для неизвестных промптов
            spec = {
                "id": prompt_id,
                "task_type": "generation",
                "output_format": "json",
            }

        task_type = spec.get("task_type", "generation")
        output_format = spec.get("output_format", "json")

        # 2. Проверить кэш
        if not options.skip_cache and self.cache.is_cacheable(prompt_id):
            cached = await self.cache.get(prompt_id, inputs)
            if cached is not None:
                latency = int((time.time() - start_time) * 1000)
                return PromptResult(
                    data=cached,
                    metadata={
                        "prompt_id": prompt_id,
                        "model": "cached",
                        "provider": "cache",
                        "attempts": 0,
                        "from_cache": True,
                        "latency_ms": latency,
                        "tokens_used": {"input": 0, "output": 0},
                        "cost_usd": 0.0,
                        "validation_passed": True,
                    },
                )

        # 3. Собрать промпт из 3 слоёв
        system_prompt = spec.get("system_prompt", self._system_prompt)
        context_prompt = build_context_prompt(project_state)
        task_prompt = self._build_task_prompt(spec, inputs)

        # 3.5 RAG-обогащение контекста (4.A.10)
        rag_context = await self._enrich_with_rag(prompt_id, inputs, project_state)
        if rag_context:
            context_prompt = f"{context_prompt}\n\n{rag_context}"

        # 4. Маршрутизация
        route = self.router.route(
            task_type=task_type,
            user_plan=user_plan,
            override_model=options.override_model,
            override_provider=options.override_provider,
        )

        # 5. Вызов AI с retry + fallback + timeout
        ai_response = await self._call_with_fallback(
            route=route,
            system_prompt=system_prompt,
            context_prompt=context_prompt,
            task_prompt=task_prompt,
            output_format=output_format,
            options=options,
            task_type=task_type,
        )

        # 6. Валидация выхода
        validation = self.validator.validate_full(
            content=ai_response.content,
            expected_format=output_format,
            output_schema=spec.get("output_schema"),
            task_type=task_type,
            prompt_id=prompt_id,
        )

        if not validation.is_valid and not validation.data:
            # Валидация провалена полностью — пробуем fallback
            degraded = self.validator.get_degraded_response(prompt_id, inputs)
            if degraded is not None:
                latency = int((time.time() - start_time) * 1000)
                return PromptResult(
                    data=degraded,
                    metadata={
                        "prompt_id": prompt_id,
                        "model": "degraded",
                        "provider": "deterministic_fallback",
                        "attempts": 1,
                        "from_cache": False,
                        "latency_ms": latency,
                        "tokens_used": {"input": 0, "output": 0},
                        "cost_usd": 0.0,
                        "validation_passed": False,
                    },
                )
            # Нет даже заглушки — ошибка
            raise ValueError(
                f"AI вернул невалидный ответ для промпта {prompt_id}: "
                f"{'; '.join(validation.errors)}"
            )

        result_data = validation.data
        latency = int((time.time() - start_time) * 1000)

        # 7. Кэширование
        if self.cache.is_cacheable(prompt_id) and not options.skip_cache:
            await self.cache.set(prompt_id, inputs, result_data)

        # 8. Логирование
        await self._log_execution(
            prompt_id=prompt_id,
            ai_response=ai_response,
            latency_ms=latency,
            from_cache=False,
            validation_passed=validation.is_valid,
        )

        return PromptResult(
            data=result_data,
            metadata={
                "prompt_id": prompt_id,
                "model": ai_response.model,
                "provider": ai_response.provider,
                "attempts": 1,
                "from_cache": False,
                "latency_ms": latency,
                "tokens_used": {
                    "input": ai_response.tokens_input,
                    "output": ai_response.tokens_output,
                },
                "cost_usd": ai_response.cost_usd,
                "validation_passed": validation.is_valid,
                "was_repaired": validation.was_repaired,
            },
        )

    async def _call_with_fallback(
        self,
        route: RouteResult,
        system_prompt: str,
        context_prompt: str,
        task_prompt: str,
        output_format: str,
        options: PromptExecutionOptions,
        task_type: str = "generation",
    ) -> AIResponse:
        """
        Вызов AI с fallback-цепочкой, таймаутами и exponential backoff.
        
        4.E.4:
        - Таймаут: 30s для Sonnet-level, 15s для Haiku-level
        - Exponential backoff: max 3 retries с задержкой 1s → 2s → 4s
        
        Попытка 1: primary (с retry + backoff) → Попытка 2: fallback (с retry) → Ошибка
        """
        max_retries = options.max_retries if options.max_retries is not None else DEFAULT_MAX_RETRIES
        timeout_seconds = self._get_timeout_for_task(task_type, options)

        # Основной провайдер с retry + backoff
        provider = route.provider
        model = route.model
        temperature = options.temperature or route.temperature
        max_tokens = options.max_tokens or route.max_tokens

        messages = provider.build_messages(system_prompt, context_prompt, task_prompt)

        last_error: Optional[Exception] = None

        for attempt in range(max_retries):
            try:
                result = await asyncio.wait_for(
                    provider.generate(
                        messages=messages,
                        model=model,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        response_format=route.response_format or (output_format if output_format == "json" else None),
                    ),
                    timeout=timeout_seconds,
                )
                return result
            except asyncio.TimeoutError:
                last_error = TimeoutError(
                    f"AI-вызов превысил таймаут {timeout_seconds}s "
                    f"(попытка {attempt + 1}/{max_retries}, провайдер: {provider.name})"
                )
                logger.warning(f"Timeout on attempt {attempt + 1}/{max_retries} for {provider.name}: {timeout_seconds}s")
            except Exception as e:
                last_error = e
                logger.warning(f"Primary provider {provider.name} failed (attempt {attempt + 1}/{max_retries}): {e}")

            # Exponential backoff before next retry
            if attempt < max_retries - 1:
                delay = self._calculate_backoff_delay(attempt)
                logger.info(f"Retrying in {delay:.1f}s (attempt {attempt + 2}/{max_retries})")
                await asyncio.sleep(delay)

        # Fallback-цепочка
        if route.fallback_chain:
            for fb_provider, fb_model in route.fallback_chain:
                for attempt in range(max_retries):
                    try:
                        messages = fb_provider.build_messages(system_prompt, context_prompt, task_prompt)
                        result = await asyncio.wait_for(
                            fb_provider.generate(
                                messages=messages,
                                model=fb_model,
                                temperature=temperature,
                                max_tokens=max_tokens,
                                response_format=route.response_format or (output_format if output_format == "json" else None),
                            ),
                            timeout=timeout_seconds,
                        )
                        return result
                    except asyncio.TimeoutError:
                        logger.warning(
                            f"Fallback provider {fb_provider.name} timeout "
                            f"(attempt {attempt + 1}/{max_retries}, {timeout_seconds}s)"
                        )
                    except Exception as fb_e:
                        logger.warning(f"Fallback provider {fb_provider.name} failed (attempt {attempt + 1}): {fb_e}")

                    # Backoff for fallback retries
                    if attempt < max_retries - 1:
                        delay = self._calculate_backoff_delay(attempt)
                        await asyncio.sleep(delay)

        # Все провайдеры недоступны
        if isinstance(last_error, TimeoutError):
            raise last_error
        raise RuntimeError(f"Все AI-провайдеры недоступны (последняя ошибка: {last_error})")

    def _build_task_prompt(self, spec: dict, inputs: dict) -> str:
        """Сборка Task Prompt (Слой 3) из шаблона и входных данных."""
        template = spec.get("user_prompt_template", "")

        if not template:
            # Нет шаблона — сериализуем все входы
            import json
            return json.dumps(inputs, ensure_ascii=False, indent=2)

        # Подстановка плейсхолдеров
        try:
            return template.format(**inputs)
        except KeyError:
            # Не все плейсхолдеры заполнены — добавляем входы отдельно
            import json
            return f"{template}\n\nДополнительные данные:\n{json.dumps(inputs, ensure_ascii=False, indent=2)}"

    async def _log_execution(
        self,
        prompt_id: str,
        ai_response: AIResponse,
        latency_ms: int,
        from_cache: bool,
        validation_passed: bool,
    ):
        """Логирование выполнения в БД (prompt_logs)."""
        try:
            from app.core.database import async_session
            from app.models.db import PromptLog

            async with async_session() as session:
                log_entry = PromptLog(
                    id=uuid.uuid4().hex,
                    prompt_id=prompt_id,
                    model_used=ai_response.model,
                    provider=ai_response.provider,
                    attempts=1,
                    from_cache=from_cache,
                    validation_passed=validation_passed,
                    latency_ms=latency_ms,
                    tokens_input=ai_response.tokens_input,
                    tokens_output=ai_response.tokens_output,
                    cost_usd=ai_response.cost_usd,
                    success=True,
                )
                session.add(log_entry)
                await session.commit()
        except Exception as e:
            logger.warning(f"Ошибка логирования AI-вызова: {e}")

    async def _enrich_with_rag(
        self,
        prompt_id: str,
        inputs: dict[str, Any],
        project_state: Optional[dict] = None,
    ) -> str:
        """
        RAG-обогащение: извлечь релевантный контекст из базы знаний
        и добавить в промпт. Вызывается автоматически перед отправкой промпта в AI.

        RAG активируется для промптов, которые требуют цитирования источников:
        - Все промпты модулей concept, coreloop, mda, balance, economy, gdd
        - AI-ассистент (Block 7) всегда использует RAG
        - Классификация и оценка — без RAG (нет необходимости)

        Returns:
            Строка с RAG-контекстом или пустая строка
        """
        try:
            from app.core.config import settings

            if not settings.RAG_ENABLED:
                return ""

            # Определяем, нужен ли RAG для этого промпта
            rag_prompts = {
                # Concept Generator (Block 1)
                "CLASSIFY_GENRE", "EXTRACT_AESTHETICS", "SUGGEST_DYNAMICS",
                "SELECT_MECHANICS", "GENERATE_CORE_LOOPS", "GENERATE_USP",
                # Core Loop Designer (Block 2)
                "CLASSIFY_CORE_LOOP", "BUILD_LOOP_HIERARCHY",
                "DIAGNOSE_PATHOLOGIES", "GENERATE_RECOMMENDATIONS",
                # MDA Lab (Block 3)
                "SUGGEST_MECHANICS_MDA", "SIMULATE_GAMEPLAY",
                "APPLY_LENS_MDA", "CHECK_LUDONARRATIVE_MDA",
                # Balance (Block 4)
                "ESTIMATE_WEIGHTS", "EVALUATE_SITUATIONAL_VALUE",
                "SUGGEST_INTRANSITIVE_CORRECTIONS", "ANALYZE_DISCREPANCY",
                # Progression (Block 5)
                "DESIGN_PROGRESSION_CURVES", "VALIDATE_PROGRESSION",
                # Economy (Block 5)
                "BUILD_ECONOMY_MODEL", "DIAGNOSE_ECONOMY",
                # GDD (Block 6)
                "GENERATE_GDD_SECTION", "CHECK_CONSISTENCY",
                # AI Assistant (Block 7) — всегда RAG
                "CHAT_ASSISTANT", "SUGGEST_NEXT_STEP",
            }

            if prompt_id not in rag_prompts:
                return ""

            # Формируем поисковый запрос
            search_query = self._build_rag_query(prompt_id, inputs)

            # Вызываем RAG-сервис
            from app.core.rag_service import get_rag_service
            rag_service = await get_rag_service()
            return await rag_service.enrich_prompt(
                query=search_query,
                project_context=project_state,
                max_context_tokens=2000,
            )

        except Exception as e:
            logger.warning(f"RAG enrichment failed for {prompt_id}: {e}")
            return ""

    def _build_rag_query(self, prompt_id: str, inputs: dict) -> str:
        """Построить поисковый запрос для RAG на основе prompt_id и входных данных."""
        # Извлечь ключевые слова из inputs для более точного поиска
        query_parts = []

        # Маппинг prompt_id → тематический запрос
        prompt_queries = {
            "CLASSIFY_GENRE": "жанровая классификация таксономия",
            "EXTRACT_AESTHETICS": "MDA эстетические ценности",
            "SUGGEST_DYNAMICS": "MDA динамики механики",
            "SELECT_MECHANICS": "механики игры выбор совместимость",
            "GENERATE_CORE_LOOPS": "core loop цикл геймплея",
            "GENERATE_USP": "уникальное торговое предложение",
            "CLASSIFY_CORE_LOOP": "тип Core Loop Engine Economy Ecology",
            "BUILD_LOOP_HIERARCHY": "иерархия петель микро мета",
            "DIAGNOSE_PATHOLOGIES": "патологии Core Loop runaway deadlock",
            "GENERATE_RECOMMENDATIONS": "рекомендации геймдизайн",
            "SUGGEST_MECHANICS_MDA": "MDA механики динамики эстетика",
            "SIMULATE_GAMEPLAY": "симуляция геймплея Machinations",
            "APPLY_LENS_MDA": "линзы Шелла валидация",
            "CHECK_LUDONARRATIVE_MDA": "лудонарративный диссонанс",
            "ESTIMATE_WEIGHTS": "баланс веса атрибутов cost-power",
            "EVALUATE_SITUATIONAL_VALUE": "ситуационная ценность баланс",
            "SUGGEST_INTRANSITIVE_CORRECTIONS": "intransitive баланс коррекции",
            "ANALYZE_DISCREPANCY": "дисбаланс анализ расхождение",
            "DESIGN_PROGRESSION_CURVES": "кривые прогрессии уровни",
            "VALIDATE_PROGRESSION": "валидация прогрессии гринд стена",
            "BUILD_ECONOMY_MODEL": "экономическая модель ресурсы Machinations",
            "DIAGNOSE_ECONOMY": "диагностика экономики патологии",
            "GENERATE_GDD_SECTION": "GDD документация секции",
            "CHECK_CONSISTENCY": "согласованность консистентность",
            "CHAT_ASSISTANT": "геймдизайн",
            "SUGGEST_NEXT_STEP": "следующий шаг рабочий процесс",
        }

        base_query = prompt_queries.get(prompt_id, prompt_id)
        query_parts.append(base_query)

        # Добавить контекст из входных данных
        if "idea" in inputs:
            query_parts.append(inputs["idea"][:100])
        elif "genre" in inputs:
            query_parts.append(str(inputs["genre"]))
        elif "query" in inputs:
            query_parts.append(str(inputs["query"])[:100])

        return " ".join(query_parts)

    def get_provider_status(self) -> dict:
        """Статус всех провайдеров (для health check)."""
        return {
            name: {
                "available": p.is_available,
                "priority": p.config.priority,
                "models": p.get_available_models(),
            }
            for name, p in self.providers.items()
        }
