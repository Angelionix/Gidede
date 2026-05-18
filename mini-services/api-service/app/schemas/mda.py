"""
Gidede — MDA Schemas (Pydantic Models)
Фаза 4.B.9: Схемы для Блока 3 — MDA Lab (Этапы 1–3)

Модели синхронизированы с shared/types/python/models.py (4.A.12)
и shared/types/typescript/interfaces.ts.

Алгоритм 3.3:
- Этап 1: Reverse MDA — определение целевых динамик
- Этап 2: Reverse MDA — маппинг «Динамика → Механики»
- Этап 3: Сборка и оптимизация набора механик
"""

from pydantic import BaseModel, Field
from typing import Any, Optional


# ============================================================
# ЭТАП 1: ЦЕЛЕВЫЕ ДИНАМИКИ (алгоритм 3.3.3)
# ============================================================

class DynamicItem(BaseModel):
    """Динамика с метаданными."""
    name: str = Field(..., description="Название динамики")
    aesthetics_served: list[str] = Field(
        default_factory=list,
        description="Эстетики, которые порождает эта динамика",
    )
    genre_fit: float = Field(
        1.0,
        description="Соответствие жанру (0.0–1.0)",
    )
    source: str = Field(
        "formal",
        description="Источник: formal/ai",
    )
    warning: str = Field(
        "",
        description="Предупреждение, если динамика нетипична для жанра",
    )
    reasoning: str = Field(
        "",
        description="Обоснование (для AI-предложенных динамик)",
    )


class DynamicsTarget(BaseModel):
    """Целевые динамики — результат Этапа 1 (алгоритм 3.3.3)."""
    core_dynamics: list[str] = Field(
        default_factory=list,
        description="Основные динамики (порождают все 3 эстетики)",
    )
    supporting_dynamics: list[str] = Field(
        default_factory=list,
        description="Поддерживающие динамики",
    )
    context_dynamics: list[DynamicItem] = Field(
        default_factory=list,
        description="Контекстно-специфичные динамики (AI-предложенные)",
    )
    all_dynamics: list[DynamicItem] = Field(
        default_factory=list,
        description="Полный список динамик с метаданными",
    )
    emergence_level: str = Field(
        "none",
        description="Уровень эмерджентности: nominal/weak/multiple/strong",
    )
    emergence_description: str = Field(
        "",
        description="Описание уровня эмерджентности",
    )
    rationale: str = Field(
        "",
        description="Обоснование выбора динамик",
    )
    warnings: list[str] = Field(
        default_factory=list,
        description="Предупреждения о жанровом несоответствии",
    )


# ============================================================
# ЭТАП 2: КАНДИДАТЫ МЕХАНИК (алгоритм 3.3.4)
# ============================================================

class MechanicCandidate(BaseModel):
    """Кандидат-механика для покрытия динамики."""
    name: str = Field(..., description="Название механики")
    group_id: int = Field(0, description="ID группы MechanicsDB (1-15)")
    group_name: str = Field("", description="Название группы")
    source: str = Field(
        "MechanicsDB",
        description="Источник: MechanicsDB/AdamsPattern/AI-Suggested",
    )
    dynamics_affinity: list[str] = Field(
        default_factory=list,
        description="Список порождаемых динамик",
    )
    genre_affinity: float = Field(
        0.5,
        description="Привязка к жанру (0.0–1.0)",
    )
    aesthetics_served: list[str] = Field(
        default_factory=list,
        description="Список порождаемых эстетик",
    )
    description: str = Field("", description="Описание механики")
    conflicts_with: list[str] = Field(
        default_factory=list,
        description="Конфликтующие механики",
    )
    synergies_with: list[str] = Field(
        default_factory=list,
        description="Синергетические механики",
    )


class MechanicCandidateSet(BaseModel):
    """Набор кандидатов механик — результат Этапа 2 (алгоритм 3.3.4)."""
    mechanics: list[MechanicCandidate] = Field(
        default_factory=list,
        description="Выбранные механики (8-18)",
    )
    dynamics_coverage: dict[str, list[str]] = Field(
        default_factory=dict,
        description="Какая механика какие динамики покрывает",
    )
    uncovered_dynamics: list[str] = Field(
        default_factory=list,
        description="Динамики без механик (если есть)",
    )
    synergy_pairs: list[dict] = Field(
        default_factory=list,
        description="Обнаруженные синергии",
    )
    conflict_pairs: list[dict] = Field(
        default_factory=list,
        description="Обнаруженные конфликты",
    )
    total_aesthetics_served: dict[str, float] = Field(
        default_factory=dict,
        description="Покрытие эстетик: эстетика → уверенность (0-1)",
    )


