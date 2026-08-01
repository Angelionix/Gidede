import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

export const ARTIFACT_ENVELOPE_VERSION = 1 as const;
export const ARTIFACT_SCHEMA_VERSION = "1.0.0" as const;

export const ARTIFACT_STAGE_IDS = [
  "concept",
  "core_loop",
  "mda",
  "balance",
  "progression",
  "economy",
  "gdd",
  "validation",
] as const;

export const ARTIFACT_STATUSES = [
  "success",
  "partial",
  "failed",
  "blocked",
  "needs_review",
] as const;

export type ArtifactStageId = (typeof ARTIFACT_STAGE_IDS)[number];
export type ArtifactStatus = (typeof ARTIFACT_STATUSES)[number];

export interface ArtifactEnvelope {
  artifactId: string;
  artifactType: ArtifactStageId;
  envelopeVersion: typeof ARTIFACT_ENVELOPE_VERSION;
  schemaVersion: typeof ARTIFACT_SCHEMA_VERSION;
  upstreamVersions: Record<string, string>;
  inputHash: string;
  status: ArtifactStatus;
  createdAt: string;
}

export const artifactEnvelopeSchema = z.object({
  artifactId: z.uuid(),
  artifactType: z.enum(ARTIFACT_STAGE_IDS),
  envelopeVersion: z.literal(ARTIFACT_ENVELOPE_VERSION),
  schemaVersion: z.literal(ARTIFACT_SCHEMA_VERSION),
  upstreamVersions: z.record(z.string().trim().min(1), z.string().trim().min(1)),
  inputHash: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.enum(ARTIFACT_STATUSES),
  createdAt: z.iso.datetime(),
});

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, nested]) => nested !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return String(value);
}

export function hashArtifactInput(input: unknown): string {
  const canonicalJson = JSON.stringify(canonicalize(input)) ?? "null";
  return createHash("sha256").update(canonicalJson).digest("hex");
}

export function readUpstreamVersions(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const upstream = (input as Record<string, unknown>).upstream_versions;
  if (!upstream || typeof upstream !== "object" || Array.isArray(upstream)) return {};

  return Object.fromEntries(
    Object.entries(upstream as Record<string, unknown>)
      .filter(([key, version]) => key.trim().length > 0 && typeof version === "string" && version.trim().length > 0)
      .map(([key, version]) => [key.trim(), (version as string).trim()])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function createArtifactEnvelope(
  artifactType: ArtifactStageId,
  input: unknown,
  status: ArtifactStatus = "success",
): ArtifactEnvelope {
  return {
    artifactId: randomUUID(),
    artifactType,
    envelopeVersion: ARTIFACT_ENVELOPE_VERSION,
    schemaVersion: ARTIFACT_SCHEMA_VERSION,
    upstreamVersions: readUpstreamVersions(input),
    inputHash: hashArtifactInput(input),
    status,
    createdAt: new Date().toISOString(),
  };
}
