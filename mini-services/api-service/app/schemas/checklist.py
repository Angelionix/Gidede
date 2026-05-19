"""
Gidede — Checklist Schemas (Pydantic Models)
Фаза 4.D.4: Схемы для Блока 6 — Чек-листы валидации (алгоритм 3.8)

Модели синхронизированы со спецификацией алгоритма 3.8.

Алгоритм 3.8 (7 этапов):
- Этап 1: Определение области валидации → ValidationScope (3.8.3)
- Этап 2: MDA-чек → MDACheckResult (3.8.4)
- Этап 3: Баланс-чек → BalanceCheckResult (3.8.5)
- Этап 4: Нарратив-чек → NarrativeCheckResult (3.8.6)
- Этап 5: Экономика-чек → EconomyCheckResult (3.8.7)
- Этап 6: Линзы Шелла → LensCheckResult (3.8.8)
- Этап 7: Агрегация, приоритизация, план ремедиации → ValidationResult (3.8.9)
"""

from pydantic import BaseModel, Field
from typing import Any, Optional, Literal


# ============================================================
# ТИПЫ ЧЕК-ЛИСТОВ (алгоритм 3.8.2)
# ============================================================

ChecklistType = Literal[
    'mda',          # MDA-чек: механика→динамика→эстетика полнота
    'balance',      # Баланс-чек: 12 типов баланса
    'narrative',    # Нарратив-чек: диссонанс, агентивность, структура
    'economy',      # Экономика-чек: патологии, faucet/drain
    'lenses',       # 113 линз Шелла: адаптивная выборка
]

FocusArea = Literal[
    'core_loop', 'mechanics', 'balance', 'progression',
    'economy', 'narrative', 'overall',
]

ProjectStage = Literal[
    'concept', 'prototype', 'preproduction', 'production', 'live_ops',
]

CheckDepth = Literal['surface', 'standard', 'deep', 'exhaustive', 'targeted']

IssueSeverity = Literal['critical', 'warning', 'info']

ReadinessLevel = Literal['ready', 'nearly_ready', 'needs_work', 'not_ready']

EffortLevel = Literal['low', 'medium', 'high']


# ============================================================
# ВХОДНЫЕ ДАННЫЕ (алгоритм 3.8.2)
# ============================================================

class ChecklistInput(BaseModel):
    """Входные данные для валидации геймдизайна (алгоритм 3.8)."""
    concept: Optional[dict] = Field(
        None,
        description="Концепт игры (из Блока 1): жанр, эстетика, платформа, ЦА",
    )
    core_loop: Optional[dict] = Field(
        None,
        description="Профиль Core Loop (из Блока 2): структурный тип, петли, ресурсы",
    )
    mda_profile: Optional[dict] = Field(
        None,
        description="MDA-профиль (из Блока 3): механики, динамики, эстетика",
    )
    balance_result: Optional[dict] = Field(
        None,
        description="Результат балансировки (из Блока 4): кривые cost-power",
    )
    progression_profile: Optional[dict] = Field(
        None,
        description="Профиль прогрессии (из Блока 5): кривые, тиры, контент-план",
    )
    economy_profile: Optional[dict] = Field(
        None,
        description="Профиль экономики (из Блока 5): ресурсы, Machinations, патологии",
    )
    gdd_profile: Optional[dict] = Field(
        None,
        description="Профиль GDD (из алгоритма 3.7, опционально)",
    )
    checklist_types: Optional[list[ChecklistType]] = Field(
        None,
        description="Какие чек-листы запустить. Если не указаны — определяются по стадии проекта.",
    )
    focus_areas: Optional[list[FocusArea]] = Field(
        None,
        description="Фокусные области валидации",
    )
    severity_threshold: IssueSeverity = Field(
        'warning',
        description="Минимальный уровень серьёзности проблем в отчёте: critical/warning/info",
    )
    max_issues: int = Field(
        100,
        description="Максимальное количество проблем в отчёте",
    )
    project_stage: Optional[ProjectStage] = Field(
        None,
        description="Стадия проекта: concept/prototype/preproduction/production/live_ops",
    )
    previous_validation: Optional[dict] = Field(
        None,
        description="Результаты предыдущей валидации (для трекинга прогресса)",
    )


