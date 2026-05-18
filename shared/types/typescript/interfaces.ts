/**
 * Gidede — Shared TypeScript Interfaces
 * Фаза 4.A.12: Shared-модели и типы
 *
 * Все типы данных, общие для frontend и backend.
 * Источник: алгоритмы 3.1–3.10
 *
 * Иерархия:
 *   Enums → Sub-types → Input types → Profile types → ProjectState
 */

import type {
  AestheticType, Genre, YeeMotivation, BartleType, Platform,
  LoopStructuralType, LoopSubType, EmergencePotential,
  BalanceType, BalanceObjectType, GameMode,
  ProgressionType, FlowTarget, ContentBudget,
  EconomyMonetizationType, EconomyOpenness, ResourceClass, ResourceType,
  GDDFormat, DocAudience, DetailLevel,
  ChecklistType, FocusArea,
  ProjectStageName, ProjectStatus, UserPlan, BudgetLevel, ScopeLevel,
  ExperienceLevel, ExportFormat, CitationStyle,
} from './enums';


// ============================================================
// БЛОК 1: КОНЦЕПЦИЯ (алгоритм 3.1)
// ============================================================

export interface ConceptInput {
  idea: string;
  genre: GenreInput;
  targetAudience?: AudienceInput;
  platform?: Platform[];
  constraints?: ConstraintsInput;
  referenceGames?: string[];
  aestheticFocus?: AestheticType[];
  forbiddenMechanics?: string[];
}

export type GenreInput =
  | { type: 'explicit'; genre: Genre }
  | { type: 'auto' }
  | { type: 'explore'; options: Genre[] };

export interface AudienceInput {
  primary: YeeMotivation[];
  experience: ExperienceLevel;
  bartleType?: BartleType;
}

export interface ConstraintsInput {
  teamSize?: number;
  budget?: BudgetLevel;
  timeline?: string;
  monetization?: string;
  scope?: ScopeLevel;
}

export interface AestheticProfile {
  primary: AestheticType;
  secondary: AestheticType;
  tertiary: AestheticType;
  rationale: string;
}

export interface DynamicsProfile {
  core_dynamics: string[];
  supporting_dynamics: string[];
  emergence_potential: EmergencePotential;
  rationale: string;
}

export interface MechanicSet {
  base: string[];
  combat: string[];
  progression: string[];
  spatial: string[];
  social: string[];
  total_count: number;
  conflicts_resolved: string[];
  synergies_detected: string[];
  compatibility_score: number;
}

export interface CoreLoopCandidate {
  name: string;
  steps: string[];
  loop_type: LoopStructuralType;
  fun_check_reasoning: string;
  estimated_duration_seconds: number;
}

export interface USPCandidate {
  usp: string;
  triangle_of_weirdness_check: 'pass' | 'warn';
  competitive_differentiation: string;
}

export interface ValidationReport {
  triangle_check: ValidationResult;
  five_questions: Record<string, boolean>;
  eight_filters: Record<string, FilterResult>;
  overall_score: number;
  warnings: string[];
  suggestions: string[];
}

export interface ValidationResult {
  passed: boolean;
  score: number;
  details: string;
}

export interface FilterResult {
  score: number;
  reason: string;
  improvement: string;
}

export interface OnePager {
  title: string;
  platform: Platform[];
  targetAudience: string;
  rating: string;

  storySynopsis: string;
  gameplayDescription: string;
  uniqueFeatures: string[];
  competitors: string[];

  aestheticProfile: AestheticProfile;
  dynamicsProfile: DynamicsProfile;
  mechanicSet: MechanicSet;
  coreLoop: CoreLoopCandidate;
  usp: string;
  validationReport: ValidationReport;

  loopType: LoopStructuralType;
  compatibilityScore: number;
  uniquenessScore: number;
}


// ============================================================
// БЛОК 2: CORE LOOP (алгоритм 3.2)
// ============================================================

export interface CoreLoopInput {
  concept: OnePager;
  initialCoreLoop?: CoreLoopCandidate;
  mechanics: MechanicSet;
  aestheticProfile: AestheticProfile;
  desiredLoopType?: LoopStructuralType;
  customSteps?: CoreLoopStep[];
}

