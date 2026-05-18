"""
Gidede — Progression Schemas (Pydantic Models)
Фаза 4.C.5: Схемы для Блока 5 — Прогрессия (алгоритм 3.5, Этапы 1-4)

Модели синхронизированы с shared/types/python/models.py
и спецификацией алгоритма 3.5.

Алгоритм 3.5:
- Этап 1: Макро-параметры (длительность, уровни, тип прогрессии)
- Этап 2: Разбиение на тиры (D&D-модель)
- Этап 3: Кривые прогрессии (XP, мощность, стоимость, сложность)
- Этап 4: Контент-план (враги, награды, способности, милистоуны)
"""

from pydantic import BaseModel, Field
from typing import Any, Optional


# ============================================================
# ВХОДНЫЕ ДАННЫЕ (алгоритм 3.5)
# ============================================================

class ProgressionConstraints(BaseModel):
    """Ограничения для проектирования прогрессии."""
    maxGrindTolerance: int = Field(
        5,
        description="Максимальный допустимый гринд (повторяющихся итераций на уровень)",
    )
    minRewardInterval: int = Field(
        3,
        description="Минимальный интервал между наградами (в уровнях)",
    )
    flowTarget: str = Field(
        "balanced",
        description="Целевой поток: relaxed/balanced/intense",
    )
    contentBudget: str = Field(
        "medium",
        description="Бюджет контента: low/medium/high",
    )


class ProgressionInput(BaseModel):
    """Входные данные для проектирования прогрессии (алгоритм 3.5)."""
    concept: dict = Field(
        default_factory=dict,
        description="Концепт игры (из Блока 1): жанр, эстетика, платформа и т.д.",
    )
    coreLoop: Optional[dict] = Field(
        None,
        description="Профиль Core Loop (из Блока 2): структурный тип, петли, ресурсы",
    )
    mdaProfile: Optional[dict] = Field(
        None,
        description="MDA-профиль (из Блока 3): механики, динамики, эстетика",
    )
    balanceResult: Optional[dict] = Field(
        None,
        description="Результат балансировки (из Блока 4): кривые cost-power",
    )
    targetDuration: Optional[int] = Field(
        None,
        description="Целевая длительность игры (в часах). Если не задана — определяется по жанру.",
    )
    targetLevels: Optional[int] = Field(
        None,
        description="Целевое количество уровней. Если не задано — рассчитывается.",
    )
    progressionType: Optional[str] = Field(
        None,
        description="Тип прогрессии: linear/exponential/s_curve/diminishing/intermittent. "
                    "Если не задан — определяется по жанру.",
    )
    monetizationModel: str = Field(
        "premium",
        description="Модель монетизации: premium/freemium/p2w/cosmetic/subscription",
    )
    constraints: ProgressionConstraints = Field(
        default_factory=ProgressionConstraints,
        description="Ограничения для проектирования прогрессии",
    )


# ============================================================
# ЭТАП 1: МАКРО-ПАРАМЕТРЫ (алгоритм 3.5.1)
# ============================================================

class ProgressionMacroModel(BaseModel):
    """Макро-параметры прогрессии — результат Этапа 1 (алгоритм 3.5.1)."""
    duration: int = Field(
        0,
        description="Целевая длительность игры (в часах)",
    )
    levels: int = Field(
        0,
        description="Количество уровней прогрессии",
    )
    progressionType: str = Field(
        "linear",
        description="Тип прогрессии: linear/exponential/s_curve/diminishing/intermittent",
    )
    monetizationModel: str = Field(
        "premium",
        description="Модель монетизации",
    )
    contentRequirements: dict = Field(
        default_factory=dict,
        description="Требования к контенту: content_stages, enemy_configs, reward_types, etc.",
    )
    emergenceRatio: float = Field(
        0.0,
        description="Коэффициент эмерджентности (0-1): доля emergent-контента от общего",
    )
    lockKeyModel: str = Field(
        "linear",
        description="Модель замок-ключ: linear/metroidvania/emergent/dynamic/hybrid",
    )


# ============================================================
# ЭТАП 2: МОДЕЛЬ ТИРОВ (алгоритм 3.5.2)
# ============================================================