# ============================================================
# ЭТАП 1: ОБЛАСТЬ ВАЛИДАЦИИ (алгоритм 3.8.3)
# ============================================================

class ValidationScope(BaseModel):
    """Область валидации — результат Этапа 1 (алгоритм 3.8.3)."""
    active_checklists: list[ChecklistType] = Field(
        default_factory=list,
        description="Активные чек-листы для запуска",
    )
    genre_checks: dict[str, Any] = Field(
        default_factory=dict,
        description="Жанр-специфичные параметры проверок",
    )
    depth: CheckDepth = Field(
        'standard',
        description="Глубина проверок: surface/standard/deep/exhaustive",
    )
    focus_areas: list[FocusArea] = Field(
        default_factory=list,
        description="Фокусные области валидации",
    )
    estimated_checks: int = Field(
        0,
        description="Ожидаемое количество проверок",
    )


# ============================================================
# ОБЩАЯ МОДЕЛЬ ПРОБЛЕМЫ
# ============================================================

class ValidationIssue(BaseModel):
    """Проблема валидации, найденная одним из чек-листов."""
    severity: IssueSeverity = Field(
        'warning',
        description="Серьёзность: critical/warning/info",
    )
    issue_type: str = Field(
        "",
        description="Тип проблемы: aesthetic_orphan, no_counter, ludonarrative_dissonance и т.д.",
    )
    area: FocusArea = Field(
        'overall',
        description="Область, к которой относится проблема",
    )
    description: str = Field(
        "",
        description="Описание проблемы",
    )
    suggestion: str = Field(
        "",
        description="Предложение по исправлению",
    )
    detected_by: list[str] = Field(
        default_factory=list,
        description="Какие чек-листы обнаружили проблему",
    )
    affected_algorithms: list[str] = Field(
        default_factory=list,
        description="На какие алгоритмы влияет (3.1–3.8)",
    )


# ============================================================
# ЭТАП 2: MDA-ЧЕК (алгоритм 3.8.4)
# ============================================================

class MDACheckResult(BaseModel):
    """Результат MDA-проверки — Этап 2 (алгоритм 3.8.4)."""
    issues: list[ValidationIssue] = Field(
        default_factory=list,
        description="Найденные проблемы MDA",
    )
    suggestions: list[str] = Field(
        default_factory=list,
        description="Рекомендации по улучшению MDA",
    )
    aesthetic_coverage: float = Field(
        0.0,
        description="Покрытие эстетик динамиками (0.0–1.0)",
    )
    completeness_score: float = Field(
        0.0,
        description="Полнота MDA-цепочки: механика→динамика→эстетика (0.0–1.0)",
    )
    bond_consistency_score: float = Field(
        0.0,
        description="Согласованность матрицы Бонда 4x3 (0.0–1.0)",
    )
    overall_mda_score: float = Field(
        0.0,
        description="Общая оценка MDA (0.0–1.0)",
    )
    skipped: bool = Field(
        False,
        description="Пропущен ли чек (нет данных MDA)",
    )
    skip_reason: str = Field(
        "",
        description="Причина пропуска",
    )


# ============================================================
# ЭТАП 3: БАЛАНС-ЧЕК (алгоритм 3.8.5)
# ============================================================

class BalanceScores(BaseModel):
    """Оценки по типам баланса."""
    transitive: float = Field(0.0, description="Transitive-баланс (0.0–1.0)")
    intransitive: float = Field(0.0, description="Intransitive-баланс (0.0–1.0)")
    difficulty: float = Field(0.0, description="Баланс сложности (0.0–1.0)")
    progression: float = Field(0.0, description="Баланс прогрессии (0.0–1.0)")
    economy: float = Field(0.0, description="Баланс экономики (0.0–1.0)")


