/**
 * Gidede — Balance Types (Block 4)
 * SRP: извлечены из src/app/blocks/4/page.tsx
 */

import type { AlgorithmMetadata } from "@/lib/algorithm-metadata";
import type { STAGE_CONTRACT_VERSION } from "@/lib/contracts/stage-contracts";

export interface BalanceObject {
  id: string;
  name: string;
  type: string;
  attributes: Record<string, number>;
  cost?: number;
  tier?: number;
  tags?: string[];
}

export interface FullBalanceRequest {
  objects: BalanceObject[];
  resources?: Record<string, unknown>[];
  game_mode: "PvP" | "PvE" | "PvPvE";
  genre: string;
  balance_type: "transitive" | "intransitive" | "situational" | "mixed";
  anchor_resource?: string;
  target_duration?: number;
  target_levels?: number;
  mda_profile?: Record<string, unknown>;
  run_intransitive: boolean;
  run_situational: boolean;
  run_q_factor: boolean;
  run_monte_carlo: boolean;
  run_machinations: boolean;
}

export interface TransitiveObject {
  name: string;
  power: number;
  effective_cost: number;
  cp_ratio: number;
  distance_from_curve: number;
  status: string;
}

export interface TransitiveResult {
  attribute_weights: Record<string, number>;
  cost_curve_model: string;
  expected_cp: number;
  objects: TransitiveObject[];
  overpowered: string[];
  underpowered: string[];
  balanced: string[];
  ideal_imbalance: string[];
  warnings: string[];
  suggestions: string[];
}

export interface IntransitiveResult {
  payoff_matrix: number[][];
  object_names: string[];
  nash_equilibrium: number[];
  is_intransitive: boolean;
  dominated_strategies: string[];
  strategy_balance: { entropy: number; max_share: number; gini: number };
  rps_cycles: { cycle: string[]; strength: number }[];
  has_dominant_strategy: boolean;
  warnings: string[];
  suggestions: string[];
}

export interface MonteCarloResult {
  config: Record<string, unknown>;
  win_rates: Record<string, number>;
  avg_duration: Record<string, number>;
  matchup_matrix: Record<string, Record<string, number>>;
  win_rate_spread: number;
  ranking_correlation: number;
  balance_verdict: string;
  warnings: string[];
  suggestions: string[];
}

export interface MachinationsNode {
  id: string;
  name: string;
  type: string;
  value?: number;
  capacity?: number;
}

export interface ResourceFlow {
  from: string;
  to: string;
  rate: number | string;
  label?: string;
}

export interface StateConnection {
  from: string;
  to: string;
  modifier: string;
}

export interface FeedbackLoop {
  nodes: string[];
  type: string;
  strength?: number;
  description?: string;
}

export interface MachinationsGraph {
  nodes: MachinationsNode[];
  resource_flows: ResourceFlow[];
  state_connections: StateConnection[];
  feedback_loops: FeedbackLoop[];
  [key: string]: unknown;
}

export interface MachinationsQuality {
  resources_in_bounds: boolean;
  progression_pacing_ok: boolean;
  no_runaway_for_minmaxer: boolean;
  no_stall_for_casual: boolean;
  build_gap_acceptable: boolean;
  economy_stable: boolean;
  overall_pass: boolean;
  critical_issues: string[];
  warnings: string[];
}

export interface MachinationsResult {
  graph: MachinationsGraph;
  runs: number;
  aggregated: {
    avg_resource_curves: Record<string, number[]>;
    resource_ranges: Record<string, { min: number; max: number }>;
    runaway_frequency: number;
    stall_frequency: number;
    stability_index: number;
    build_gap: number;
    [key: string]: unknown;
  };
  quality: MachinationsQuality;
  detected_pathologies: string[];
  recommendations: string[];
}

export interface FullBalanceResponse {
  id: string;
  balance_map: {
    primary_model: string;
    secondary_model: string;
    anchor: string;
    game_sum: string;
    feedback: string;
    applicable_balance_types: string[];
  };
  transitive_result: TransitiveResult;
  intransitive_result: IntransitiveResult;
  situational_result: Record<string, unknown>;
  q_factor_result: Record<string, unknown>;
  stability: {
    overall_stability: number;
    pathology_risks: string[];
    analysis: string;
    positive_loops: number;
    negative_loops: number;
    recommendations: string[];
  };
  monte_carlo_result: MonteCarloResult;
  machinations_result: MachinationsResult;
  contract_version: typeof STAGE_CONTRACT_VERSION;
  algorithm_metadata: AlgorithmMetadata;
  stages_completed: number[];
  latency_ms: number;
  models_used: string[];
  warnings: string[];
  suggestions: string[];
}
