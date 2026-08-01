/**
 * Gidede — CoreLoop Types (Block 2)
 * SRP: извлечены из src/app/blocks/2/page.tsx
 */

import type { AlgorithmMetadata } from "@/lib/algorithm-metadata";
import type { STAGE_CONTRACT_VERSION } from "@/lib/contracts/stage-contracts";

export interface CoreLoopFormState {
  conceptId: string;
  mechanics: string;
  genre: string;
  desiredLoopType: string;
  customSteps: string;
}

export interface CoreLoopDesignResult {
  id: string;
  structural_type: Record<string, unknown>;
  steps: Record<string, unknown>[];
  inner_loops: Record<string, unknown>[];
  outer_loops: Record<string, unknown>[];
  meta_loop: Record<string, unknown> | null;
  pathologies: Record<string, unknown>;
  recommendations: Record<string, unknown>[];
  validation: Record<string, unknown> | null;
  loop_hierarchy: Record<string, unknown> | null;
  contract_version: typeof STAGE_CONTRACT_VERSION;
  algorithm_metadata: AlgorithmMetadata;
  stages_completed: number[];
  latency_ms: number;
  models_used: string[];
}
