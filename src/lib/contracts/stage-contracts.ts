import { z } from "zod";
import { ALGORITHM_METHODS } from "@/lib/algorithm-metadata";
import { artifactEnvelopeSchema } from "@/lib/contracts/artifact-envelope";

export const STAGE_CONTRACT_VERSION = "1.0.0" as const;

export const CONTRACT_STAGE_IDS = [
  "concept",
  "core_loop",
  "mda",
  "balance",
  "progression",
  "economy",
  "gdd",
  "validation",
] as const;

export type ContractStageId = (typeof CONTRACT_STAGE_IDS)[number];

const stringFlag = z.union([z.boolean(), z.literal("true"), z.literal("false")]);
const stringArray = z.array(z.string().trim().min(1));
const optionalId = z.string().trim().min(1).optional();
const numericInput = z.union([z.number().finite(), z.string().trim().min(1)]);
const upstreamVersionsInput = z.record(
  z.string().trim().min(1),
  z.string().trim().min(1),
).optional();

const algorithmMetadataSchema = z.object({
  taxonomy_version: z.literal(1),
  scores: z.record(
    z.string().min(1),
    z.object({
      method: z.enum(ALGORITHM_METHODS),
      assumptions: z.array(z.string().trim().min(1)).min(1),
    }),
  ),
});

const outputBase = {
  contract_version: z.literal(STAGE_CONTRACT_VERSION),
  algorithm_metadata: algorithmMetadataSchema,
  artifact: artifactEnvelopeSchema,
};

const conceptInputV1 = z.object({
  idea: z.string().trim().min(10).max(2000),
  genre: z.string().trim().min(1).nullable().optional(),
  subgenres: stringArray.max(3).optional(),
  target_audience: z.object({
    primary: stringArray.max(5).optional(),
    experience: z.string().trim().min(1).optional(),
  }).optional(),
  platform: stringArray.max(10).optional(),
  constraints: z.object({
    team_size: z.number().int().positive().max(1000).optional(),
    budget: z.string().trim().optional(),
  }).optional(),
  reference_games: stringArray.max(10).optional(),
  forbidden_mechanics: stringArray.max(20).optional(),
  use_ai: stringFlag.optional(),
  project_id: optionalId,
  upstream_versions: upstreamVersionsInput,
}).passthrough();

const coreLoopInputV1 = z.object({
  mechanics: stringArray.min(1).max(100),
  concept_id: optionalId,
  genre: z.string().trim().min(1).optional(),
  primary_aesthetic: z.string().trim().min(1).optional(),
  desired_loop_type: z.string().trim().min(1).optional(),
  custom_steps: stringArray.max(50).optional(),
  use_ai: stringFlag.optional(),
  project_id: optionalId,
  upstream_versions: upstreamVersionsInput,
}).passthrough();

const mdaInputV1 = z.object({
  concept_id: optionalId,
  genre: z.string().trim().min(1).optional(),
  idea: z.string().trim().optional(),
  target_aesthetics: stringArray.max(8).optional(),
  primary_aesthetic: z.string().trim().min(1).optional(),
  secondary_aesthetic: z.string().trim().min(1).optional(),
  tertiary_aesthetic: z.string().trim().min(1).optional(),
  max_mechanics: numericInput.optional(),
  convergence_threshold: numericInput.optional(),
  full_analysis: z.boolean().optional(),
  existing_mechanics: stringArray.max(100).optional(),
  required_mechanics: stringArray.max(100).optional(),
  forbidden_mechanics: stringArray.max(100).optional(),
  use_ai: stringFlag.optional(),
  project_id: optionalId,
  upstream_versions: upstreamVersionsInput,
}).passthrough();

const balanceObjectInputV1 = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1),
  type: z.string().trim().min(1).optional(),
  attributes: z.record(z.string().min(1), z.number().finite()).refine(
    (attributes) => Object.keys(attributes).length > 0,
    "attributes must not be empty",
  ),
  cost: z.number().finite().optional(),
  tier: z.number().int().optional(),
  tags: stringArray.optional(),
}).passthrough();

const balanceInputV1 = z.object({
  objects: z.array(balanceObjectInputV1).min(2).max(100),
  game_mode: z.string().trim().min(1).optional(),
  genre: z.string().trim().min(1).optional(),
  balance_type: z.enum(["transitive", "intransitive", "situational", "mixed"]).optional(),
  run_intransitive: z.boolean().optional(),
  run_situational: z.boolean().optional(),
  run_q_factor: z.boolean().optional(),
  run_monte_carlo: z.boolean().optional(),
  run_machinations: z.boolean().optional(),
  use_ai: stringFlag.optional(),
  project_id: optionalId,
  upstream_versions: upstreamVersionsInput,
}).passthrough();

const progressionInputV1 = z.object({
  genre: z.string().trim().min(1).optional(),
  target_duration: numericInput.optional(),
  target_levels: numericInput.optional(),
  total_levels: numericInput.optional(),
  progression_type: z.string().trim().min(1).optional(),
  monetization_model: z.string().trim().min(1).optional(),
  pacing: z.string().trim().min(1).optional(),
  use_ai: stringFlag.optional(),
  project_id: optionalId,
  upstream_versions: upstreamVersionsInput,
}).passthrough();