export interface CoreLoopStep {
  action: string;
  mechanics: string[];
  resources_consumed: string[];
  resources_produced: string[];
  feedback_type: 'positive' | 'negative' | 'neutral';
  duration_estimate: number;
}

export interface StructuralType {
  type: LoopStructuralType;
  sub_type: LoopSubType;
  resources: ResourceProfile[];
  loops: LoopProfile[];
  has_braking: boolean;
  currencies: string[];
  risk_assessment: RiskProfile;
}

export interface ResourceProfile {
  name: string;
  class: ResourceClass;
  type: ResourceType;
  initial_value: number;
  bounds: { min: number; max: number };
}

export interface LoopProfile {
  level: string;
  actions: string[];
  time_scale: string;
  parent_step?: string;
}

export interface RiskProfile {
  likely_pathologies: string[];
  risk_level: 'low' | 'medium' | 'high';
  mitigation_suggestions: string[];
}

export interface InnerLoop {
  level: 'inner';
  parent_step: string;
  actions: string[];
  fun_check: boolean;
  time_scale: string;
}

export interface OuterLoop {
  level: 'outer';
  actions: string[];
  motivation_type: string;
  time_scale: string;
}

export interface MetaLoop {
  level: 'meta';
  actions: string[];
  content_type: string;
  time_scale: string;
}

export interface PathologyReport {
  pathologies: Pathology[];
  total_count: number;
  critical_count: number;
}

export interface Pathology {
  name: string;
  type: 'runaway' | 'deadlock' | 'stall' | 'brittleness' | 'oscillation' | 'stagnation' | 'triviality';
  severity: 'critical' | 'warning' | 'info';
  affected_resources: string[];
  description: string;
  correction: string;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  effort: 'easy' | 'moderate' | 'hard';
}

export interface CoreLoopProfile {
  structuralType: StructuralType;
  steps: CoreLoopStep[];
  innerLoops: InnerLoop[];
  outerLoops: OuterLoop[];
  metaLoop: MetaLoop;
  pathologies: PathologyReport;
  recommendations: Recommendation[];
  loopHierarchy: LoopHierarchy;
  validation: CoreLoopValidation;
}

export interface LoopHierarchy {
  micro: LoopProfile[];
  small: LoopProfile[];
  medium: LoopProfile[];
  large: LoopProfile[];
  macro: LoopProfile[];
  meta: LoopProfile[];
}

export interface CoreLoopValidation {
  fun_test_passed: boolean;
  loop_closed: boolean;
  no_dead_resources: boolean;
  score: number;
  details: string;
}


// ============================================================
// БЛОК 3: MDA (алгоритм 3.3)
// ============================================================

export interface MDAGenerationInput {
  aestheticProfile: AestheticProfile;
  genre: GenreProfile;
  concept: OnePager;
  existingMechanics?: MechanicSet;
  dynamicsProfile?: DynamicsProfile;
  forbiddenMechanics?: string[];
  requiredMechanics?: string[];
  maxMechanics?: number;
  minMechanics?: number;
  maxIterations?: number;
  convergenceThreshold?: number;
}

export interface GenreProfile {
  name: Genre;
  subgenre?: string;
  typical_aesthetics: AestheticType[];
  typical_mechanics: string[];
  typical_core_loops: string[];
  audience_profile: AudienceInput;
  conventions: string[];
}

export interface DynamicsTarget {
  core_dynamics: string[];
  supporting_dynamics: string[];
  emergence_potential: EmergencePotential;
}

export interface StructuredMechanicSet {
  base: MechanicGroup;
  combat: MechanicGroup;
  progression: MechanicGroup;
  spatial: MechanicGroup;
  social: MechanicGroup;
  conflicts: string[];
  synergies: string[];
  coverage_score: number;
}

export interface MechanicGroup {
  mechanics: string[];
  coverage: Record<AestheticType, number>;
  compatibility_score: number;
}

export interface LensValidation {
  lenses_applied: number;
  results: LensResult[];
  overall_score: number;
}

export interface LensResult {
  lens_name: string;
  lens_number: number;
  score: number;
  question: string;
  answer: string;
  suggestions: string[];
}

export interface BondValidation {
  matrix: string[][];
  horizontal_consistency: number;
  vertical_consistency: number;
  ludonarrative_dissonance: string[];
  overall_score: number;
}

