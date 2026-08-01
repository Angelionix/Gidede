/**
 * Gidede — Progression Types (Block 5)
 * SRP: извлечены из src/app/blocks/5/page.tsx
 */

import type { AlgorithmMetadata } from "@/lib/algorithm-metadata";

export interface ProgressionDesignResponse {
  id: string;
  macro_model: {
    total_levels: number;
    target_duration: number;
    progression_type: string;
    content_requirements: string;
    emergence_ratio: number;
    lock_key_model: string;
    monetization_model: string;
    [key: string]: unknown;
  };
  tier_model: {
    tiers: Array<{
      index: number;
      level_range: [number, number];
      level_count: number;
      scale: string;
      dominant_mechanic: string;
      balance_type: string;
      difficulty_curve: string;
      resource_state: string;
      transition_trigger: string;
    }>;
    num_tiers: number;
    total_levels: number;
    transition_map: Record<string, string>;
  };
  curves: {
    xp_to_level: { type: string; formula: string; parameters: Record<string, number>; points?: number[] };
    level_to_power: { type: string; formula: string; parameters: Record<string, number>; points?: number[] };
    level_to_cost: { type: string; formula: string; parameters: Record<string, number>; points?: number[] };
    difficulty: { type: string; formula: string; parameters: Record<string, number>; points?: number[] };
  };
  content_plan: {
    tier_plans: Array<{
      tier_index: number;
      enemies: number;
      rewards: number;
      abilities: number;
      milestones: number;
      pacing: string;
    }>;
    unlock_tree: Array<{
      level: number;
      unlock_name: string;
      unlock_type: string;
      description: string;
    }>;
    perceived_difficulty_table: Array<{
      level: number;
      target_perceived_difficulty: number;
      recommended_enemy_power: number;
      is_tier_boundary: boolean;
    }>;
  };
  validation: {
    issues: Array<{ severity: string; description: string }>;
    suggestions: string[];
    critical_count: number;
    warning_count: number;
    info_count: number;
    overall_score: number;
    checks: Record<string, boolean>;
  };
  summary: Record<string, string>;
  algorithm_metadata: AlgorithmMetadata;
  stages_completed: number[];
  latency_ms: number;
}
