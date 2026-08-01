import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
} from "@/lib/contracts/artifact-envelope";
import type { ContractStageId } from "@/lib/contracts/stage-contracts";

export const PIPELINE_DEPENDENCIES: Record<ContractStageId, readonly ContractStageId[]> = {
  concept: ["core_loop"],
  core_loop: ["mda"],
  mda: ["balance"],
  balance: ["progression", "economy"],
  progression: ["economy"],
  economy: ["gdd"],
  gdd: ["validation"],
  validation: [],
};

export interface ArtifactFreshness {
  artifactId: string;
  schemaVersion: string;
  inputHash: string;
  status: string;
  upstreamVersions: Record<string, string>;
  staleSince: string | null;
  staleReason: string | null;
  acceptedAt: string | null;
}

export interface PipelineFreshnessState {
  version: 1;
  artifacts: Partial<Record<ContractStageId, ArtifactFreshness>>;
}

export function parsePipelineFreshnessState(value: unknown): PipelineFreshnessState {
  if (typeof value !== "string" || !value.trim()) return { version: 1, artifacts: {} };
  try {
    const parsed = JSON.parse(value) as Partial<PipelineFreshnessState>;
    return parsed?.version === 1 && parsed.artifacts && typeof parsed.artifacts === "object"
      ? { version: 1, artifacts: parsed.artifacts }
      : { version: 1, artifacts: {} };
  } catch {
    return { version: 1, artifacts: {} };
  }
}

export function downstreamStages(stage: ContractStageId): ContractStageId[] {
  const visited = new Set<ContractStageId>();
  const queue = [...PIPELINE_DEPENDENCIES[stage]];
  while (queue.length > 0) {
    const candidate = queue.shift()!;
    if (visited.has(candidate)) continue;
    visited.add(candidate);
    queue.push(...PIPELINE_DEPENDENCIES[candidate]);
  }
  return [...visited];
}

export function recordFreshArtifact(
  current: PipelineFreshnessState,
  stage: ContractStageId,
  artifact: ArtifactEnvelope,
  accepted: boolean,
  now = new Date().toISOString(),
): PipelineFreshnessState {
  const artifacts = { ...current.artifacts };
  const previousArtifactId = artifacts[stage]?.artifactId;
  artifacts[stage] = {
    artifactId: artifact.artifactId,
    schemaVersion: artifact.schemaVersion,
    inputHash: artifact.inputHash,
    status: artifact.status,
    upstreamVersions: { ...artifact.upstreamVersions },
    staleSince: null,
    staleReason: null,
    acceptedAt: accepted ? now : null,
  };

  if (previousArtifactId !== artifact.artifactId) {
    for (const downstream of downstreamStages(stage)) {
      const existing = artifacts[downstream];
      if (!existing) continue;
      artifacts[downstream] = {
        ...existing,
        staleSince: existing.staleSince ?? now,
        staleReason: `${stage}:${previousArtifactId ?? "none"}->${artifact.artifactId}`,
      };
    }
  }

  return { version: 1, artifacts };
}

export function stageIsStale(
  state: PipelineFreshnessState,
  stage: ContractStageId,
): boolean {
  return Boolean(state.artifacts[stage]?.staleSince);
}

export function stageIsAcceptedFresh(
  state: PipelineFreshnessState,
  stage: ContractStageId,
): boolean {
  const artifact = state.artifacts[stage];
  return Boolean(
    artifact
    && artifact.status === "success"
    && artifact.acceptedAt
    && !artifact.staleSince,
  );
}

export const STAGE_COMPLETION_WEIGHTS: Record<ContractStageId, number> = {
  concept: 12,
  core_loop: 12,
  mda: 18,
  balance: 18,
  progression: 10,
  economy: 10,
  gdd: 10,
  validation: 10,
};

export function acceptedFreshCompletion(state: PipelineFreshnessState): number {
  return (Object.keys(STAGE_COMPLETION_WEIGHTS) as ContractStageId[])
    .filter((stage) => stageIsAcceptedFresh(state, stage))
    .reduce((sum, stage) => sum + STAGE_COMPLETION_WEIGHTS[stage], 0);
}

export function reconcilePipelineFreshness(
  current: PipelineFreshnessState,
  outputs: Partial<Record<ContractStageId, Record<string, unknown>>>,
  now = new Date().toISOString(),
): PipelineFreshnessState {
  const artifacts = { ...current.artifacts };

  for (const [stage, output] of Object.entries(outputs) as Array<[
    ContractStageId,
    Record<string, unknown> | undefined,
  ]>) {
    const artifact = artifactEnvelopeSchema.safeParse(output?.artifact);
    if (!artifact.success || artifact.data.artifactType !== stage || artifacts[stage]) continue;
    artifacts[stage] = {
      artifactId: artifact.data.artifactId,
      schemaVersion: artifact.data.schemaVersion,
      inputHash: artifact.data.inputHash,
      status: artifact.data.status,
      upstreamVersions: { ...artifact.data.upstreamVersions },
      staleSince: null,
      staleReason: null,
      acceptedAt: null,
    };
  }

  for (const [stage, artifact] of Object.entries(artifacts) as Array<[
    ContractStageId,
    ArtifactFreshness,
  ]>) {
    for (const [upstreamStage, recordedRef] of Object.entries(artifact.upstreamVersions)) {
      const upstream = artifacts[upstreamStage as ContractStageId];
      if (!upstream) continue;
      const currentRef = `${upstream.artifactId}@${upstream.schemaVersion}`;
      if (recordedRef === currentRef) continue;
      artifacts[stage] = {
        ...artifact,
        staleSince: artifact.staleSince ?? now,
        staleReason: `${upstreamStage}:${recordedRef}->${currentRef}`,
      };
      break;
    }
  }

  return { version: 1, artifacts };
}
