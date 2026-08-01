"""
Gidede — Shared Pydantic Models (Python)
Фаза 4.A.12: Shared-модели и типы

Pydantic-модели, синхронизированные с TypeScript-интерфейсами.
Источник: алгоритмы 3.1–3.10
"""

from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import datetime

from .enums import *


# ============================================================
# БЛОК 1: КОНЦЕПЦИЯ (алгоритм 3.1)
# ============================================================

class ConstraintsInput(BaseModel):
    team_size: Optional[int] = Field(None, description="Размер команды")
    budget: Optional[BudgetLevel] = Field(None, description="Бюджет")
    timeline: Optional[str] = Field(None, description="Срок разработки")
    monetization: Optional[str] = Field(None, description="Модель монетизации")
    scope: Optional[ScopeLevel] = Field(None, description="Масштаб")


class AudienceInput(BaseModel):
    primary: list[YeeMotivation] = Field(..., description="Мотивации по модели Йи (1-3)")
    experience: ExperienceLevel = Field(..., description="Уровень опыта")
    bartle_type: Optional[BartleType] = Field(None, description="Тип Бартла")


class ExplicitGenreInput(BaseModel):
    type: str = Field("explicit", literal=True)
    genre: Genre


class AutoGenreInput(BaseModel):
    type: str = Field("auto", literal=True)


class ExploreGenreInput(BaseModel):
    type: str = Field("explore", literal=True)
    options: list[Genre]


class ConceptInput(BaseModel):
    idea: str = Field(..., min_length=1, description="Текстовое описание идеи")
    genre: dict = Field(..., description="Жанр (explicit/auto/explore)")
    target_audience: Optional[AudienceInput] = None
    platform: Optional[list[Platform]] = None
    constraints: Optional[ConstraintsInput] = None
    reference_games: Optional[list[str]] = None
    aesthetic_focus: Optional[list[AestheticType]] = None
    forbidden_mechanics: Optional[list[str]] = None


class AestheticProfile(BaseModel):
    primary: AestheticType
    secondary: AestheticType
    tertiary: AestheticType
    rationale: str = ""


class DynamicsProfile(BaseModel):
    core_dynamics: list[str] = Field(default_factory=list)
    supporting_dynamics: list[str] = Field(default_factory=list)
    emergence_potential: EmergencePotential = EmergencePotential.NONE
    rationale: str = ""


class MechanicSet(BaseModel):
    base: list[str] = Field(default_factory=list)
    combat: list[str] = Field(default_factory=list)
    progression: list[str] = Field(default_factory=list)
    spatial: list[str] = Field(default_factory=list)
    social: list[str] = Field(default_factory=list)
    total_count: int = 0
    conflicts_resolved: list[str] = Field(default_factory=list)
    synergies_detected: list[str] = Field(default_factory=list)
    compatibility_score: float = 0.0


class FunTestMetric(BaseModel):
    id: Literal["loop_completion_rate", "voluntary_replay_rate", "critical_confusion_rate"]
    description: str = ""
    comparator: Literal[">=", "<="]
    target: float = 0.0


class FunTestProtocol(BaseModel):
    duration_seconds: int = 30
    minimum_participants: int = 5
    task: str = ""
    metrics: list[FunTestMetric] = Field(default_factory=list)
    decision_rule: str = ""


class FunHypothesisEvidence(BaseModel):
    playtest_id: str = ""
    recorded_at: str = ""
    participant_count: int = 0
    metric_results: dict[str, float] = Field(default_factory=dict)


class FunHypothesis(BaseModel):
    status: Literal["unverified", "supported", "rejected"] = "unverified"
    statement: str = ""
    test_protocol: FunTestProtocol = Field(default_factory=FunTestProtocol)
    evidence: list[FunHypothesisEvidence] = Field(default_factory=list)


class CoreLoopCandidate(BaseModel):
    name: str = ""
    steps: list[str] = Field(default_factory=list)
    loop_type: LoopStructuralType = LoopStructuralType.ENGINE
    fun_hypothesis: FunHypothesis = Field(default_factory=FunHypothesis)
    estimated_duration_seconds: int = 30


