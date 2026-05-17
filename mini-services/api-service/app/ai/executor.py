"""
Gidede — Prompt Executor
Фаза 4.A.7: Ядро AI-интеграции

Единый интерфейс вызова AI-промптов с:
- Трёхслойной архитектурой (System + Context + Task)
- Автоматической маршрутизацией
- Кэшированием
- Fallback-цепочками
- Валидацией выхода
- Логированием каждого вызова

Интерфейс (из спецификации 3.9.6):
    executor = PromptExecutor(providers, cache, router, validator)
    result = await executor.execute("CLASSIFY_GENRE", {"idea": "..."})
"""

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

@dataclass
class PromptExecutionOptions:
    """Опции выполнения промпта."""
    skip_cache: bool = False                     # Пропустить кэш
    override_model: Optional[str] = None         # Переопределить модель
    override_provider: Optional[str] = None      # Переопределить провайдер
    max_retries: Optional[int] = None            # Максимум попыток
    temperature: Optional[float] = None          # Переопределить температуру
    max_tokens: Optional[int] = None             # Переопределить max_tokens
    timeout: Optional[int] = None                # Таймаут в ms


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

        # 4. Маршрутизация
        route = self.router.route(
            task_type=task_type,
            user_plan=user_plan,
            override_model=options.override_model,
            override_provider=options.override_provider,
        )

        # 5. Вызов AI с retry + fallback
        ai_response = await self._call_with_fallback(
            route=route,
            system_prompt=system_prompt,
            context_prompt=context_prompt,
            task_prompt=task_prompt,
            output_format=output_format,
            options=options,
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
    ) -> AIResponse:
        """
        Вызов AI с fallback-цепочкой.
        Попытка 1: primary → Попытка 2: fallback → Попытка 3: cached → Попытка 4: degraded
        """
        # Основной провайдер
        provider = route.provider
        model = route.model
        temperature = options.temperature or route.temperature
        max_tokens = options.max_tokens or route.max_tokens

        messages = provider.build_messages(system_prompt, context_prompt, task_prompt)

        try:
            return await provider.generate(
                messages=messages,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format=route.response_format or (output_format if output_format == "json" else None),
            )
        except Exception as e:
            logger.warning(f"Primary provider {provider.name} failed: {e}")

        # Fallback-цепочка
        if route.fallback_chain:
            for fb_provider, fb_model in route.fallback_chain:
                try:
                    messages = fb_provider.build_messages(system_prompt, context_prompt, task_prompt)
                    return await fb_provider.generate(
                        messages=messages,
                        model=fb_model,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        response_format=route.response_format or (output_format if output_format == "json" else None),
                    )
                except Exception as fb_e:
                    logger.warning(f"Fallback provider {fb_provider.name} failed: {fb_e}")
                    continue

        # Все провайдеры недоступны
        raise RuntimeError("Все AI-провайдеры недоступны")

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
