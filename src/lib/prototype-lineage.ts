import { randomUUID } from "node:crypto";
import { z } from "zod";
import { hashArtifactInput } from "@/lib/contracts/artifact-envelope";
import type { ContractStageId } from "@/lib/contracts/stage-contracts";
import {
  parsePipelineFreshnessState,
  stageIsAcceptedFresh,
  type ArtifactFreshness,
  type PipelineFreshnessState,
} from "@/lib/pipeline-stale";

export const PROTOTYPE_ARTIFACT_SCHEMA_VERSION = "1.0.0" as const;

export interface PrototypeArtifact {
  prototypeId: string;
  schemaVersion: typeof PROTOTYPE_ARTIFACT_SCHEMA_VERSION;
  projectId: string;
  sourceArtifactVersions: Record<string, string>;
  inputHash: string;
  generatedAt: string;
}

export const prototypeArtifactSchema = z.object({
  prototypeId: z.string().trim().min(1),
  schemaVersion: z.literal(PROTOTYPE_ARTIFACT_SCHEMA_VERSION),
  projectId: z.string().trim().min(1),
  sourceArtifactVersions: z.record(z.string().trim().min(1), z.string().trim().min(1)),
  inputHash: z.string().regex(/^[a-f0-9]{64}$/),
  generatedAt: z.iso.datetime(),
});

export interface PrototypeFreshnessResult {
  fresh: boolean;
  reason: string | null;
}

export class PrototypeLineageError extends Error {
  constructor(
    public readonly code: "core_loop_missing" | "core_loop_not_accepted_fresh" | "upstream_not_accepted_fresh",
    message: string,
  ) {
    super(message);
    this.name = "PrototypeLineageError";
  }
}

function artifactRef(artifact: ArtifactFreshness): string {
  return `${artifact.artifactId}@${artifact.schemaVersion}`;
}

function requiredSourceVersions(state: PipelineFreshnessState): Record<string, string> {
  const coreLoop = state.artifacts.core_loop;
  if (!coreLoop) {
    throw new PrototypeLineageError(
      "core_loop_missing",
      "Сначала создайте и сохраните версионированный Core Loop.",
    );
  }
  if (!stageIsAcceptedFresh(state, "core_loop")) {
    throw new PrototypeLineageError(
      "core_loop_not_accepted_fresh",
      "Core Loop устарел или не прошёл quality gate; пересоберите его перед генерацией прототипа.",
    );
  }

  const versions = { ...coreLoop.upstreamVersions, core_loop: artifactRef(coreLoop) };
  for (const [stageName, recordedRef] of Object.entries(coreLoop.upstreamVersions)) {
    const stage = stageName as ContractStageId;
    const upstream = state.artifacts[stage];
    if (!upstream || !stageIsAcceptedFresh(state, stage) || artifactRef(upstream) !== recordedRef) {
      throw new PrototypeLineageError(
        "upstream_not_accepted_fresh",
        `Исходный артефакт ${stageName} отсутствует, устарел или не совпадает с lineage Core Loop.`,
      );
    }
  }

  return Object.fromEntries(Object.entries(versions).sort(([left], [right]) => left.localeCompare(right)));
}

export function createPrototypeArtifact(
  projectId: string,
  pipelineState: string | null | undefined,
  prototypeInput: unknown,
  options: { prototypeId?: string; generatedAt?: string } = {},
): PrototypeArtifact {
  const sourceArtifactVersions = requiredSourceVersions(parsePipelineFreshnessState(pipelineState));
  return {
    prototypeId: options.prototypeId || randomUUID(),
    schemaVersion: PROTOTYPE_ARTIFACT_SCHEMA_VERSION,
    projectId,
    sourceArtifactVersions,
    inputHash: hashArtifactInput({ projectId, sourceArtifactVersions, prototypeInput }),
    generatedAt: options.generatedAt || new Date().toISOString(),
  };
}

export function checkPrototypeFreshness(
  prototype: PrototypeArtifact,
  pipelineState: string | null | undefined,
): PrototypeFreshnessResult {
  const state = parsePipelineFreshnessState(pipelineState);

  for (const [stageName, expectedRef] of Object.entries(prototype.sourceArtifactVersions)) {
    const stage = stageName as ContractStageId;
    const current = state.artifacts[stage];
    if (!current) return { fresh: false, reason: `${stageName}:missing` };
    if (!stageIsAcceptedFresh(state, stage)) return { fresh: false, reason: `${stageName}:not_accepted_fresh` };
    const currentRef = artifactRef(current);
    if (currentRef !== expectedRef) {
      return { fresh: false, reason: `${stageName}:${expectedRef}->${currentRef}` };
    }
  }

  return { fresh: true, reason: null };
}
