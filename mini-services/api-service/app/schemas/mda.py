"""
Gidede — MDA Schemas (Pydantic Models)
Фаза 4.B.9–4.B.10: Схемы для Блока 3 — MDA Lab (Этапы 1–6)

Модели синхронизированы с shared/types/python/models.py (4.A.12)
и shared/types/typescript/interfaces.ts.

Алгоритм 3.3:
- Этап 1: Reverse MDA — определение целевых динамик
- Этап 2: Reverse MDA — маппинг «Динамика → Механики»
- Этап 3: Сборка и оптимизация набора механик
- Этап 4: Classic MDA — аналитический проход (3.3.6)
- Этап 5: Валидация через Линзы Шелла (3.3.7)
- Этап 6: Матрица 4×3 Бонда + лудонарративный анализ (3.3.8)
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
# ЭТАП 4: CLASSIC MDA — АНАЛИТИЧЕСКИЙ ПРОХОД (алгоритм 3.3.6)
# ============================================================

class GameplaySequenceStep(BaseModel):
    """Шаг моделируемой последовательности геймплея."""
    step_number: int = Field(..., description="Номер шага")
    action: str = Field(..., description="Действие игрока")
    mechanics_used: list[str] = Field(
        default_factory=list,
        description="Задействованные механики",
    )
    resources_consumed: list[str] = Field(
        default_factory=list,
        description="Потреблённые ресурсы",
    )
    resources_produced: list[str] = Field(
        default_factory=list,
        description="Произведённые ресурсы",
    )


class ResourceFlow(BaseModel):
    """Поток ресурсов в моделируемом геймплее."""
    source: str = Field(..., description="Источник ресурса")
    target: str = Field(..., description="Получатель ресурса")
    resource: str = Field(..., description="Название ресурса")
    flow_type: str = Field(
        "production",
        description="Тип: production/consumption/conversion/exchange",
    )


class FeedbackLoop(BaseModel):
    """Петля обратной связи в моделируемом геймплее."""
    loop_type: str = Field(
        ...,
        description="Тип: positive (усиливающая) / negative (балансирующая)",
    )
    description: str = Field(..., description="Описание петли ОС")
    mechanics_involved: list[str] = Field(
        default_factory=list,
        description="Механики, формирующие петлю",
    )
    stability: str = Field(
        "stable",
        description="Стабильность: stable/runaway/damping/oscillating",
    )


class StabilityCheck(BaseModel):
    """Проверка устойчивости симуляции геймплея."""
    stable: bool = Field(True, description="Стабильна ли симуляция")
    pathology: str = Field(
        "",
        description="Обнаруженная патология: runaway/deadlock/stall/none",
    )
    correction: str = Field(
        "",
        description="Корректирующее действие при нестабильности",
    )
    details: str = Field("", description="Подробности проверки")


class ClassicMDAResult(BaseModel):
    """
    Результат Classic MDA аналитического прохода — Этап 4 (алгоритм 3.3.6).

    Выполняет обратный проход: Механики → Геймплей → Опыт.
    Сравнивает предсказанную эстетику с целевой и проверяет сходимость.
    """
    # Смоделированный геймплей
    gameplay_sequence: list[GameplaySequenceStep] = Field(
        default_factory=list,
        description="Последовательность действий игрока (5-10 шагов)",
    )
    resource_flows: list[ResourceFlow] = Field(
        default_factory=list,
        description="Потоки ресурсов между действиями",
    )
    feedback_loops: list[FeedbackLoop] = Field(
        default_factory=list,
        description="Петли обратной связи (positive/negative)",
    )

    # Наблюдаемые динамики (из симуляции)
    observed_dynamics: list[str] = Field(
        default_factory=list,
        description="Динамики, наблюдаемые в симулированном геймплее",
    )

    # Предсказанная эстетика
    predicted_aesthetics: dict[str, float] = Field(
        default_factory=dict,
        description="Предсказанная эстетика → уверенность (0-1)",
    )

    # Сравнение с целевой эстетикой
    match_scores: dict[str, float] = Field(
        default_factory=dict,
        description="Совпадение с целевой эстетикой: эстетика → score (0-1)",
    )
    overall_match: float = Field(
        0.0,
        description="Общая сходимость (0-1), среднее по match_scores",
    )
    converged: bool = Field(
        False,
        description="Достигнута ли сходимость (overall_match >= threshold)",
    )

    # Устойчивость симуляции
    stability: Optional[StabilityCheck] = Field(
        None,
        description="Проверка устойчивости Machinations-модели",
    )

    # Описание геймплея (для GDD)
    gameplay_script: str = Field(
        "",
        description="Текстовое описание смоделированного геймплея",
    )

    # Итерации
    iterations: int = Field(
        1,
        description="Количество итераций для сходимости",
    )

    # Предупреждения и рекомендации
    warnings: list[str] = Field(
        default_factory=list,
        description="Предупреждения о несходимости эстетик",
    )
    suggestions: list[str] = Field(
        default_factory=list,
        description="Рекомендации по корректировке набора механик",
    )


# ============================================================
# ЭТАП 5: ВАЛИДАЦИЯ ЧЕРЕЗ ЛИНЗЫ ШЕЛЛА (алгоритм 3.3.7)
# ============================================================

class LensResult(BaseModel):
    """Результат применения одной линзы Шелла."""
    lens_id: int = Field(..., description="ID линзы (1-113)")
    lens_name: str = Field(..., description="Название линзы")
    questions_asked: list[str] = Field(
        default_factory=list,
        description="Вопросы, заданные линзой",
    )
    answers: list[str] = Field(
        default_factory=list,
        description="Ответы на вопросы линзы",
    )
    score: float = Field(
        0.5,
        description="Оценка по линзе (0.0–1.0)",
    )
    issues_found: list[str] = Field(
        default_factory=list,
        description="Обнаруженные проблемы",
    )
    suggestions: list[str] = Field(
        default_factory=list,
        description="Рекомендации по улучшению",
    )


class LensValidation(BaseModel):
    """
    Результат валидации через Линзы Шелла — Этап 5 (алгоритм 3.3.7).

    Применяет 9 приоритетных линз Шелла к набору механик.
    """
    results: list[LensResult] = Field(
        default_factory=list,
        description="Результаты по каждой линзе",
    )
    critical_issues: list[LensResult] = Field(
        default_factory=list,
        description="Линзы с score < 0.4 (критические проблемы)",
    )
    warnings: list[LensResult] = Field(
        default_factory=list,
        description="Линзы с score 0.4–0.7 (предупреждения)",
    )
    passed_count: int = Field(
        0,
        description="Количество линз со score >= 0.7",
    )
    total_count: int = Field(
        0,
        description="Общее количество применённых линз",
    )
    overall_score: float = Field(
        0.0,
        description="Средний score по всем линзам (0-1)",
    )


# ============================================================
# ЭТАП 6: МАТРИЦА 4×3 БОНДА + ЛУДОНАРРАТИВНЫЙ АНАЛИЗ (алгоритм 3.3.8)
# ============================================================

class BondMatrixCell(BaseModel):
    """Ячейка матрицы 4×3 Бонда."""
    element: str = Field(
        ...,
        description="Элемент: Механика/История/Эстетика/Технология",
    )
    level: str = Field(
        ...,
        description="Уровень: Фиксированный/Динамический/Культурный",
    )
    content: str = Field(
        "",
        description="Описание содержимого ячейки",
    )


class RowConsistency(BaseModel):
    """Согласованность одной строки матрицы (горизонтальная)."""
    level: str = Field(
        ...,
        description="Уровень: Фиксированный/Динамический/Культурный",
    )
    score: float = Field(
        0.0,
        description="Score согласованности (0-1)",
    )
    dissonances: list[dict] = Field(
        default_factory=list,
        description="Обнаруженные рассогласования [{element_a, element_b, reason}]",
    )


class ColumnConsistency(BaseModel):
    """Согласованность одного столбца матрицы (вертикальная)."""
    element: str = Field(
        ...,
        description="Элемент: Механика/История/Эстетика/Технология",
    )
    score: float = Field(
        0.0,
        description="Score согласованности (0-1)",
    )
    description: str = Field(
        "",
        description="Описание логической последовательности уровней",
    )


class LudonarrativeCheck(BaseModel):
    """Результат проверки лудонарративного диссонанса."""
    result: str = Field(
        "Гармония",
        description="Результат: Гармония / Ирония / Диссонанс",
    )
    description: str = Field(
        "",
        description="Описание обнаруженного соответствия или диссонанса",
    )
    mechanic_narrative_pairs: list[dict] = Field(
        default_factory=list,
        description="Пары «механика ↔ нарратив» с оценкой согласованности",
    )
    correction: str = Field(
        "",
        description="Рекомендуемая коррекция (при диссонансе)",
    )


class BondValidation(BaseModel):
    """
    Результат валидации через Матрицу 4×3 Бонда — Этап 6 (алгоритм 3.3.8).

    Проверяет согласованность механики, истории, эстетики и технологии
    на трёх уровнях (фиксированный, динамический, культурный).
    """
    matrix: list[BondMatrixCell] = Field(
        default_factory=list,
        description="Заполненная матрица 4×3 (12 ячеек)",
    )
    row_consistency: list[RowConsistency] = Field(
        default_factory=list,
        description="Согласованность по строкам (горизонтальная)",
    )
    col_consistency: list[ColumnConsistency] = Field(
        default_factory=list,
        description="Согласованность по столбцам (вертикальная)",
    )
    ludonarrative: Optional[LudonarrativeCheck] = Field(
        None,
        description="Проверка лудонарративного диссонанса (Механика ↔ История)",
    )
    overall_consistency: float = Field(
        0.0,
        description="Общая согласованность (0-1), среднее по строкам и столбцам",
    )


# ============================================================
# ИТОГОВЫЙ ПРОФИЛЬ MDA — ЭТАПЫ 1-6 (алгоритм 3.3)
# ============================================================

class MDAProfile(BaseModel):
    """
    MDA-профиль — результат Этапов 1–6 алгоритма 3.3.

    Включает:
    - aesthetic_profile: целевая эстетика (из алгоритма 3.1 / ввод)
    - dynamics_target: целевые динамики (Этап 1)
    - mechanic_candidate_set: набор кандидатов (Этап 2)
    - mechanic_set: структурированный набор механик (Этап 3)
    - classic_mda_result: аналитический проход (Этап 4)
    - lens_validation: валидация через Линзы Шелла (Этап 5)
    - bond_validation: матрица 4×3 Бонда + лудонарративный анализ (Этап 6)
    - balance_input: данные для алгоритма 3.4
    """
    # Целевая модель (Этапы 1–3)
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

    # Аналитическая модель (Этап 4)
    classic_mda_result: Optional[ClassicMDAResult] = Field(
        None,
        description="Результат Classic MDA аналитического прохода (Этап 4)",
    )

    # Валидация (Этап 5)
    lens_validation: Optional[LensValidation] = Field(
        None,
        description="Результат валидации через Линзы Шелла (Этап 5)",
    )

    # Валидация (Этап 6)
    bond_validation: Optional[BondValidation] = Field(
        None,
        description="Результат матрицы 4×3 Бонда + лудонарративный анализ (Этап 6)",
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
