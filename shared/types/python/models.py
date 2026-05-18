"""
Gidede — Shared Pydantic Models (Python)
Фаза 4.A.12: Shared-модели и типы

Pydantic-модели, синхронизированные с TypeScript-интерфейсами.
Источник: алгоритмы 3.1–3.10
"""

from pydantic import BaseModel, Field
from typing import Optional
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


class CoreLoopCandidate(BaseModel):
    name: str = ""
    steps: list[str] = Field(default_factory=list)
    loop_type: LoopStructuralType = LoopStructuralType.ENGINE
    fun_check_reasoning: str = ""
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
    id: str = ""
    name: str = ""
    type: BalanceObjectType = BalanceObjectType.CHARACTER
    attributes: dict[str, float] = Field(default_factory=dict)
    cost: Optional[float] = None
    tier: Optional[int] = None
    tags: list[str] = Field(default_factory=list)


class CostPowerCurve(BaseModel):
    object_id: str = ""
    object_name: str = ""
    cost: float = 0.0
    power: float = 0.0
    ratio: float = 0.0
    deviation_from_anchor: float = 0.0
    status: str = "balanced"


class TransitiveResult(BaseModel):
    anchor: str = ""
    cost_power_curves: list[CostPowerCurve] = Field(default_factory=list)
    overpowered: list[str] = Field(default_factory=list)
    underpowered: list[str] = Field(default_factory=list)
    balanced: list[str] = Field(default_factory=list)


class MonteCarloResult(BaseModel):
    iterations: int = 0
    win_rates: dict[str, float] = Field(default_factory=dict)
    win_rate_spread: float = 0.0
    ranking_correlation: float = 0.0
    average_duration: float = 0.0


class CorrectionProposal(BaseModel):
    object_id: str = ""
    attribute: str = ""
    current_value: float = 0.0
    suggested_value: float = 0.0
    reason: str = ""


class BalanceResult(BaseModel):
    balance_type: BalanceType = BalanceType.MIXED
    objects: list[BalanceObject] = Field(default_factory=list)
    transitive_result: Optional[TransitiveResult] = None
    intransitive_result: Optional[dict] = None
    situational_result: Optional[dict] = None
    feedback_stability: Optional[dict] = None
    pathology_report: Optional[PathologyReport] = None
    monte_carlo_result: Optional[MonteCarloResult] = None
    overall_balance_score: float = 0.0
    critical_issues: list[Issue] = Field(default_factory=list)
    warnings: list[Issue] = Field(default_factory=list)
    suggestions: list[Suggestion] = Field(default_factory=list)
    formulas: dict = Field(default_factory=dict)


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
# PROJECT STATE — ЕДИНАЯ МОДЕЛЬ ПРОЕКТА (алгоритм 3.10)
# ============================================================

class ProjectState(BaseModel):
    """Единая модель проекта — источник истины для всех блоков."""
    id: str = ""
    name: str = ""
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    version: int = 1

    concept: Optional[dict] = None
    core_loop: Optional[dict] = None
    mda_profile: Optional[dict] = None
    balance: Optional[dict] = None
    progression: Optional[dict] = None
    economy: Optional[dict] = None
    gdd: Optional[dict] = None
    validation: Optional[dict] = None

    project_stage: ProjectStageName = ProjectStageName.CONCEPT
    completion_percent: int = 0
    last_algorithm_run: str = ""