export interface MachinationsGraph {
  nodes: MachinationsNode[];
  edges: MachinationsEdge[];
  resources: string[];
}

export interface MachinationsNode {
  id: string;
  type: 'source' | 'drain' | 'pool' | 'converter' | 'trader' | 'gate';
  label: string;
  value?: number;
}

export interface MachinationsEdge {
  from: string;
  to: string;
  type: 'flow' | 'state' | 'trigger';
  label?: string;
  value?: number;
}

export interface Issue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  description: string;
  source: string;
}

export interface Suggestion {
  id: string;
  priority: 'high' | 'medium' | 'low';
  description: string;
  effort: 'easy' | 'moderate' | 'hard';
  related_issues: string[];
}

export interface MDAProfile {
  aestheticProfile: AestheticProfile;
  dynamicsTarget: DynamicsTarget;
  mechanicSet: StructuredMechanicSet;
  observedDynamics: string[];
  predictedAesthetics: Record<AestheticType, number>;
  matchScores: Record<AestheticType, number>;
  overallMatch: number;
  lensValidation: LensValidation;
  bondValidation: BondValidation;
  machinationsModel: MachinationsGraph;
  gameplayScript: string;
  iterationsRequired: number;
  converged: boolean;
  issues: Issue[];
  suggestions: Suggestion[];
}


// ============================================================
// БЛОК 4: БАЛАНС (алгоритм 3.4)
// ============================================================

export interface BalanceInput {
  mdaProfile: MDAProfile;
  objects: BalanceObject[];
  resources: ResourceProfile[];
  balanceType: BalanceType;
  gameMode: GameMode;
  targetDuration?: number;
  targetLevels?: number;
  anchorResource?: string;
  fulcrumLevel?: number;
}

export interface BalanceObject {
  id: string;
  name: string;
  type: BalanceObjectType;
  attributes: Record<string, number>;
  cost?: number;
  tier?: number;
  tags?: string[];
}

export interface TransitiveResult {
  anchor: string;
  cost_power_curves: CostPowerCurve[];
  overpowered: string[];
  underpowered: string[];
  balanced: string[];
}

export interface CostPowerCurve {
  object_id: string;
  object_name: string;
  cost: number;
  power: number;
  ratio: number;
  deviation_from_anchor: number;
  status: 'balanced' | 'overpowered' | 'underpowered';
}

export interface IntransitiveResult {
  payoff_matrix: number[][];
  dominant_strategies: string[];
  nash_equilibria: string[];
}

export interface SituationalResult {
  matrix: number[][];
  situations: string[];
  situational_value: Record<string, number>;
}

export interface MonteCarloResult {
  iterations: number;
  win_rates: Record<string, number>;
  win_rate_spread: number;
  ranking_correlation: number;
  average_duration: number;
}

export interface BalancePathology {
  name: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  correction: string;
}

export interface CorrectionProposal {
  object_id: string;
  attribute: string;
  current_value: number;
  suggested_value: number;
  reason: string;
}

export interface CurveSpec {
  type: string;
  formula: string;
  parameters: Record<string, number>;
}

export interface BalanceResult {
  balanceMap: BalanceType;
  objects: BalanceObject[];
  transitiveResult: TransitiveResult;
  intransitiveResult: IntransitiveResult;
  situationalResult: SituationalResult;
  feedbackStability: { stable: boolean; details: string };
  pathologyReport: PathologyReport;
  monteCarloResult: MonteCarloResult;
  overallBalanceScore: number;
  criticalIssues: Issue[];
  warnings: Issue[];
  suggestions: Suggestion[];
  progressionCurves?: {
    xpCurve: CurveSpec;
    powerCurve: CurveSpec;
    contentCurve: CurveSpec;
  };
  formulas: {
    damageFormula: string;
    hpFormula: string;
    costFormula: string;
    difficultyFormula: string;
  };
}


// ============================================================
// БЛОК 5: ПРОГРЕССИЯ (алгоритм 3.5)
// ============================================================

export interface ProgressionInput {
  concept: OnePager;
  coreLoop: CoreLoopProfile;
  mdaProfile: MDAProfile;
  balanceResult: BalanceResult;
  targetDuration?: number;
  targetLevels?: number;
  progressionType?: ProgressionType;
  monetizationModel?: string;
  constraints?: ProgressionConstraints;
}

