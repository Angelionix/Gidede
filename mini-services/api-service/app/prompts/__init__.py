"""
Gidede — Prompts Module
Фаза 4.A.8: Реестр AI-промптов (31 PromptSpec)

Модуль содержит:
- schemas.py — Pydantic-модели (PromptSpec, PromptInput, ModelRequirements, и т.д.)
- registry.py — PROMPT_REGISTRY со всеми 31 спецификациями промптов
- ab_testing.py — утилита A/B-тестирования и версионирования промптов

Спецификация 3.9.2–3.9.3: Каталог и формализация интерфейсов промптов.
"""

from app.prompts.schemas import (
    PromptSpec,
    PromptInput,
    ModelSpec,
    ModelRequirements,
    PromptGuarantees,
    EstimatedMetrics,
    ModuleType,
    PromptTaskType,
    OutputFormat,
    AIProviderType,
)
from app.prompts.registry import (
    PROMPT_REGISTRY,
    get_prompt_spec,
    get_prompts_by_module,
    get_prompts_by_task_type,
    get_cacheable_prompts,
    get_registry_stats,
)
from app.prompts.ab_testing import (
    ABTestManager,
    ABTestResult,
    ABTestVariant,
    PromptVersionManager,
)

__all__ = [
    # Schemas
    "PromptSpec",
    "PromptInput",
    "ModelSpec",
    "ModelRequirements",
    "PromptGuarantees",
    "EstimatedMetrics",
    "ModuleType",
    "PromptTaskType",
    "OutputFormat",
    "AIProviderType",
    # Registry
    "PROMPT_REGISTRY",
    "get_prompt_spec",
    "get_prompts_by_module",
    "get_prompts_by_task_type",
    "get_cacheable_prompts",
    "get_registry_stats",
    # A/B Testing
    "ABTestManager",
    "ABTestResult",
    "ABTestVariant",
    "PromptVersionManager",
]