class USPCandidate(BaseModel):
    usp: str = ""
    triangle_of_weirdness_check: str = "pass"
    competitive_differentiation: str = ""


class FilterResult(BaseModel):
    score: float = 0.0
    reason: str = ""
    improvement: str = ""


class ValidationReport(BaseModel):
    triangle_check: dict = Field(default_factory=dict)
    five_questions: dict = Field(default_factory=dict)
    eight_filters: dict = Field(default_factory=dict)
    overall_score: float = 0.0
    warnings: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)


class OnePager(BaseModel):
    title: str = ""
    platform: list = Field(default_factory=list)
    target_audience: str = ""
    rating: str = ""
    story_synopsis: str = ""
    gameplay_description: str = ""
    unique_features: list[str] = Field(default_factory=list)
    competitors: list[str] = Field(default_factory=list)
    aesthetic_profile: Optional[AestheticProfile] = None
    dynamics_profile: Optional[DynamicsProfile] = None
    mechanic_set: Optional[MechanicSet] = None
    core_loop: Optional[CoreLoopCandidate] = None
    usp: str = ""
    validation_report: Optional[ValidationReport] = None
    loop_type: LoopStructuralType = LoopStructuralType.ENGINE
    compatibility_score: float = 0.0
    uniqueness_score: float = 0.0


# ============================================================
# БЛОК 2: CORE LOOP (алгоритм 3.2)
# ============================================================

class CoreLoopStep(BaseModel):
    action: str = ""
    mechanics: list[str] = Field(default_factory=list)
    resources_consumed: list[str] = Field(default_factory=list)
    resources_produced: list[str] = Field(default_factory=list)
    feedback_type: str = "positive"
    duration_estimate: float = 0.0


class ResourceProfile(BaseModel):
    name: str = ""
    class_: str = Field("", alias="class")
    type: ResourceType = ResourceType.CORE
    initial_value: float = 0.0
    bounds: dict = Field(default_factory=lambda: {"min": 0, "max": 100})


class RiskProfile(BaseModel):
    likely_pathologies: list[str] = Field(default_factory=list)
    risk_level: str = "low"
    mitigation_suggestions: list[str] = Field(default_factory=list)


class StructuralType(BaseModel):
    type: LoopStructuralType = LoopStructuralType.ENGINE
    sub_type: str = ""
    resources: list[dict] = Field(default_factory=list)
    loops: list[dict] = Field(default_factory=list)
    has_braking: bool = False
    currencies: list[str] = Field(default_factory=list)
    risk_assessment: Optional[RiskProfile] = None


class PathologyReport(BaseModel):
    pathologies: list[dict] = Field(default_factory=list)
    total_count: int = 0
    critical_count: int = 0


class CoreLoopProfile(BaseModel):
    structural_type: Optional[StructuralType] = None
    steps: list[CoreLoopStep] = Field(default_factory=list)
    inner_loops: list[dict] = Field(default_factory=list)
    outer_loops: list[dict] = Field(default_factory=list)
    meta_loop: Optional[dict] = None
    pathologies: Optional[PathologyReport] = None
    recommendations: list[dict] = Field(default_factory=list)
    loop_hierarchy: Optional[dict] = None
    validation: Optional[dict] = None


# ============================================================
# БЛОК 3: MDA (алгоритм 3.3)
# ============================================================

class GenreProfile(BaseModel):
    name: Genre = Genre.RPG
    subgenre: Optional[str] = None
    typical_aesthetics: list[AestheticType] = Field(default_factory=list)
    typical_mechanics: list[str] = Field(default_factory=list)
    typical_core_loops: list[str] = Field(default_factory=list)
    audience_profile: Optional[AudienceInput] = None
    conventions: list[str] = Field(default_factory=list)


class LensResult(BaseModel):
    lens_name: str = ""
    lens_number: int = 0
    score: float = 0.0
    question: str = ""
    answer: str = ""
    suggestions: list[str] = Field(default_factory=list)


class LensValidation(BaseModel):
    lenses_applied: int = 0
    results: list[LensResult] = Field(default_factory=list)
    overall_score: float = 0.0