export interface ProgressionConstraints {
  maxGrindTolerance?: number;
  minRewardInterval?: number;
  flowTarget?: FlowTarget;
  contentBudget?: ContentBudget;
}

export interface ProgressionMacroModel {
  totalLevels: number;
  targetDuration: number;
  progressionType: ProgressionType;
  monetizationModel?: string;
  contentRequirements: string;
}

export interface TierModel {
  tiers: Tier[];
  tier_count: number;
  scaling_factor: number;
}

export interface Tier {
  level_range: [number, number];
  name: string;
  dominant_mechanic: string;
  balance_type: BalanceType;
  scale: number;
}

export interface ProgressionCurves {
  xp_to_level: CurveSpec;
  level_to_power: CurveSpec;
  level_to_cost: CurveSpec;
  difficulty: CurveSpec;
}

export interface ContentPlan {
  unlocks: UnlockEntry[];
  content_by_tier: Record<string, string[]>;
  perceived_difficulty: number[];
}

export interface UnlockEntry {
  level: number;
  type: 'mechanic' | 'content' | 'ability' | 'area';
  name: string;
  description: string;
}

export interface ProgressionEconomyLink {
  economic_phases: EconomicPhase[];
  conversion_chains: string[];
}

export interface EconomicPhase {
  tier: string;
  primary_resources: string[];
  primary_activities: string[];
}

export interface ProgressionValidation {
  no_grind: boolean;
  no_walls: boolean;
  no_empty_levels: boolean;
  no_runaway: boolean;
  no_build_gaps: boolean;
  aesthetic_alignment: boolean;
  score: number;
  details: string[];
}

export interface ProgressionProfile {
  macroModel: ProgressionMacroModel;
  tierModel: TierModel;
  curves: ProgressionCurves;
  contentPlan: ContentPlan;
  economyLink: ProgressionEconomyLink;
  validation: ProgressionValidation;
  totalLevels: number;
  totalDuration: number;
  progressionType: ProgressionType;
  emergenceRatio: number;
  lockKeyModel: string;
  summary: {
    xpFormula: string;
    powerFormula: string;
    costFormula: string;
    difficultyFormula: string;
    contentRequirements: string;
  };
}


// ============================================================
// БЛОК 5: ЭКОНОМИКА (алгоритм 3.6)
// ============================================================

export interface EconomyInput {
  concept: OnePager;
  coreLoop: CoreLoopProfile;
  mdaProfile: MDAProfile;
  progressionProfile: ProgressionProfile;
  monetizationType?: EconomyMonetizationType;
  openness?: EconomyOpenness;
  customResources?: ResourceDefinition[];
  constraints?: EconomyConstraints;
}

export interface ResourceDefinition {
  name: string;
  type: ResourceType;
  class: ResourceClass;
  bounds: { min: number; max: number };
  initialValue: number;
}

export interface EconomyConstraints {
  maxResources?: number;
  maxConversionChains?: number;
  allowPlayerTrade?: boolean;
  targetInflationRate?: number;
}

export interface ResourceInventory {
  core: ResourceDefinition[];
  subsidiary: ResourceDefinition[];
  currencies: ResourceDefinition[];
  consumables: ResourceDefinition[];
  meta: ResourceDefinition[];
}

export interface EconomicClassification {
  system_type: string;
  openness: EconomyOpenness;
  faucet_drain_ratio: number;
}

export interface ConversionGraph {
  chains: ConversionChain[];
  total_conversions: number;
}

export interface ConversionChain {
  from_resource: string;
  to_resource: string;
  ratio: number;
  mechanism: string;
}

export interface EconomyDiagnostics {
  pathologies: EconomyPathology[];
  faucet_drain_balance: Record<string, { faucet: number; drain: number; balanced: boolean }>;
  stability: 'stable' | 'unstable' | 'oscillating';
}

export interface EconomyPathology {
  name: string;
  type: 'runaway' | 'deadlock' | 'stall' | 'inflation' | 'stagnation' | 'arbitrage';
  severity: 'critical' | 'warning' | 'info';
  description: string;
  affected_resources: string[];
  correction: string;
}