# ============================================================
# ЭТАП 3: СТРУКТУРИРОВАННЫЙ НАБОР МЕХАНИК (алгоритм 3.3.5)
# ============================================================

class AestheticCoverage(BaseModel):
    """Покрытие одной эстетики."""
    aesthetic: str = Field(..., description="Название эстетики")
    count: int = Field(0, description="Количество покрывающих механик")
    mechanics: list[str] = Field(default_factory=list, description="Названия механик")
    sufficient: bool = Field(False, description="Достаточно ли покрытия (>= 2 механики)")


class AdamsDormansPattern(BaseModel):
    """Обнаруженный паттерн Adams/Dormans (Кн. 4)."""
    name: str = Field(..., description="Название паттерна")
    pattern_type: str = Field(
        "",
        description="Тип: engine/friction/escalation/conversion/other",
    )
    present: bool = Field(False, description="Присутствует ли паттерн в наборе")
    supporting_mechanics: list[str] = Field(
        default_factory=list,
        description="Механики, образующие паттерн",
    )
    suggestion: str = Field(
        "",
        description="Рекомендация, если паттерн отсутствует",
    )


class StructuredMechanicSet(BaseModel):
    """Структурированный набор механик — результат Этапа 3 (алгоритм 3.3.5)."""
    # Группировка по структурным ролям (как в MechanicSet из concept)
    base: list[dict] = Field(
        default_factory=list,
        description="Базовые механики (ядро взаимодействия, Группа 1)",
    )
    combat: list[dict] = Field(
        default_factory=list,
        description="Механики боевого взаимодействия (Группы 4, 8)",
    )
    progression: list[dict] = Field(
        default_factory=list,
        description="Механики прогрессии (Группы 2, 9)",
    )
    spatial: list[dict] = Field(
        default_factory=list,
        description="Пространственные механики (Группы 3, 5, 11)",
    )
    social: list[dict] = Field(
        default_factory=list,
        description="Социальные/информационные механики (Группы 7, 14)",
    )

    # Мета-данные
    total_count: int = Field(0, description="Общее количество механик")
    aesthetic_coverage: list[AestheticCoverage] = Field(
        default_factory=list,
        description="Покрытие эстетик",
    )
    patterns_detected: list[AdamsDormansPattern] = Field(
        default_factory=list,
        description="Обнаруженные паттерны Adams/Dormans",
    )
    compatibility_score: float = Field(
        0.0,
        description="Score совместимости (0-100)",
    )
    synergy_score: float = Field(
        0.0,
        description="Score синергии (0-100)",
    )
    conflicts_resolved: list[str] = Field(
        default_factory=list,
        description="Разрешённые конфликты",
    )
    suggestions: list[str] = Field(
        default_factory=list,
        description="Рекомендации по улучшению набора",
    )
    warnings: list[str] = Field(
        default_factory=list,
        description="Предупреждения",
    )


# ============================================================
# ИТОГОВЫЙ ПРОФИЛЬ MDA — ЭТАПЫ 1-3 (алгоритм 3.3)
# ============================================================

class MDAProfile(BaseModel):
    """
    MDA-профиль — результат Этапов 1–3 алгоритма 3.3.

    Включает:
    - aesthetic_profile: целевая эстетика (из алгоритма 3.1 / ввод)
    - dynamics_target: целевые динамики (Этап 1)
    - mechanic_candidate_set: набор кандидатов (Этап 2)
    - mechanic_set: структурированный набор механик (Этап 3)
    - balance_input: данные для алгоритма 3.4
    """
    # Целевая модель
    aesthetic_profile: Optional[dict] = Field(
        None,
        description="Целевая эстетика (AestheticProfile)",
    )
    dynamics_target: Optional[DynamicsTarget] = Field(
        None,
        description="Целевые динамики (Этап 1)",
    )
    mechanic_candidate_set: Optional[MechanicCandidateSet] = Field(
        None,
        description="Набор кандидатов механик (Этап 2)",
    )
    mechanic_set: Optional[StructuredMechanicSet] = Field(
        None,
        description="Структурированный набор механик (Этап 3)",
    )

    # Мета-данные
    genre: str = Field("", description="Жанр игры")
    concept_id: str = Field("", description="ID концепции")
    iterations_done: int = Field(
        1,
        description="Выполненные итерации генеративного цикла",
    )
    stages_completed: list[int] = Field(
        default_factory=lambda: [1, 2, 3],
        description="Завершённые этапы",
    )
    latency_ms: int = Field(0, description="Время выполнения (мс)")
    models_used: list[str] = Field(
        default_factory=list,
        description="Использованные AI-модели",
    )