class BalanceCheckResult(BaseModel):
    """Результат проверки баланса — Этап 3 (алгоритм 3.8.5)."""
    issues: list[ValidationIssue] = Field(
        default_factory=list,
        description="Найденные проблемы баланса",
    )
    suggestions: list[str] = Field(
        default_factory=list,
        description="Рекомендации по балансировке",
    )
    balance_scores: BalanceScores = Field(
        default_factory=BalanceScores,
        description="Оценки по типам баланса",
    )
    overall_balance_score: float = Field(
        0.0,
        description="Общая оценка баланса (0.0–1.0)",
    )
    checks_run: list[str] = Field(
        default_factory=list,
        description="Запущенные проверки баланса",
    )
    skipped: bool = Field(
        False,
        description="Пропущен ли чек",
    )
    skip_reason: str = Field(
        "",
        description="Причина пропуска",
    )


# ============================================================
# ЭТАП 4: НАРРАТИВ-ЧЕК (алгоритм 3.8.6)
# ============================================================

LudonarrativeLevel = Literal['harmony', 'irony', 'dissonance']


class NarrativeCheckResult(BaseModel):
    """Результат проверки нарратива — Этап 4 (алгоритм 3.8.6)."""
    issues: list[ValidationIssue] = Field(
        default_factory=list,
        description="Найденные нарративные проблемы",
    )
    ludonarrative_result: Optional[LudonarrativeLevel] = Field(
        None,
        description="Уровень лудонарративной согласованности: harmony/irony/dissonance",
    )
    ludonarrative_details: Optional[dict] = Field(
        None,
        description="Детали лудонарративного анализа (5 критериев)",
    )
    agency_score: float = Field(
        0.0,
        description="Оценка агентивности игрока (0.0–1.0)",
    )
    agency_gaps: list[str] = Field(
        default_factory=list,
        description="Пробелы в агентивности",
    )
    structure_score: float = Field(
        0.0,
        description="Оценка нарративной структуры (0.0–1.0)",
    )
    quest_variety_score: float = Field(
        0.0,
        description="Разнообразие квестов (0.0–1.0)",
    )
    overall_narrative_score: float = Field(
        0.0,
        description="Общая оценка нарратива (0.0–1.0)",
    )
    skipped: bool = Field(
        False,
        description="Пропущен ли чек (не нарративный жанр)",
    )
    skip_reason: str = Field(
        "",
        description="Причина пропуска",
    )


# ============================================================
# ЭТАП 5: ЭКОНОМИКА-ЧЕК (алгоритм 3.8.7)
# ============================================================

class QFactorInfo(BaseModel):
    """Информация о Q-факторе для ресурса."""
    resource_name: str = Field("", description="Название ресурса")
    q_factor: float = Field(0.0, description="Q = faucet/drain")
    status: Literal['balanced', 'inflation', 'scarcity'] = Field(
        'balanced',
        description="Статус: balanced/inflation/scarcity",
    )


class EconomyCheckResult(BaseModel):
    """Результат проверки экономики — Этап 5 (алгоритм 3.8.7)."""
    issues: list[ValidationIssue] = Field(
        default_factory=list,
        description="Найденные экономические проблемы",
    )
    suggestions: list[str] = Field(
        default_factory=list,
        description="Рекомендации по экономике",
    )
    runaway_detected: bool = Field(
        False,
        description="Обнаружен ли runaway (неограниченный рост)",
    )
    deadlock_detected: bool = Field(
        False,
        description="Обнаружен ли deadlock (тупик ресурсов)",
    )
    q_factors: list[QFactorInfo] = Field(
        default_factory=list,
        description="Q-факторы по ресурсам",
    )
    stability_test_passed: bool = Field(
        True,
        description="Пройден ли тест стабильности (4 стратегии)",
    )
    overall_economy_score: float = Field(
        0.0,
        description="Общая оценка экономики (0.0–1.0)",
    )
    skipped: bool = Field(
        False,
        description="Пропущен ли чек",
    )
    skip_reason: str = Field(
        "",
        description="Причина пропуска",
    )