export interface EconomyCorrection {
  pathology_id: string;
  type: 'faucet_adjustment' | 'drain_adjustment' | 'ratio_change' | 'new_mechanic';
  description: string;
  before: Record<string, number>;
  after: Record<string, number>;
}

export interface SimulationResult {
  ticks: number;
  resource_trajectories: Record<string, number[]>;
  detected_pathologies: string[];
  stable: boolean;
}

export interface MonetizationSpec {
  type: EconomyMonetizationType;
  primary_revenue: string[];
  secondary_revenue: string[];
  ethical_concerns: string[];
}

export interface EconomyProfile {
  resources: ResourceInventory;
  classification: EconomicClassification;
  machinationsModel: MachinationsGraph;
  conversionGraph: ConversionGraph;
  diagnostics: EconomyDiagnostics;
  balancedEconomy: {
    corrections: EconomyCorrection[];
    adjusted_faucets_drains: Record<string, { faucet: number; drain: number }>;
  };
  simulation: SimulationResult;
  economicType: string;
  openness: string;
  pricingType: string;
  detectedPatterns: string[];
  monetizationModel: MonetizationSpec;
  summary: {
    coreResourcesDescription: string;
    economicTypeDescription: string;
    faucetDrainSummary: string;
    cyclesSummary: string;
    pathologiesSummary: string;
    simulationSummary: string;
  };
}


// ============================================================
// БЛОК 6: GDD (алгоритм 3.7)
// ============================================================

export interface GDDGenerationInput {
  concept: OnePager;
  coreLoop: CoreLoopProfile;
  mdaProfile: MDAProfile;
  balanceResult: BalanceResult;
  progressionProfile: ProgressionProfile;
  economyProfile: EconomyProfile;
  targetFormat?: GDDFormat;
  targetAudienceDoc?: DocAudience;
  detailLevel?: DetailLevel;
  customSections?: string[];
  excludedSections?: string[];
  language?: string;
  constraints?: GDDConstraints;
}

export interface GDDConstraints {
  maxPages?: number;
  includeDiagrams?: boolean;
  includeFormulas?: boolean;
  includeTables?: boolean;
  citationStyle?: CitationStyle;
  exportFormats?: ExportFormat[];
}

export interface GDDSection {
  id: string;
  title: string;
  content: string;
  source_algorithm: string;
  auto_filled: boolean;
  visual_elements: string[];
}

export interface VisualElement {
  type: 'diagram' | 'table' | 'chart' | 'graph';
  title: string;
  data: unknown;
  format: string;
}

export interface ConsistencyIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  section_a: string;
  section_b: string;
  description: string;
  resolution: string;
}

export interface CompletenessReport {
  totalSections: number;
  autoFilled: number;
  aiGenerated: number;
  manualFilled: number;
  manualPending: number;
  completenessPercent: number;
}

export interface GDDProfile {
  format: GDDFormat;
  detailLevel: DetailLevel;
  targetAudience: DocAudience;
  generatedAt: string;
  version: string;
  sections: GDDSection[];
  visualElements: Record<string, VisualElement>;
  crossReferences: Record<string, string[]>;
  consistencyIssues: ConsistencyIssue[];
  completeness: CompletenessReport;
  consistencyScore: number;
  coverageScore: number;
  availableFormats: string[];
  exportedFiles: string[];
  isLive: boolean;
  lastSyncAt: string;
  syncStatus: 'synced' | 'outdated' | 'conflict';
}


// ============================================================
// БЛОК 6: ВАЛИДАЦИЯ / ЧЕК-ЛИСТЫ (алгоритм 3.8)
// ============================================================

export interface ChecklistInput {
  concept: OnePager;
  coreLoop: CoreLoopProfile;
  mdaProfile: MDAProfile;
  balanceResult: BalanceResult;
  progressionProfile: ProgressionProfile;
  economyProfile: EconomyProfile;
  gddProfile?: GDDProfile;
  checklistTypes?: ChecklistType[];
  focusAreas?: FocusArea[];
  severityThreshold?: 'critical' | 'warning' | 'info';
  maxIssues?: number;
  projectStage?: ProjectStageName;
  previousValidation?: ChecklistResult;
}

export interface ValidationIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  title: string;
  description: string;
  source: string;
  remediation: string;
}

