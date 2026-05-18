"""
Gidede — Core Loop Schemas (Pydantic Models)
Фаза 4.B.7: Схемы для Блока 2 — Core Loop Designer (Этапы 1–5)

Модели синхронизированы с shared/types/python/models.py (4.A.12)
и shared/types/typescript/interfaces.ts.

Алгоритм 3.2:
- Этап 1: Классификация структурного типа
- Этап 2: Конструирование иерархии петель
- Этап 3: Диагностика патологий
- Этап 4: Валидация Core Loop
- Этап 5: Рекомендации
"""

from pydantic import BaseModel, Field
from typing import Any, Optional


# ============================================================
# ЭТАП 1: КЛАССИФИКАЦИЯ СТРУКТУРНОГО ТИПА (алгоритм 3.2.3)
# ============================================================

class ResourceProfile(BaseModel):
    """Профиль ресурса в Core Loop."""
    name: str = Field("", description="Название ресурса")
    class_: str = Field("", description="Класс: Valued/Commodity/Subsidiary")
    type: str = Field("core", description="Тип: core/consumable/currency")
    initial_value: float = Field(0.0, description="Начальное значение")
    bounds: dict = Field(
        default_factory=lambda: {"min": 0, "max": 100},
        description="Границы: {min, max}",
    )


class RiskProfile(BaseModel):
    """Профиль рисков структурного типа."""
    likely_pathologies: list[str] = Field(
        default_factory=list,
        description="Вероятные патологии",
    )
    risk_level: str = Field(
        "low",
        description="Уровень риска: low/medium/high/critical",
    )
    mitigation_suggestions: list[str] = Field(
        default_factory=list,
        description="Предложения по снижению рисков",
    )


class StructuralType(BaseModel):
    """Классификация структурного типа Core Loop (алгоритм 3.2.3)."""
    type: str = Field(
        "engine",
        description="Основной тип: engine/economy/ecology/hybrid",
    )
    sub_type: str = Field(
        "",
        description="Подтип: braked_engine, pure_engine, multi_currency_economy, etc.",
    )
    resources: list[dict] = Field(
        default_factory=list,
        description="Ресурсы (ResourceProfile[])",
    )
    loops: list[dict] = Field(
        default_factory=list,
        description="Петли (LoopProfile[])",
    )
    has_braking: bool = Field(
        False,
        description="Наличие тормозящего механизма",
    )
    currencies: list[str] = Field(
        default_factory=list,
        description="Список валют",
    )
    risk_assessment: Optional[RiskProfile] = Field(
        None,
        description="Оценка рисков",
    )


# ============================================================
# CORE LOOP STEP (алгоритм 3.2)
# ============================================================

class CoreLoopStep(BaseModel):
    """Шаг Core Loop с привязкой к механике и ресурсам."""
    action: str = Field("", description="Глагол действия")
    mechanics: list[str] = Field(
        default_factory=list,
        description="Механики, задействованные в шаге",
    )
    resources_consumed: list[str] = Field(
        default_factory=list,
        description="Потребляемые ресурсы",
    )
    resources_produced: list[str] = Field(
        default_factory=list,
        description="Производимые ресурсы",
    )
    feedback_type: str = Field(
        "positive",
        description="Тип обратной связи: positive/negative/neutral",
    )
    duration_estimate: float = Field(
        0.0,
        description="Оценка длительности шага (секунды)",
    )


# ============================================================
# ЭТАП 2: ИЕРАРХИЯ ПЕТЕЛЬ (алгоритм 3.2.4)
# ============================================================

class LoopProfile(BaseModel):
    """Профиль петли (уровень иерархии)."""
    level: str = Field(
        "micro",
        description="Уровень: micro/small/medium/large/macro/meta",
    )
    actions: list[str] = Field(
        default_factory=list,
        description="Действия в петле",
    )
    time_scale: str = Field(
        "",
        description="Временной масштаб: 'мс-секунды', '1-2 мин', '5-10 мин', etc.",
    )
    parent_step: Optional[str] = Field(
        None,
        description="Шаг родительской петли (для вложенных)",
    )


class LoopHierarchy(BaseModel):
    """Иерархия петель — 6 уровней (алгоритм 3.2.4)."""
    micro: list[LoopProfile] = Field(
        default_factory=list,
        description="Микро-петли (мс-секунды)",
    )
    small: list[LoopProfile] = Field(
        default_factory=list,
        description="Малые петли (1-2 мин)",
    )
    medium: list[LoopProfile] = Field(
        default_factory=list,
        description="Средние петли (5-10 мин)",
    )
    large: list[LoopProfile] = Field(
        default_factory=list,
        description="Большие петли (15-30 мин)",
    )
    macro: list[LoopProfile] = Field(
        default_factory=list,
        description="Макро-петли (часы)",
    )
    meta: list[LoopProfile] = Field(
        default_factory=list,
        description="Мета-петли (недели-месяцы)",
    )


# ============================================================
# ЭТАП 3: ПАТОЛОГИИ (алгоритм 3.2.5)
# ============================================================

class Pathology(BaseModel):
    """Обнаруженная патология Core Loop."""
    name: str = Field("", description="Название патологии")
    type: str = Field(
        "",
        description="Тип: runaway/deadlock/stall/brittleness/oscillation/stagnation/triviality",
    )
    severity: str = Field(
        "info",
        description="Серьёзность: critical/warning/info",
    )
    affected_resources: list[str] = Field(
        default_factory=list,
        description="Затронутые ресурсы",
    )
    description: str = Field("", description="Описание патологии")
    correction: str = Field("", description="Корректирующее действие")