class BondValidation(BaseModel):
    matrix: list[list[str]] = Field(default_factory=list)
    horizontal_consistency: float = 0.0
    vertical_consistency: float = 0.0
    ludonarrative_dissonance: list[str] = Field(default_factory=list)
    overall_score: float = 0.0


class MachinationsNode(BaseModel):
    id: str = ""
    type: str = "pool"
    label: str = ""
    value: Optional[float] = None


class MachinationsEdge(BaseModel):
    from_: str = Field("", alias="from")
    to: str = ""
    type: str = "flow"
    label: Optional[str] = None
    value: Optional[float] = None


class MachinationsGraph(BaseModel):
    nodes: list[MachinationsNode] = Field(default_factory=list)
    edges: list[MachinationsEdge] = Field(default_factory=list)
    resources: list[str] = Field(default_factory=list)


class Issue(BaseModel):
    id: str = ""
    severity: str = "info"
    category: str = ""
    description: str = ""
    source: str = ""


class Suggestion(BaseModel):
    id: str = ""
    priority: str = "medium"
    description: str = ""
    effort: str = "moderate"
    related_issues: list[str] = Field(default_factory=list)


class MDAProfile(BaseModel):
    aesthetic_profile: Optional[AestheticProfile] = None
    dynamics_target: Optional[dict] = None
    mechanic_set: Optional[dict] = None
    observed_dynamics: list[str] = Field(default_factory=list)
    predicted_aesthetics: dict[str, float] = Field(default_factory=dict)
    match_scores: dict[str, float] = Field(default_factory=dict)
    overall_match: float = 0.0
    lens_validation: Optional[LensValidation] = None
    bond_validation: Optional[BondValidation] = None
    machinations_model: Optional[MachinationsGraph] = None
    gameplay_script: str = ""
    iterations_required: int = 0
    converged: bool = False
    issues: list[Issue] = Field(default_factory=list)
    suggestions: list[Suggestion] = Field(default_factory=list)


# ============================================================
# БЛОК 4: БАЛАНС (алгоритм 3.4)
# ============================================================

class BalanceObject(BaseModel):
    """Игровой объект для балансировки."""
    id: str = Field("", description="Уникальный идентификатор объекта")
    name: str = Field("", description="Название объекта")
    type: str = Field("", description="Тип: character/weapon/unit/ability/item/class")
    attributes: dict[str, float] = Field(default_factory=dict, description="Атрибуты: HP, damage, speed, etc.")
    cost: Optional[float] = Field(None, description="Стоимость")
    tier: Optional[int] = Field(None, description="Уровень/тир (1-10)")
    tags: list[str] = Field(default_factory=list, description="Теги")


class BalanceInput(BaseModel):
    """Входные данные для балансировки (алгоритм 3.4.2)."""
    objects: list[BalanceObject] = Field(default_factory=list, description="Список объектов")
    resources: list[dict] = Field(default_factory=list, description="Ресурсные профили")
    balance_type: str = Field("mixed", description="transitive/intransitive/situational/mixed")
    game_mode: str = Field("PvE", description="PvP/PvE/PvPvE")
    target_duration: Optional[float] = Field(None, description="Целевая длительность (с)")
    target_levels: Optional[int] = Field(None, description="Целевое количество уровней")
    anchor_resource: Optional[str] = Field(None, description="Якорный ресурс")
    genre: str = Field("", description="Жанр игры")


class ObjectBalanceReport(BaseModel):
    """Отчёт по одному объекту — результат transitive-анализа."""
    name: str = ""
    power: float = 0.0
    effective_cost: float = 0.0
    cp_ratio: float = 0.0
    distance_from_curve: float = 0.0
    status: str = "balanced"


class TransitiveResult(BaseModel):
    """Результат транзитивного анализа — Этап 2."""
    attribute_weights: dict[str, float] = Field(default_factory=dict)
    cost_curve_model: str = "identity"
    expected_cp: float = 1.0
    objects: list[ObjectBalanceReport] = Field(default_factory=list)
    overpowered: list[str] = Field(default_factory=list)
    underpowered: list[str] = Field(default_factory=list)
    balanced: list[str] = Field(default_factory=list)
    ideal_imbalance: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)