# ============================================================
# ЭТАП 6: ЛИНЗЫ ШЕЛЛА (алгоритм 3.8.8)
# ============================================================

class LensResult(BaseModel):
    """Результат применения одной линзы Шелла."""
    lens_id: int = Field(
        0,
        description="Номер линзы (1–113)",
    )
    lens_name: str = Field(
        "",
        description="Название линзы",
    )
    key_question: str = Field(
        "",
        description="Ключевой вопрос линзы",
    )
    answer: str = Field(
        "",
        description="Ответ AI на вопрос линзы (2–5 предложений)",
    )
    score: float = Field(
        0.0,
        description="Оценка по линзе (0.0–1.0)",
    )
    issues: list[str] = Field(
        default_factory=list,
        description="Проблемы, выявленные через линзу",
    )
    suggestions: list[str] = Field(
        default_factory=list,
        description="Рекомендации по линзе",
    )


class LensCheckResult(BaseModel):
    """Результат проверки линзами Шелла — Этап 6 (алгоритм 3.8.8)."""
    applied_lenses: list[int] = Field(
        default_factory=list,
        description="Применённые номера линз",
    )
    results: list[LensResult] = Field(
        default_factory=list,
        description="Результаты по каждой линзе",
    )
    issues: list[ValidationIssue] = Field(
        default_factory=list,
        description="Найденные проблемы (агрегированные из линз)",
    )
    critical_count: int = Field(
        0,
        description="Количество критических проблем",
    )
    warning_count: int = Field(
        0,
        description="Количество предупреждений",
    )
    passed_count: int = Field(
        0,
        description="Количество линз, пройденных успешно (score >= 0.7)",
    )
    overall_lens_score: float = Field(
        0.0,
        description="Общая оценка по линзам (0.0–1.0)",
    )
    skipped: bool = Field(
        False,
        description="Пропущен ли чек",
    )
    skip_reason: str = Field(
        "",
        description="Причина пропуска",
    )


# ============================================================
# ЭТАП 7: РЕМЕДИАЦИЯ (алгоритм 3.8.9)
# ============================================================

class RemediationItem(BaseModel):
    """Пункт плана ремедиации."""
    issue_id: str = Field(
        "",
        description="ID проблемы (для связи с ValidationIssue)",
    )
    issue_description: str = Field(
        "",
        description="Описание проблемы",
    )
    correction: str = Field(
        "",
        description="Рекомендуемое исправление",
    )
    estimated_effort: EffortLevel = Field(
        'medium',
        description="Трудоёмкость: low (5-30 мин) / medium (1-4 часа) / high (4-40 часов)",
    )
    hours_estimate: float = Field(
        0.0,
        description="Оценка часов на исправление",
    )
    affected_algorithms: list[str] = Field(
        default_factory=list,
        description="На какие алгоритмы влияет",
    )
    blocking_issues: list[str] = Field(
        default_factory=list,
        description="Блокирующие проблемы (должны быть исправлены сначала)",
    )
    suggested_order: int = Field(
        0,
        description="Рекомендуемый порядок исправления (1 = первый)",
    )
    severity: IssueSeverity = Field(
        'warning',
        description="Серьёзность исходной проблемы",
    )


# ============================================================
# ИТОГОВЫЙ РЕЗУЛЬТАТ ВАЛИДАЦИИ (алгоритм 3.8.9)
# ============================================================

