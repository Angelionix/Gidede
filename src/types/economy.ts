/**
 * Gidede — Economy Types (Block 5)
 * SRP: извлечены из src/app/blocks/5/page.tsx
 */

import type { AlgorithmMetadata } from "@/lib/algorithm-metadata";
import type { STAGE_CONTRACT_VERSION } from "@/lib/contracts/stage-contracts";

export interface EconomyDesignResponse {
  id: string;
  inventory: {
    resources: Array<{
      name: string;
      resource_class: string;
      resource_type: string;
      initial_value: number;
      bounds: { min: number; max: number };
      is_consumable: boolean;
      is_catalytic: boolean;
      is_anchor: boolean;
    }>;
    anchor: string;
    core_count: number;
    subsidiary_count: number;
  };
  classification: {
    type: string;
    sub_type: string;
    dominant_loop: string;
    interaction_type: string;
    openness: string;
    pricing_type: string;
    risk_level: string;
    [key: string]: unknown;
  };
  machinations_model: {
    nodes: Array<{ id: string; name: string; node_type: string; initial_value: number; capacity: number | null; rate: number | null }>;
    resource_flows: Array<{ source_id: string; target_id: string; resource: string; rate: number }>;
    state_connections: Array<{ source_id: string; target_id: string; modifier: string; formula: string }>;
    feedback_loops: Array<{ nodes: string[]; loop_type: string; strength: number; description: string }>;
    economic_type: string;
    structural_patterns: string[];
    [key: string]: unknown;
  };
  conversion_graph: {
    chains: Array<{ inputs: string[]; outputs: string[]; profitability: number; tier: number; risk: string }>;
    avg_profitability: number;
    tier_coverage: Record<string, boolean>;
    warnings: string[];
  };
  diagnostics: {
    pathologies: Array<{ name: string; severity: string; description: string; affected_resources: string[]; correction: string }>;
    faucet_drain_ratios: Record<string, { faucet: number; drain: number; ratio: number }>;
    overall_severity: string;
  };
  balance: {
    adjustments: Array<{ resource: string; action: string; current_rate: number; new_rate: number; reason: string }>;
    phase: string;
    target_ratio: number;
  };
  sim_result: {
    config: Record<string, unknown>;
    aggregated: {
      avg_resource_curves: Record<string, number[]>;
      resource_ranges: Record<string, { min: number; max: number }>;
      runaway_frequency: number;
      stall_frequency: number;
      stability_index: number;
      build_gap: number;
    };
    quality: {
      resources_in_bounds: boolean;
      progression_pacing_ok: boolean;
      no_runaway_for_minmaxer: boolean;
      no_stall_for_casual: boolean;
      build_gap_acceptable: boolean;
      economy_stable: boolean;
      overall_pass: boolean;
      critical_issues: string[];
    };
    snapshots_count: number;
  };
  contract_version: typeof STAGE_CONTRACT_VERSION;
  algorithm_metadata: AlgorithmMetadata;
  stages_completed: number[];
  latency_ms: number;
}
