"""
Gidede — Prompt Specification Schemas
Фаза 4.A.8: Формальные модели для реестра промптов

Спецификация 3.9.3: Формализация интерфейсов промптов.
Каждый промпт — это функция с типизированными входами и выходами.

Pydantic-модели:
- PromptInput — типизированный входной параметр
- ModelSpec — спецификация AI-модели
- ModelRequirements — требования к модели (primary + fallback)
- PromptGuarantees — гарантии промпта (детерминизм, кэширование, retry)
- PromptSpec — полная спецификация промпта (31 шт.)
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ============================================================
# ENUMS
# ============================================================

class ModuleType(str, Enum):
    """Принадлежность промпта к модулю (блоку) системы."""
    CONCEPT = "concept"          # Блок 1 — Генератор концепции
    CORE_LOOP = "core_loop"      # Блок 2 — Core Loop Designer
    MDA = "mda"                  # Блок 3 — MDA Lab
    BALANCE = "balance"          # Блок 4 — Баланс и симуляция
    PROGRESSION = "progression"  # Блок 5 — Прогрессия
    ECONOMY = "economy"          # Блок 5 — Экономика
    GDD = "gdd"                  # Блок 6 — GDD Generator
    VALIDATION = "validation"    # Блок 6 — Валидация


class PromptTaskType(str, Enum):
    """Тип задачи промпта — определяет маршрутизацию по моделям."""
    CLASSIFICATION = "classification"    # Классификация входа по категориям
    GENERATION = "generation"            # Генерация нового контента
    ANALYSIS = "analysis"                # Анализ существующего контента
    EVALUATION = "evaluation"            # Оценка по критериям
    RECOMMENDATION = "recommendation"    # Рекомендация по исправлению


class OutputFormat(str, Enum):
    """Формат выхода промпта."""
    JSON = "json"
    MARKDOWN = "markdown"
    TEXT = "text"


class AIProviderType(str, Enum):
    """Тип AI-провайдера."""
    ZAI = "zai"
    OLLAMA = "ollama"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    LOCAL = "local"


# ============================================================
# INPUT PARAMETER
# ============================================================

class PromptInput(BaseModel):
    """
    Типизированный входной параметр промпта.
    Спецификация 3.9.3: PromptInput.
    """
    name: str = Field(..., description="Имя параметра")
    type: str = Field(
        default="string",
        description="Тип: string | number | object | array | boolean",
    )
    required: bool = Field(default=True, description="Обязательный ли параметр")
    description: str = Field(default="", description="Описание параметра")
    default: Optional[Any] = Field(default=None, description="Значение по умолчанию")
    validation_rule: Optional[str] = Field(
        default=None,
        description="Правило валидации (regex или описание)",
    )


# ============================================================
# MODEL SPECIFICATIONS
# ============================================================

class ModelSpec(BaseModel):
    """
    Спецификация AI-модели.
    Спецификация 3.9.3: ModelSpec.
    """
    provider: AIProviderType = Field(..., description="Провайдер модели")
    model: str = Field(..., description="Идентификатор модели (gpt-4, claude-3-sonnet, и т.д.)")
    max_cost_per_call: float = Field(
        default=0.05,
        description="Максимальная стоимость одного вызова (USD)",
    )


class ModelRequirements(BaseModel):
    """
    Требования к модели для промпта.
    Спецификация 3.9.3: ModelRequirements.
    """
    primary: ModelSpec = Field(..., description="Основная модель")
    fallback: ModelSpec = Field(..., description="Fallback-модель")
    min_context_window: int = Field(default=4096, description="Минимальное контекстное окно (токены)")
    temperature: float = Field(default=0.5, ge=0.0, le=2.0, description="Температура генерации")
    max_tokens: int = Field(default=1024, ge=1, description="Максимум выходных токенов")
    response_format: OutputFormat = Field(default=OutputFormat.JSON, description="Формат ответа")


class PromptGuarantees(BaseModel):
    """
    Гарантии промпта.
    Спецификация 3.9.3: PromptGuarantees.
    """
    deterministic: bool = Field(
        default=False,
        description="Одинаковый вход → одинаковый выход (при temp=0)?",
    )
    json_output: bool = Field(
        default=True,
        description="Гарантированный JSON на выходе?",
    )
    max_retries: int = Field(default=2, ge=0, description="Максимум попыток при ошибке")
    fallback_on_failure: bool = Field(
        default=True,
        description="Fallback на более слабую модель?",
    )
    cacheable: bool = Field(default=True, description="Можно ли кэшировать результат?")
    cache_ttl: Optional[int] = Field(
        default=None,
        description="Время жизни кэша (секунды). None — не кэшировать",
    )


class EstimatedMetrics(BaseModel):
    """Оценка метрик промпта."""
    input_tokens: int = Field(default=200, description="Оценка входных токенов")
    output_tokens: int = Field(default=500, description="Оценка выходных токенов")
    cost_min: float = Field(default=0.001, description="Минимальная стоимость (USD)")
    cost_max: float = Field(default=0.01, description="Максимальная стоимость (USD)")
    latency_min_ms: int = Field(default=500, description="Минимальная латентность (ms)")
    latency_max_ms: int = Field(default=5000, description="Максимальная латентность (ms)")


# ============================================================
# PROMPT SPECIFICATION
# ============================================================

class PromptSpec(BaseModel):
    """
    Полная спецификация AI-промпта.
    Спецификация 3.9.3: PromptSpec.

    Каждый промпт — это функция с типизированными входами и выходами.
    Содержит:
    - Идентификацию (id, module, algorithm, version)
    - Тип задачи (taskType)
    - Входы (inputs)
    - Выходы (outputFormat, outputSchema, outputExamples)
    - Промпт-шаблоны (systemPrompt, userPromptTemplate)
    - Требования к модели (modelRequirements)
    - Гарантии (guarantees)
    - Метрики (estimatedTokens, estimatedCost, estimatedLatency)
    """
    # === Идентификация ===
    id: str = Field(..., description="Уникальный ID промпта (CLASSIFY_GENRE)")
    module: ModuleType = Field(..., description="Принадлежность к модулю")
    algorithm: str = Field(..., description="Алгоритм-источник (3.1, 3.2, ...)")
    version: str = Field(default="1.0.0", description="Версия промпта (semver)")

    # === Тип задачи ===
    task_type: PromptTaskType = Field(
        ..., alias="taskType",
        description="Классификация/Генерация/Анализ/Оценка/Рекомендация",
    )

    # === Входы ===
    inputs: list[PromptInput] = Field(
        default_factory=list,
        description="Типизированные параметры",
    )

    # === Выходы ===
    output_format: OutputFormat = Field(
        default=OutputFormat.JSON,
        alias="outputFormat",
        description="Формат выхода: JSON/Markdown/Text",
    )
    output_schema: Optional[dict[str, Any]] = Field(
        default=None,
        description="JSON-Schema для валидации выхода",
    )
    output_examples: list[str] = Field(
        default_factory=list,
        description="Примеры корректного выхода",
    )

    # === Промпт-шаблоны ===
    system_prompt: str = Field(
        default="",
        description="SYSTEM-часть промпта (с плейсхолдерами)",
    )
    user_prompt_template: str = Field(
        default="",
        description="USER-часть промпта (с плейсхолдерами)",
    )

    # === Модель и параметры ===
    model_requirements: ModelRequirements = Field(
        ..., description="Требования к модели (primary + fallback)",
    )

    # === Гарантии ===
    guarantees: PromptGuarantees = Field(
        default_factory=PromptGuarantees,
        description="Гарантии промпта",
    )

    # === Метрики ===
    estimated: EstimatedMetrics = Field(
        default_factory=EstimatedMetrics,
        description="Оценка токенов, стоимости и латентности",
    )

    model_config = {"populate_by_name": True}