const economyInputV1 = z.object({
  genre: z.string().trim().min(1).optional(),
  monetization_type: z.string().trim().min(1).optional(),
  openness: z.string().trim().min(1).optional(),
  use_ai: stringFlag.optional(),
  project_id: optionalId,
  upstream_versions: upstreamVersionsInput,
}).passthrough();

const gddInputV1 = z.object({
  target_format: z.string().trim().min(1).optional(),
  format: z.string().trim().min(1).optional(),
  target_audience_doc: z.string().trim().min(1).optional(),
  detail_level: z.string().trim().min(1).optional(),
  project_stage: z.string().trim().min(1).optional(),
  custom_sections: stringArray.optional(),
  excluded_sections: stringArray.optional(),
  language: z.string().trim().min(1).optional(),
  use_ai: stringFlag.optional(),
  project_id: optionalId,
  upstream_versions: upstreamVersionsInput,
}).passthrough();

const validationInputV1 = z.object({
  depth: z.string().trim().min(1).optional(),
  checklist_types: stringArray.optional(),
  project_id: optionalId,
  upstream_versions: upstreamVersionsInput,
}).passthrough();

const conceptOutputV1 = z.object({
  ...outputBase,
  id: z.string().min(1),
  genre: z.string().min(1),
  mechanic_set: z.record(z.string(), z.unknown()),
  validation_report: z.record(z.string(), z.unknown()),
  status: z.literal("completed"),
}).passthrough();

const coreLoopOutputV1 = z.object({
  ...outputBase,
  id: z.string().min(1),
  structural_type: z.record(z.string(), z.unknown()),
  steps: z.array(z.record(z.string(), z.unknown())).min(1),
  validation: z.record(z.string(), z.unknown()),
}).passthrough();

const mdaOutputV1 = z.object({
  ...outputBase,
  aesthetic_profile: z.record(z.string(), z.unknown()),
  dynamics_target: z.record(z.string(), z.unknown()),
  mechanic_set: z.record(z.string(), z.unknown()),
}).passthrough();

const balanceOutputV1 = z.object({
  ...outputBase,
  id: z.string().min(1),
  balance_map: z.record(z.string(), z.unknown()),
  transitive_result: z.record(z.string(), z.unknown()),
  stability: z.record(z.string(), z.unknown()),
}).passthrough();

const progressionOutputV1 = z.object({
  ...outputBase,
  id: z.string().min(1),
  macro_model: z.record(z.string(), z.unknown()),
  tier_model: z.record(z.string(), z.unknown()),
  curves: z.record(z.string(), z.unknown()),
  validation: z.record(z.string(), z.unknown()),
}).passthrough();

const economyOutputV1 = z.object({
  ...outputBase,
  id: z.string().min(1),
  inventory: z.record(z.string(), z.unknown()),
  classification: z.record(z.string(), z.unknown()),
  conversion_graph: z.record(z.string(), z.unknown()),
  sim_result: z.record(z.string(), z.unknown()),
}).passthrough();

const gddOutputV1 = z.object({
  ...outputBase,
  format_spec: z.record(z.string(), z.unknown()),
  data_mapping: z.record(z.string(), z.unknown()),
  assembled_document: z.record(z.string(), z.unknown()),
  coverage_score: z.number().min(0).max(1),
}).passthrough();

const validationOutputV1 = z.object({
  ...outputBase,
  scope: z.record(z.string(), z.unknown()),
  summary: z.record(z.string(), z.unknown()),
}).passthrough();

export const STAGE_CONTRACTS_V1 = {
  concept: { version: STAGE_CONTRACT_VERSION, input: conceptInputV1, output: conceptOutputV1 },
  core_loop: { version: STAGE_CONTRACT_VERSION, input: coreLoopInputV1, output: coreLoopOutputV1 },
  mda: { version: STAGE_CONTRACT_VERSION, input: mdaInputV1, output: mdaOutputV1 },
  balance: { version: STAGE_CONTRACT_VERSION, input: balanceInputV1, output: balanceOutputV1 },
  progression: { version: STAGE_CONTRACT_VERSION, input: progressionInputV1, output: progressionOutputV1 },
  economy: { version: STAGE_CONTRACT_VERSION, input: economyInputV1, output: economyOutputV1 },
  gdd: { version: STAGE_CONTRACT_VERSION, input: gddInputV1, output: gddOutputV1 },
  validation: { version: STAGE_CONTRACT_VERSION, input: validationInputV1, output: validationOutputV1 },
} as const;

export type StageInputValidation =
  | { success: true }
  | { success: false; error: string };

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`)
    .join("; ");
}

export function validateStageInput(stage: ContractStageId, payload: unknown): StageInputValidation {
  const result = STAGE_CONTRACTS_V1[stage].input.safeParse(payload);
  return result.success
    ? { success: true }
    : { success: false, error: `Contract ${stage}@${STAGE_CONTRACT_VERSION}: ${formatIssues(result.error)}` };
}

export class StageOutputContractError extends Error {
  constructor(stage: ContractStageId, details: string) {
    super(`Output contract ${stage}@${STAGE_CONTRACT_VERSION}: ${details}`);
    this.name = "StageOutputContractError";
  }
}

export function assertStageOutput(stage: ContractStageId, payload: unknown): void {
  const result = STAGE_CONTRACTS_V1[stage].output.safeParse(payload);
  if (!result.success) {
    throw new StageOutputContractError(stage, formatIssues(result.error));
  }
}
