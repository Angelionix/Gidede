/**
 * Gidede — Concept Types (Block 1)
 * SRP: извлечены из src/app/blocks/1/page.tsx
 */

import type {
  AestheticProfile,
  DynamicsProfile,
  ValidationReport,
} from "../../shared/types/typescript/interfaces";

export interface ConceptFormState {
  idea: string;
  genreMode: "auto" | "explicit";
  genre: string;
  targetMotivations: string[];
  experienceLevel: string;
  platforms: string[];
  referenceGames: string;
  budget: string;
  forbiddenMechanics: string[];
  forbiddenInput: string;
  useAi: boolean;
  /** Optional user-selected mechanics. If empty, AI/auto-selection runs. */
  selectedMechanics: string[];
}

export interface ConceptGenerationResult {
  id: string;
  title: string;
  genre: string;
  target_audience: string;
  story_synopsis: string;
  gameplay_description: string;
  unique_features: string[];
  competitors: string[];
  rating?: string;
  aesthetic_profile: AestheticProfile | null;
  dynamics_profile: DynamicsProfile | null;
  mechanic_set: Record<string, unknown> | null;
  core_loop_candidates: Record<string, unknown>[];
  usp_candidates: Record<string, unknown>[];
  validation_report: ValidationReport | null;
  status: string;
  generation_metadata?: {
    stages_completed: number[];
    latency_ms: number;
    models_used: string[];
  };
}