class TierInfo(BaseModel):
    """Информация об одном тире прогрессии."""
    index: int = Field(
        ...,
        description="Индекс тира (0-based)",
    )
    level_range: list[int] = Field(
        default_factory=list,
        description="Диапазон уровней: [start, end] (включительно)",
    )
    level_count: int = Field(
        0,
        description="Количество уровней в тире",
    )
    scale: str = Field(
        "",
        description="Масштаб тира (D&D): Локальный/Региональный/Мировой/Мультивселенский/Трансцендентный",
    )
    dominant_mechanic: str = Field(
        "",
        description="Доминирующая механика тира",
    )
    balance_type: str = Field(
        "",
        description="Тип балансировки тира: transitive/intransitive/situational",
    )
    difficulty_curve: str = Field(
        "gradual",
        description="Кривая сложности: gradual/spike/plateau",
    )
    resource_state: str = Field(
        "scarcity",
        description="Состояние ресурсов: scarcity/growth/abundance/unfolding/complexity/endgame/escalation/tension/expansion/metastability/competition",
    )
    transition_trigger: str = Field(
        "",
        description="Триггер перехода к следующему тиру",
    )


class TierModel(BaseModel):
    """Модель тиров — результат Этапа 2 (алгоритм 3.5.2)."""
    tiers: list[TierInfo] = Field(
        default_factory=list,
        description="Список тиров",
    )
    num_tiers: int = Field(
        0,
        description="Количество тиров",
    )
    total_levels: int = Field(
        0,
        description="Общее количество уровней",
    )
    transition_map: dict[str, str] = Field(
        default_factory=dict,
        description="Карта переходов: 'tier_i → tier_j' → trigger",
    )


# ============================================================
# ЭТАП 3: КРИВЫЕ ПРОГРЕССИИ (алгоритм 3.5.3)
# ============================================================

class CurveSpec(BaseModel):
    """Математическая спецификация кривой."""
    type: str = Field(
        "linear",
        description="Тип кривой: linear/exponential/triangular/polynomial/logistic",
    )
    formula: str = Field(
        "",
        description="Формула кривой (напр. 'xp = base * level^exponent')",
    )
    parameters: dict[str, Any] = Field(
        default_factory=dict,
        description="Параметры кривой: base, exponent, multiplier, offset, tier_boundaries, etc.",
    )


class ProgressionCurves(BaseModel):
    """4 кривые прогрессии — результат Этапа 3 (алгоритм 3.5.3)."""
    xp_to_level: CurveSpec = Field(
        default_factory=CurveSpec,
        description="Кривая XP → Level: сколько опыта нужно для каждого уровня",
    )
    level_to_power: CurveSpec = Field(
        default_factory=CurveSpec,
        description="Кривая Level → Power: мощность игрока на каждом уровне",
    )
    level_to_cost: CurveSpec = Field(
        default_factory=CurveSpec,
        description="Кривая Level → Cost: стоимость контента на каждом уровне",
    )
    difficulty: CurveSpec = Field(
        default_factory=CurveSpec,
        description="Кривая воспринимаемой сложности (Schreiber): perceived difficulty по уровням",
    )


# ============================================================
# ЭТАП 4: КОНТЕНТ-ПЛАН (алгоритм 3.5.4)
# ============================================================

class ContentTierPlan(BaseModel):
    """Контент-план для одного тира."""
    tier_index: int = Field(
        ...,
        description="Индекс тира",
    )
    level_range: list[int] = Field(
        default_factory=list,
        description="Диапазон уровней: [start, end]",
    )
    enemies: list[str] = Field(
        default_factory=list,
        description="Типы врагов для тира",
    )
    rewards: list[str] = Field(
        default_factory=list,
        description="Типы наград для тира",
    )
    abilities: list[str] = Field(
        default_factory=list,
        description="Способности, открываемые в тире",
    )
    milestones: list[str] = Field(
        default_factory=list,
        description="Ключевые милстоуны тира",
    )
    pacing: str = Field(
        "balanced",
        description="Темп контента: slow/balanced/fast/intense",
    )


class UnlockEntry(BaseModel):
    """Разблокировка на определённом уровне."""
    level: int = Field(
        ...,
        description="Уровень разблокировки",
    )
    unlock_name: str = Field(
        ...,
        description="Название разблокировки",
    )
    unlock_type: str = Field(
        ...,
        description="Тип разблокировки: ability/area/item/mechanic/boss/feature",
    )
    description: str = Field(
        "",
        description="Описание разблокировки",
    )