class BalanceMap(BaseModel):
    """Карта балансировки — результат Этапа 1."""
    primary_model: str = "transitive"
    secondary_model: str = ""
    anchor: str = "gold"
    game_sum: str = "positive"
    feedback: str = "balancing"
    macro_model: Optional[dict] = None
    applicable_balance_types: dict[str, bool] = Field(default_factory=dict)


class StrategyBalanceScore(BaseModel):
    """Метрики баланса стратегий."""
    entropy: float = 0.0
    max_share: float = 0.0
    gini: float = 0.0


class RPSCycle(BaseModel):
    """Нетранзитивный цикл (Rock-Paper-Scissors)."""
    cycle: list[str] = Field(default_factory=list)
    strength: float = 0.0


class IntransitiveResult(BaseModel):
    """Результат нетранзитивного анализа — Этап 3."""
    payoff_matrix: list[list[float]] = Field(default_factory=list)
    object_names: list[str] = Field(default_factory=list)
    nash_equilibrium: list[float] = Field(default_factory=list)
    is_intransitive: bool = False
    dominated_strategies: list[int] = Field(default_factory=list)
    strategy_balance: Optional[StrategyBalanceScore] = None
    rps_cycles: list[RPSCycle] = Field(default_factory=list)
    has_dominant_strategy: bool = False
    warnings: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)


class Situation(BaseModel):
    """Игровая ситуация."""
    name: str = ""
    probability: float = 0.0


class VersatilityInfo(BaseModel):
    """Универсальность/специализация объекта."""
    max_value: float = 0.0
    min_value: float = 0.0
    spread: float = 0.0
    type: str = "universal"


class SituationalResult(BaseModel):
    """Результат ситуационного анализа — Этап 4."""
    situations: list[Situation] = Field(default_factory=list)
    situational_values: list[list[float]] = Field(default_factory=list)
    object_names: list[str] = Field(default_factory=list)
    situational_ev: list[float] = Field(default_factory=list)
    versatility_map: list[VersatilityInfo] = Field(default_factory=list)
    dead_zones: list[str] = Field(default_factory=list)
    dominant_universals: list[str] = Field(default_factory=list)
    switching_cost: str = "medium"
    warnings: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)


class QFactorObject(BaseModel):
    """Q-фактор анализ одного объекта."""
    name: str = ""
    dominant_attributes: list[str] = Field(default_factory=list)
    is_redundant: bool = False
    redundancy_score: float = 0.0


class QFactorResult(BaseModel):
    """Результат Q-фактор анализа (Роллингс/Моррис)."""
    objects: list[QFactorObject] = Field(default_factory=list)
    redundant_objects: list[str] = Field(default_factory=list)
    attribute_dominance: dict[str, str] = Field(default_factory=dict)
    q_matrix: list[list[float]] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)


class StabilityAnalysis(BaseModel):
    """Результат анализа устойчивости (Schreiber)."""
    overall_stability: str = "stable"
    pathology_risks: list[str] = Field(default_factory=list)
    analysis: list[dict] = Field(default_factory=list)
    positive_loops: int = 0
    negative_loops: int = 0
    recommendations: list[str] = Field(default_factory=list)


class SimulationConfig(BaseModel):
    """Конфигурация Monte Carlo-симуляции."""
    num_iterations: int = 10000
    matchup_format: str = "1v1"
    random_seed: int = 42
    logging_level: str = "summary"


class MatchupData(BaseModel):
    """Результат парного сравнения."""
    wins_a: int = 0
    wins_b: int = 0
    draws: int = 0
    avg_duration: float = 0.0


class NumberFormatReport(BaseModel):
    """Оценка эмоционального восприятия чисел."""
    light_numbers: list[str] = Field(default_factory=list)
    heavy_numbers: list[str] = Field(default_factory=list)
    assessment: str = ""


class MonteCarloResult(BaseModel):
    """Результат Monte Carlo-симуляции — Этап 6."""
    config: Optional[SimulationConfig] = None
    win_rates: dict[str, float] = Field(default_factory=dict)
    avg_duration: dict[str, float] = Field(default_factory=dict)
    matchup_matrix: dict[str, dict[str, dict]] = Field(default_factory=dict)
    win_rate_spread: float = 0.0
    ranking_correlation: float = 0.0
    number_format: Optional[NumberFormatReport] = None
    balance_verdict: str = "GOOD"
    warnings: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)


