/**
 * Input hash for PrototypeCompileInput.
 *
 * Hashes the Core Loop snapshot that the compiler consumes. If the input
 * changes (different mechanics, steps, resources, or fun hypothesis), the
 * input hash changes — and the resulting prototype must be recompiled.
 *
 * Design spec: docs/PLAYABLE_PROTOTYPE_COMPILER_DESIGN.md (section 5)
 *
 * This mirrors the existing artifact inputHash contract from
 * src/lib/contracts/artifact-envelope.ts, but is specialized for the
 * prototype compiler's input shape.
 */

import { createHash } from "crypto";

// ============================================================
// Input shape (mirrors PrototypeCompileInput from design spec section 5)
// ============================================================

export interface PrototypeCompileInput {
  projectId: string;
  coreLoopArtifactRef: string;
  conceptArtifactRef: string;
  genre: string;
  structuralType: string;
  structuralSubtype?: string;
  steps: Array<{
    id: string;
    action: string;
    mechanicIds: string[];
    resourcesConsumed: string[];
    resourcesProduced: string[];
    feedbackType: "positive" | "negative" | "neutral";
    durationEstimateSec: number;
  }>;
  resourceGraph: {
    edges: Array<{ fromStepId: string; toStepId: string; resourceIds: string[] }>;
  };
  funHypothesis: {
    hypothesisId: string;
    statement: string;
    protocol: unknown;
  } | null;
  buildOptions: {
    dimensions: Array<"2d" | "3d">;
    targetSessionSec: number;
    difficulty: "easy" | "baseline" | "hard";
    seed?: string;
    mappingOverrides?: Record<string, string>;
  };
}

function canonicalJsonStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJsonStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`).join(",")}}`;
}

/**
 * Compute a stable input hash for a PrototypeCompileInput.
 * Returns a 16-character hex string.
 */
export function computeInputHash(input: PrototypeCompileInput): string {
  // Normalize: sort steps by id, sort edges by from→to, sort mechanic IDs.
  const normalized = {
    projectId: input.projectId,
    coreLoopArtifactRef: input.coreLoopArtifactRef,
    conceptArtifactRef: input.conceptArtifactRef,
    genre: input.genre,
    structuralType: input.structuralType,
    structuralSubtype: input.structuralSubtype ?? null,
    steps: input.steps
      .map((s) => ({
        id: s.id,
        action: s.action,
        mechanicIds: [...s.mechanicIds].sort(),
        resourcesConsumed: [...s.resourcesConsumed].sort(),
        resourcesProduced: [...s.resourcesProduced].sort(),
        feedbackType: s.feedbackType,
        durationEstimateSec: s.durationEstimateSec,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    resourceGraphEdges: input.resourceGraph.edges
      .map((e) => ({
        fromStepId: e.fromStepId,
        toStepId: e.toStepId,
        resourceIds: [...e.resourceIds].sort(),
      }))
      .sort((a, b) =>
        a.fromStepId.localeCompare(b.fromStepId) ||
        a.toStepId.localeCompare(b.toStepId),
      ),
    funHypothesis: input.funHypothesis
      ? {
          hypothesisId: input.funHypothesis.hypothesisId,
          statement: input.funHypothesis.statement,
        }
      : null,
    buildOptions: {
      dimensions: [...input.buildOptions.dimensions].sort(),
      targetSessionSec: input.buildOptions.targetSessionSec,
      difficulty: input.buildOptions.difficulty,
      seed: input.buildOptions.seed ?? null,
      mappingOverrides: input.buildOptions.mappingOverrides
        ? sortRecordKeys(input.buildOptions.mappingOverrides)
        : null,
    },
  };

  const canonical = canonicalJsonStringify(normalized);
  const fullHash = createHash("sha256").update(canonical, "utf8").digest("hex");
  return fullHash.substring(0, 16);
}

function sortRecordKeys(record: Record<string, string>): Record<string, string> {
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(record).sort()) {
    sorted[key] = record[key];
  }
  return sorted;
}