class PerceivedDifficultyEntry(BaseModel):
    """Воспринимаемая сложность на уровне."""
    level: int = Field(
        ...,
        description="Уровень",
    )
    target_perceived_difficulty: float = Field(
        0.5,
        description="Целевая воспринимаемая сложность (0-1, по Schreiber)",
    )
    recommended_enemy_power: float = Field(
        0.0,
        description="Рекомендуемая мощность врагов (относительная)",
    )
    is_tier_boundary: bool = Field(
        False,
        description="Является ли уровень границей тира (скачок сложности)",
    )


class ContentPlan(BaseModel):
    """Полный контент-план — результат Этапа 4 (алгоритм 3.5.4)."""
    tier_plans: list[ContentTierPlan] = Field(
        default_factory=list,
        description="Контент-планы по тирам",
    )
    unlock_tree: list[UnlockEntry] = Field(
        default_factory=list,
        description="Дерево разблокировок по уровням",
    )
    perceived_difficulty_table: list[PerceivedDifficultyEntry] = Field(
        default_factory=list,
        description="Таблица воспринимаемой сложности по уровням",
    )
    total_content_requirements: dict = Field(
        default_factory=dict,
        description="Общие требования к контенту: enemy_types, reward_types, ability_count, milestone_count",
    )


# ============================================================
# ВАЛИДАЦИЯ
# ============================================================

class ProgressionValidation(BaseModel):
    """Результат валидации системы прогрессии."""
    issues: list[dict] = Field(
        default_factory=list,
        description="Список проблем: [{severity, message, stage}]",
    )
    suggestions: list[str] = Field(
        default_factory=list,
        description="Рекомендации по улучшению",
    )
    critical_count: int = Field(
        0,
        description="Количество критических проблем",
    )
    warning_count: int = Field(
        0,
        description="Количество предупреждений",
    )
    info_count: int = Field(
        0,
        description="Количество информационных сообщений",
    )
    overall_score: float = Field(
        0.0,
        description="Общая оценка прогрессии (0-100)",
    )


# ============================================================
# ИТОГОВЫЙ ПРОФИЛЬ ПРОГРЕССИИ
# ============================================================

class ProgressionProfile(BaseModel):
    """
    Полный профиль прогрессии — результат алгоритма 3.5 (Этапы 1-4).

    Включает:
    - macroModel: Макро-параметры (Этап 1)
    - tierModel: Модель тиров (Этап 2)
    - curves: Кривые прогрессии (Этап 3)
    - contentPlan: Контент-план (Этап 4)
    - validation: Валидация
    - summary: Сводка
    - economyInput: Заглушка для связи с экономикой (Блок 5, алгоритм 3.6)
    """
    macroModel: ProgressionMacroModel = Field(
        default_factory=ProgressionMacroModel,
        description="Макро-параметры (Этап 1)",
    )
    tierModel: TierModel = Field(
        default_factory=TierModel,
        description="Модель тиров (Этап 2)",
    )
    curves: ProgressionCurves = Field(
        default_factory=ProgressionCurves,
        description="Кривые прогрессии (Этап 3)",
    )
    contentPlan: ContentPlan = Field(
        default_factory=ContentPlan,
        description="Контент-план (Этап 4)",
    )
    validation: ProgressionValidation = Field(
        default_factory=ProgressionValidation,
        description="Валидация прогрессии",
    )
    totalLevels: int = Field(
        0,
        description="Общее количество уровней",
    )
    totalDuration: int = Field(
        0,
        description="Общая длительность (часы)",
    )
    progressionType: str = Field(
        "linear",
        description="Тип прогрессии",
    )
    emergenceRatio: float = Field(
        0.0,
        description="Коэффициент эмерджентности",
    )
    lockKeyModel: str = Field(
        "linear",
        description="Модель замок-ключ",
    )
    summary: str = Field(
        "",
        description="Текстовая сводка системы прогрессии",
    )
    economyInput: dict = Field(
        default_factory=dict,
        description="Заглушка: входные данные для экономики (алгоритм 3.6)",
    )
    stages_completed: list[int] = Field(
        default_factory=list,
        description="Завершённые этапы алгоритма 3.5",
    )
    latency_ms: int = Field(
        0,
        description="Время выполнения (мс)",
    )
    models_used: list[str] = Field(
        default_factory=list,
        description="Использованные AI-модели/промпты",
    )
    warnings: list[str] = Field(
        default_factory=list,
        description="Предупреждения",
    )
    suggestions: list[str] = Field(
        default_factory=list,
        description="Рекомендации",
    )
