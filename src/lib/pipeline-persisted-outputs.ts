import type { ContractStageId } from "@/lib/contracts/stage-contracts";

type PersistedOutputs = Partial<Record<ContractStageId, Record<string, unknown>>>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    return asRecord(JSON.parse(value)) ?? undefined;
  } catch {
    return undefined;
  }
}

function relation(project: Record<string, unknown>, name: string): Record<string, unknown> | null {
  return asRecord(project[name]);
}

export function buildPersistedPipelineOutputs(projectValue: unknown): PersistedOutputs {
  const project = asRecord(projectValue);
  if (!project) return {};

  const concept = relation(project, "concept");
  const conceptMetadata = parseRecord(concept?.generationMetadata) ?? {};
  const conceptInput = parseRecord(concept?.inputData) ?? {};

  return {
    concept: concept
      ? {
          id: project.id,
          genre: concept.genre,
          primary_genre: conceptInput.primary_genre ?? concept.genre,
          aesthetic_profile: parseRecord(concept.aestheticProfile) ?? {},
          mechanic_set: parseRecord(concept.mechanicSet) ?? {},
          validation_report: parseRecord(concept.validationReport) ?? {},
          artifact: conceptMetadata.artifact,
        }
      : undefined,
    core_loop: parseRecord(relation(project, "coreLoop")?.fullProfile),
    mda: parseRecord(relation(project, "mdaProfile")?.fullProfile),
    balance: parseRecord(relation(project, "balanceResult")?.fullResult),
    progression: parseRecord(relation(project, "progression")?.fullProfile),
    economy: parseRecord(relation(project, "economy")?.fullProfile),
    gdd: parseRecord(relation(project, "gdd")?.fullProfile),
    validation: parseRecord(relation(project, "checklist")?.fullResults),
  };
}