class ValidationSummary(BaseModel):
    """Сводка результатов валидации."""
    overall_score: int = Field(
        0,
        description="Общая оценка 0-100 (90+=Excellent, 70-89=Good, 50-69=Acceptable, 30-49=Needs work, 0-29=Not ready)",
    )
    readiness_level: ReadinessLevel = Field(
        'not_ready',
        description="Уровень готовности: ready/nearly_ready/needs_work/not_ready",
    )
    total_issues: int = Field(0, description="Всего проблем")
    critical_issues: int = Field(0, description="Критических проблем")
    warning_issues: int = Field(0, description="Предупреждений")
    info_issues: int = Field(0, description="Информационных замечаний")
    issues_by_area: dict[str, int] = Field(
        default_factory=dict,
        description="Количество проблем по областям",
    )
    estimated_remediation_hours: float = Field(
        0.0,
        description="Оценка часов на исправление всех проблем",
    )


# ============================================================
# ИТОГОВЫЙ ПРОФИЛЬ ВАЛИДАЦИИ (алгоритм 3.8.10)
# ============================================================

class ValidationProfile(BaseModel):
    """
    Полный профиль валидации — результат алгоритма 3.8 (Этапы 1–7).

    Включает:
    - scope: Область валидации (Этап 1)
    - mda_check: Результат MDA-проверки (Этап 2)
    - balance_check: Результат проверки баланса (Этап 3)
    - narrative_check: Результат проверки нарратива (Этап 4)
    - economy_check: Результат проверки экономики (Этап 5)
    - lens_check: Результат проверки линзами Шелла (Этап 6)
    - summary: Сводка результатов (Этап 7)
    - remediation_plan: План исправлений (Этап 7)
    - all_issues: Все проблемы, агрегированные из всех чек-листов
    - stages_completed: Завершённые этапы
    - latency_ms: Время выполнения
    """
    scope: ValidationScope = Field(
        default_factory=ValidationScope,
        description="Область валидации (Этап 1)",
    )
    mda_check: Optional[MDACheckResult] = Field(
        None,
        description="Результат MDA-проверки (Этап 2)",
    )
    balance_check: Optional[BalanceCheckResult] = Field(
        None,
        description="Результат проверки баланса (Этап 3)",
    )
    narrative_check: Optional[NarrativeCheckResult] = Field(
        None,
        description="Результат проверки нарратива (Этап 4)",
    )
    economy_check: Optional[EconomyCheckResult] = Field(
        None,
        description="Результат проверки экономики (Этап 5)",
    )
    lens_check: Optional[LensCheckResult] = Field(
        None,
        description="Результат проверки линзами Шелла (Этап 6)",
    )
    summary: ValidationSummary = Field(
        default_factory=ValidationSummary,
        description="Сводка результатов (Этап 7)",
    )
    remediation_plan: list[RemediationItem] = Field(
        default_factory=list,
        description="План исправлений (Этап 7)",
    )
    all_issues: list[ValidationIssue] = Field(
        default_factory=list,
        description="Все проблемы, агрегированные из всех чек-листов",
    )
    top_priority_issues: list[ValidationIssue] = Field(
        default_factory=list,
        description="Топ-5 самых приоритетных проблем",
    )
    quick_wins: list[ValidationIssue] = Field(
        default_factory=list,
        description="Проблемы с быстрой ремедиацией (effort=low, severity>=warning)",
    )
    gdd_update_required: bool = Field(
        False,
        description="Требуется ли обновление GDD по результатам валидации",
    )
    revalidation_recommended: bool = Field(
        False,
        description="Рекомендуется ли повторная валидация после исправлений",
    )
    stages_completed: list[int] = Field(
        default_factory=list,
        description="Завершённые этапы алгоритма 3.8",
    )
    latency_ms: int = Field(
        0,
        description="Время выполнения (мс)",
    )
    models_used: list[str] = Field(
        default_factory=list,
        description="Использованные AI-модели",
    )