export interface RemediationItem {
  issue_id: string;
  action: string;
  effort: 'easy' | 'moderate' | 'hard';
  impact: 'high' | 'medium' | 'low';
}

export interface MDACheckResult {
  mechanic_dynamics_coverage: number;
  dynamics_aesthetics_coverage: number;
  overall_mda_score: number;
  gaps: string[];
}

export interface BalanceCheckResult {
  overall_score: number;
  critical_imbalances: string[];
  transitive_ok: boolean;
  intransitive_ok: boolean;
}

export interface NarrativeCheckResult {
  ludonarrative_dissonance: string[];
  agency_score: number;
  structure_score: number;
}

export interface EconomyCheckResult {
  stable: boolean;
  pathologies: string[];
  faucet_drain_balanced: boolean;
}

export interface LensCheckResult {
  lenses_applied: number;
  overall_score: number;
  lowest_scoring: string[];
}

export interface ChecklistResult {
  overallScore: number;
  readinessLevel: 'draft' | 'review' | 'ready' | 'production';
  issues: ValidationIssue[];
  remediationPlan: RemediationItem[];
  mdaCheck: MDACheckResult;
  balanceCheck: BalanceCheckResult;
  narrativeCheck: NarrativeCheckResult;
  economyCheck: EconomyCheckResult;
  lensCheck: LensCheckResult;
}


// ============================================================
// PROJECT STATE — ЕДИНАЯ МОДЕЛЬ ПРОЕКТА (алгоритм 3.10)
// ============================================================

export interface ProjectState {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  version: number;

  concept: {
    genre: GenreProfile;
    targetAudience: AudienceInput;
    platform: Platform[];
    constraints: ConstraintsInput;
    onePager: OnePager;
    usp: string;
    referenceGames: string[];
    aestheticProfile: AestheticProfile;
    dynamicsProfile: DynamicsProfile;
    mechanicSet: MechanicSet;
  };

  coreLoop: {
    structuralType: StructuralType;
    steps: CoreLoopStep[];
    innerLoops: InnerLoop[];
    outerLoops: OuterLoop[];
    metaLoop: MetaLoop;
    pathologies: PathologyReport;
    recommendations: Recommendation[];
    loopHierarchy: LoopHierarchy;
  };

  mdaProfile: {
    targetAesthetics: AestheticProfile;
    targetDynamics: DynamicsTarget;
    mechanicSet: StructuredMechanicSet;
    observedDynamics: string[];
    predictedAesthetics: Record<AestheticType, number>;
    matchScores: Record<AestheticType, number>;
    overallMatch: number;
    lensValidation: LensValidation;
    bondValidation: BondValidation;
    machinationsModel: MachinationsGraph;
  };

  balance: {
    elements: BalanceObject[];
    costPowerCurves: CostPowerCurve[];
    intransitiveMatrix: number[][];
    nashEquilibrium: string[];
    monteCarloResults: MonteCarloResult[];
    pathologies: BalancePathology[];
    corrections: CorrectionProposal[];
    overallBalanceScore: number;
  };

  progression: {
    macroModel: ProgressionMacroModel;
    tierModel: TierModel;
    curves: ProgressionCurves;
    contentPlan: ContentPlan;
    economyLink: ProgressionEconomyLink;
    validation: ProgressionValidation;
  };

  economy: {
    resourceModel: ResourceInventory;
    systemType: string;
    machinationsModel: MachinationsGraph;
    conversionChains: ConversionChain[];
    pathologies: EconomyPathology[];
    corrections: EconomyCorrection[];
    simulationResults: SimulationResult;
    monetizationModel: MonetizationSpec;
  };

  gdd: {
    format: GDDFormat;
    sections: GDDSection[];
    visualElements: Record<string, VisualElement>;
    consistencyIssues: ConsistencyIssue[];
    completeness: CompletenessReport;
  };

  validation: {
    overallScore: number;
    readinessLevel: string;
    issues: ValidationIssue[];
    remediationPlan: RemediationItem[];
    mdaCheck: MDACheckResult;
    balanceCheck: BalanceCheckResult;
    narrativeCheck: NarrativeCheckResult;
    economyCheck: EconomyCheckResult;
    lensCheck: LensCheckResult;
  };

  projectStage: ProjectStageName;
  completionPercent: number;
  lastAlgorithmRun: string;
}
