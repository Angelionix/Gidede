/**
 * Gidede — MDA Types (Block 3)
 * SRP: извлечены из src/app/blocks/3/page.tsx
 */

export interface MDAFormState {
  conceptId: string;
  genre: string;
  primaryAesthetic: string;
  secondaryAesthetic: string;
  tertiaryAesthetic: string;
  idea: string;
  existingMechanics: string;
  requiredMechanics: string;
  forbiddenMechanics: string;
  maxMechanics: number;
  convergenceThreshold: number;
  fullAnalysis: boolean;
}

export interface MDAAnalysisResult {
  aesthetic_profile: Record<string, unknown> | null;
  dynamics_target: Record<string, unknown> | null;
  mechanic_candidate_set: Record<string, unknown> | null;
  mechanic_set: Record<string, unknown> | null;
  classic_mda_result: Record<string, unknown> | null;
  lens_validation: Record<string, unknown> | null;
  bond_validation: Record<string, unknown> | null;
  genre: string;
  concept_id: string;
  iterations_done: number;
  stages_completed: number[];
  latency_ms: number;
  models_used: string[];
}