class PathologyReport(BaseModel):
    """Отчёт по патологиям Core Loop (алгоритм 3.2.5)."""
    pathologies: list[Pathology] = Field(
        default_factory=list,
        description="Список обнаруженных патологий",
    )
    total_count: int = Field(0, description="Общее количество патологий")
    critical_count: int = Field(0, description="Количество критических патологий")


# ============================================================
# ЭТАП 4: ВАЛИДАЦИЯ CORE LOOP (алгоритм 3.2.6)
# ============================================================

class FunCheckResult(BaseModel):
    """Результат теста '30 секунд веселья' (Кн. 7)."""
    passed: bool = Field(False, description="Прошёл ли тест '30 секунд веселья'")
    score: float = Field(0.0, description="Оценка веселья 0-1")
    reasoning: str = Field("", description="Обоснование оценки")

class LoopClosednessCheck(BaseModel):
    """Проверка замкнутости петли."""
    is_closed: bool = Field(False, description="Замкнута ли петля (последний шаг → первый)")
    last_step: str = Field("", description="Последний шаг")
    first_step: str = Field("", description="Первый шаг")
    connection_description: str = Field("", description="Как последний шаг ведёт к первому")

class ResourceSufficiencyCheck(BaseModel):
    """Проверка достаточности ресурсов."""
    has_dead_resources: bool = Field(False, description="Есть ли 'мёртвые' ресурсы")
    dead_resources: list[str] = Field(default_factory=list, description="Список мёртвых ресурсов")
    has_unsourced_consumables: bool = Field(False, description="Есть ли потребляемые ресурсы без источника")
    unsourced_consumables: list[str] = Field(default_factory=list, description="Потребляемые без источника пополнения")

class CoreLoopValidationResult(BaseModel):
    """Результат валидации Core Loop (алгоритм 3.2.6)."""
    fun_check: Optional[FunCheckResult] = Field(None, description="Тест '30 секунд веселья'")
    loop_closedness: Optional[LoopClosednessCheck] = Field(None, description="Проверка замкнутости")
    resource_sufficiency: Optional[ResourceSufficiencyCheck] = Field(None, description="Проверка достаточности ресурсов")
    checklist_passed: int = Field(0, description="Количество пройденных критериев чек-листа (из 5)")
    checklist_total: int = Field(5, description="Всего критериев чек-листа")
    overall_passed: bool = Field(False, description="Валидация пройдена (>=3 из 5 критериев)")
    score: float = Field(0.0, description="Общая оценка валидации 0-1")
    warnings: list[str] = Field(default_factory=list, description="Предупреждения")

# ============================================================
# ЭТАП 5: РЕКОМЕНДАЦИИ (алгоритм 3.2.7)
# ============================================================

class Recommendation(BaseModel):
    """Рекомендация по улучшению Core Loop."""
    target: str = Field("", description="Что рекомендуется изменить")
    recommendation: str = Field("", description="Текст рекомендации")
    priority: str = Field("medium", description="Приоритет: high/medium/low")
    category: str = Field("", description="Категория: fun/closedness/resource/pathology/structure")
    source: str = Field("formal", description="Источник: formal/ai")


# ============================================================
# ИТОГОВЫЙ ПРОФИЛЬ CORE LOOP (результат Этапов 1–5)
# ============================================================

class CoreLoopProfile(BaseModel):
    """
    Итоговый профиль Core Loop — результат Этапов 1–5 алгоритма 3.2.

    Включает:
    - structural_type: классификация структурного типа (Этап 1)
    - steps: шаги Core Loop
    - inner_loops: внутренние петли (Этап 2)
    - outer_loops: внешние петли (Этап 2)
    - meta_loop: мета-петля (Этап 2)
    - pathologies: отчёт по патологиям (Этап 3)
    - validation: результат валидации (Этап 4)
    - recommendations: рекомендации (Этап 5)
    - loop_hierarchy: иерархия петель (Этап 2)
    """
    structural_type: Optional[StructuralType] = Field(
        None,
        description="Классификация структурного типа (Этап 1)",
    )
    steps: list[CoreLoopStep] = Field(
        default_factory=list,
        description="Шаги Core Loop",
    )
    inner_loops: list[dict] = Field(
        default_factory=list,
        description="Внутренние петли (Этап 2)",
    )
    outer_loops: list[dict] = Field(
        default_factory=list,
        description="Внешние петли (Этап 2)",
    )
    meta_loop: Optional[dict] = Field(
        None,
        description="Мета-петля (Этап 2)",
    )
    pathologies: Optional[PathologyReport] = Field(
        None,
        description="Отчёт по патологиям (Этап 3)",
    )
    validation: Optional[CoreLoopValidationResult] = Field(
        None,
        description="Результат валидации (Этап 4)",
    )
    recommendations: list[dict] = Field(
        default_factory=list,
        description="Рекомендации",
    )
    loop_hierarchy: Optional[LoopHierarchy] = Field(
        None,
        description="Иерархия петель (Этап 2)",
    )
    stages_completed: list[int] = Field(
        default_factory=lambda: [1, 2, 3],
        description="Завершённые этапы",
    )
