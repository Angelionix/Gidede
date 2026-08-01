/**
 * Gidede — Concept Types (Block 1)
 * SRP: извлечены из src/app/blocks/1/page.tsx
 *
 * TASK-1.13: выровнены типы с реализацией (убраны Record<string, unknown> bypass'ы).
 */

import type {
  AestheticProfile,
  DynamicsProfile,
  ValidationReport,
  StructuredMechanicSetV2,
  CoreLoopCandidate,
  USPCandidate,
} from "../../shared/types/typescript/interfaces";

export interface ConceptFormState {
  idea: string;
  genreMode: "auto" | "explicit";
  genre: string;
  // TASK-1.17: явные subgenres в форме
  subgenres: string[];
  targetMotivations: string[];
  experienceLevel: string;
  platforms: string[];
  referenceGames: string;
  budget: string;
  forbiddenMechanics: string[];
  forbiddenInput: string;
  useAi: boolean;
}

export interface ConceptGenerationMetadata {
  stages_completed: number[];
  latency_ms: number;
  models_used: string[];
  ai_enriched: boolean;
  ai_insights?: string;
}

export interface ConceptGenerationResult {
  id: string;
  title: string;
  genre: string;
  // TASK-1.17: primary + subgenres в response.
  primary_genre: string;
  subgenres: string[];
  target_audience: string;
  story_synopsis: string;
  gameplay_description: string;
  unique_features: string[];
  competitors: string[];
  rating?: string;
  aesthetic_profile: AestheticProfile | null;
  dynamics_profile: DynamicsProfile | null;
  // TASK-1.13: конкретный тип вместо Record<string, unknown>.
  // Union с Record<string, unknown> сохраняет совместимость с существующими
  // UI-компонентами (MechanicSetView, etc.), которые используют Record<string, unknown>.
  // После рефакторинга UI-компонентов (отдельная задача) union можно сузить до StructuredMechanicSetV2.
  mechanic_set: StructuredMechanicSetV2 | Record<string, unknown> | null;
  // TASK-1.13: union с Record<string, unknown>[] для совместимости с UI-компонентами.
  core_loop_candidates: CoreLoopCandidate[] | Record<string, unknown>[];
  usp_candidates: USPCandidate[] | Record<string, unknown>[];
  validation_report: ValidationReport | null;
  status: string;
  generation_metadata: ConceptGenerationMetadata;
}