class MachinationsSimResult(BaseModel):
    """Результат Machinations-симуляции — Этап 7."""
    config: Optional[dict] = None
    graph: Optional[dict] = None
    runs: int = 0
    aggregated: Optional[dict] = None
    quality: Optional[dict] = None
    snapshots: list[dict] = Field(default_factory=list)
    detected_pathologies: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)


class BalanceResult(BaseModel):
    """Итоговый результат балансировки — алгоритм 3.4."""
    balance_map: Optional[BalanceMap] = None
    transitive_result: Optional[TransitiveResult] = None
    stability: Optional[StabilityAnalysis] = None
    intransitive_result: Optional[IntransitiveResult] = None
    situational_result: Optional[SituationalResult] = None
    q_factor_result: Optional[QFactorResult] = None
    monte_carlo_result: Optional[MonteCarloResult] = None
    machinations_result: Optional[MachinationsSimResult] = None
    stages_completed: list[int] = Field(default_factory=list)
    latency_ms: int = 0
    models_used: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)


# ============================================================
# БЛОК 5: ПРОГРЕССИЯ (алгоритм 3.5)
# ============================================================

class Tier(BaseModel):
    level_range: list[int] = Field(default_factory=lambda: [1, 10])
    name: str = ""
    dominant_mechanic: str = ""
    balance_type: str = "mixed"
    scale: float = 1.0


class CurveSpec(BaseModel):
    type: str = "exponential"
    formula: str = ""
    parameters: dict[str, float] = Field(default_factory=dict)


class ProgressionCurves(BaseModel):
    xp_to_level: Optional[CurveSpec] = None
    level_to_power: Optional[CurveSpec] = None
    level_to_cost: Optional[CurveSpec] = None
    difficulty: Optional[CurveSpec] = None


class ProgressionProfile(BaseModel):
    macro_model: Optional[dict] = None
    tier_model: Optional[dict] = None
    curves: Optional[ProgressionCurves] = None
    content_plan: Optional[dict] = None
    economy_link: Optional[dict] = None
    validation: Optional[dict] = None
    total_levels: int = 0
    total_duration: float = 0.0
    progression_type: ProgressionType = ProgressionType.LINEAR
    emergence_ratio: float = 0.0
    lock_key_model: str = ""
    summary: dict = Field(default_factory=dict)


# ============================================================
# БЛОК 5: ЭКОНОМИКА (алгоритм 3.6)
# ============================================================

class ResourceDefinition(BaseModel):
    name: str = ""
    type: ResourceType = ResourceType.CORE
    class_: str = Field("", alias="class")
    bounds: dict = Field(default_factory=lambda: {"min": 0, "max": 100})
    initial_value: float = 0.0


class EconomyPathology(BaseModel):
    name: str = ""
    type: str = "runaway"
    severity: str = "info"
    description: str = ""
    affected_resources: list[str] = Field(default_factory=list)
    correction: str = ""


class EconomyCorrection(BaseModel):
    pathology_id: str = ""
    type: str = "faucet_adjustment"
    description: str = ""
    before: dict[str, float] = Field(default_factory=dict)
    after: dict[str, float] = Field(default_factory=dict)


class MonetizationSpec(BaseModel):
    type: EconomyMonetizationType = EconomyMonetizationType.MIXED
    primary_revenue: list[str] = Field(default_factory=list)
    secondary_revenue: list[str] = Field(default_factory=list)
    ethical_concerns: list[str] = Field(default_factory=list)


class EconomyProfile(BaseModel):
    resources: Optional[dict] = None
    classification: Optional[dict] = None
    machinations_model: Optional[MachinationsGraph] = None
    conversion_graph: Optional[dict] = None
    diagnostics: Optional[dict] = None
    balanced_economy: Optional[dict] = None
    simulation: Optional[dict] = None
    economic_type: str = ""
    openness: str = ""
    pricing_type: str = ""
    detected_patterns: list[str] = Field(default_factory=list)
    monetization_model: Optional[MonetizationSpec] = None
    summary: dict = Field(default_factory=dict)


# ============================================================
# БЛОК 6: GDD (алгоритм 3.7)
# ============================================================

class GDDSection(BaseModel):
    id: str = ""
    title: str = ""
    content: str = ""
    source_algorithm: str = ""
    auto_filled: bool = False
    visual_elements: list[str] = Field(default_factory=list)


class ConsistencyIssue(BaseModel):
    id: str = ""
    severity: str = "info"
    section_a: str = ""
    section_b: str = ""
    description: str = ""
    resolution: str = ""


class CompletenessReport(BaseModel):
    total_sections: int = 0
    auto_filled: int = 0
    ai_generated: int = 0
    manual_filled: int = 0
    manual_pending: int = 0
    completeness_percent: float = 0.0


class GDDProfile(BaseModel):
    format: GDDFormat = GDDFormat.MODULAR
    detail_level: DetailLevel = DetailLevel.STANDARD
    target_audience: DocAudience = DocAudience.TEAM_SYNC
    generated_at: str = ""
    version: str = "1.0"
    sections: list[GDDSection] = Field(default_factory=list)
    visual_elements: dict = Field(default_factory=dict)
    cross_references: dict[str, list[str]] = Field(default_factory=dict)
    consistency_issues: list[ConsistencyIssue] = Field(default_factory=list)
    completeness: Optional[CompletenessReport] = None
    consistency_score: float = 0.0
    coverage_score: float = 0.0
    available_formats: list[str] = Field(default_factory=list)
    exported_files: list[str] = Field(default_factory=list)
    is_live: bool = False
    last_sync_at: str = ""
    sync_status: str = "synced"


# ============================================================
# БЛОК 6: ВАЛИДАЦИЯ / ЧЕК-ЛИСТЫ (алгоритм 3.8)
# ============================================================

class ValidationIssue(BaseModel):
    id: str = ""
    severity: str = "info"
    category: str = ""
    title: str = ""
    description: str = ""
    source: str = ""
    remediation: str = ""


class RemediationItem(BaseModel):
    issue_id: str = ""
    action: str = ""
    effort: str = "moderate"
    impact: str = "medium"


class MDACheckResult(BaseModel):
    mechanic_dynamics_coverage: float = 0.0
    dynamics_aesthetics_coverage: float = 0.0
    overall_mda_score: float = 0.0
    gaps: list[str] = Field(default_factory=list)


class BalanceCheckResult(BaseModel):
    overall_score: float = 0.0
    critical_imbalances: list[str] = Field(default_factory=list)
    transitive_ok: bool = True
    intransitive_ok: bool = True


class NarrativeCheckResult(BaseModel):
    ludonarrative_dissonance: list[str] = Field(default_factory=list)
    agency_score: float = 0.0
    structure_score: float = 0.0


class EconomyCheckResult(BaseModel):
    stable: bool = True
    pathologies: list[str] = Field(default_factory=list)
    faucet_drain_balanced: bool = True


class LensCheckResult(BaseModel):
    lenses_applied: int = 0
    overall_score: float = 0.0
    lowest_scoring: list[str] = Field(default_factory=list)


class ChecklistResult(BaseModel):
    overall_score: float = 0.0
    readiness_level: str = "draft"
    issues: list[ValidationIssue] = Field(default_factory=list)
    remediation_plan: list[RemediationItem] = Field(default_factory=list)
    mda_check: Optional[MDACheckResult] = None
    balance_check: Optional[BalanceCheckResult] = None
    narrative_check: Optional[NarrativeCheckResult] = None
    economy_check: Optional[EconomyCheckResult] = None
    lens_check: Optional[LensCheckResult] = None


# ============================================================
# PROJECT STATE — БЛОЧНЫЕ МОДЕЛИ (ISP, алгоритм 3.10)
# ============================================================

class ConceptBlock(BaseModel):
    """Блок 1: Концепция — жанр, аудитория, эстетика, механики."""
    genre: Optional[dict] = None
    target_audience: Optional[dict] = None
    platform: Optional[list] = None
    constraints: Optional[dict] = None
    one_pager: Optional[dict] = None
    usp: str = ""
    reference_games: list[str] = []
    aesthetic_profile: Optional[dict] = None
    dynamics_profile: Optional[dict] = None
    mechanic_set: Optional[dict] = None


class CoreLoopBlock(BaseModel):
    """Блок 2: Core Loop — структурный тип, петли, патологии."""
    structural_type: Optional[str] = None
    steps: Optional[list] = None
    inner_loops: Optional[list] = None
    outer_loops: Optional[list] = None
    meta_loop: Optional[dict] = None
    pathologies: Optional[dict] = None
    recommendations: Optional[list] = None
    loop_hierarchy: Optional[dict] = None


class MDAProfileBlock(BaseModel):
    """Блок 3: MDA-профиль — эстетика, динамика, валидация."""
    target_aesthetics: Optional[dict] = None
    target_dynamics: Optional[dict] = None
    mechanic_set: Optional[dict] = None
    observed_dynamics: Optional[list] = None
    predicted_aesthetics: Optional[dict] = None
    match_scores: Optional[dict] = None
    overall_match: Optional[float] = None
    lens_validation: Optional[dict] = None
    bond_validation: Optional[dict] = None
    machinations_model: Optional[dict] = None


class BalanceBlock(BaseModel):
    """Блок 4: Баланс — карты, анализ, симуляция."""
    balance_map: Optional[dict] = None
    transitive_result: Optional[dict] = None
    stability: Optional[dict] = None
    intransitive_result: Optional[dict] = None
    situational_result: Optional[dict] = None
    q_factor_result: Optional[dict] = None
    monte_carlo_result: Optional[dict] = None
    machinations_result: Optional[dict] = None
    stages_completed: list[int] = []
    latency_ms: int = 0
    models_used: list[str] = []
    warnings: list[str] = []
    suggestions: list[str] = []


class ProgressionBlock(BaseModel):
    """Блок 4.5: Прогрессия — макромодель, кривые, контент-план."""
    macro_model: Optional[dict] = None
    tier_model: Optional[dict] = None
    curves: Optional[dict] = None
    content_plan: Optional[dict] = None
    economy_link: Optional[dict] = None
    validation: Optional[dict] = None


class EconomyBlock(BaseModel):
    """Блок 5: Экономика — ресурсы, конверсии, симуляция, монетизация."""
    resource_model: Optional[dict] = None
    system_type: Optional[str] = None
    machinations_model: Optional[dict] = None
    conversion_chains: Optional[list] = None
    pathologies: Optional[list] = None
    corrections: Optional[list] = None
    simulation_results: Optional[dict] = None
    monetization_model: Optional[dict] = None


class GDDBlock(BaseModel):
    """Блок 6: GDD — генерация документации."""
    format: Optional[str] = None
    sections: Optional[list] = None
    visual_elements: Optional[dict] = None
    consistency_issues: Optional[list] = None
    completeness: Optional[dict] = None


class ValidationBlock(BaseModel):
    """Блок 7: Валидация — общая оценка и чеки."""
    overall_score: Optional[float] = None
    readiness_level: Optional[str] = None
    issues: Optional[list] = None
    remediation_plan: Optional[list] = None
    mda_check: Optional[dict] = None
    balance_check: Optional[dict] = None
    narrative_check: Optional[dict] = None
    economy_check: Optional[dict] = None
    lens_check: Optional[dict] = None


# ============================================================
# PROJECT STATE — СОСТАВНАЯ МОДЕЛЬ (алгоритм 3.10)
# ============================================================

class ProjectState(BaseModel):
    """Единая модель проекта — композит из блочных моделей (ISP)."""
    id: str = ""
    name: str = ""
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    version: int = 1

    concept: Optional[ConceptBlock] = None
    core_loop: Optional[CoreLoopBlock] = None
    mda_profile: Optional[MDAProfileBlock] = None
    balance: Optional[BalanceBlock] = None
    progression: Optional[ProgressionBlock] = None
    economy: Optional[EconomyBlock] = None
    gdd: Optional[GDDBlock] = None
    validation: Optional[ValidationBlock] = None

    project_stage: ProjectStageName = ProjectStageName.CONCEPT
    completion_percent: int = 0
    last_algorithm_run: str = ""
