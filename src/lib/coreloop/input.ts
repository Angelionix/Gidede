import { extractConceptMechanics } from "@/lib/pipeline-context";

interface StoredConceptContext {
  id?: string | null;
  genre?: string | null;
  primaryAesthetic?: string | null;
  aestheticProfile?: unknown;
  mechanicSet?: unknown;
}

export interface ResolvedCoreLoopInput {
  conceptId: string;
  mechanics: string[];
  genre: string;
  primaryAesthetic: string | undefined;
  mechanicsSource: "request" | "concept" | "missing";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.map(nonEmptyString).filter((item): item is string => Boolean(item)))]
    : [];
}

/** Resolve the Core Loop design input without inventing generic mechanics. */
export function resolveCoreLoopInput(
  requestInput: unknown,
  projectGenre: string | null | undefined,
  concept: StoredConceptContext | null | undefined,
): ResolvedCoreLoopInput {
  const request = asRecord(requestInput) ?? {};
  const requestedMechanics = stringList(request.mechanics);
  const conceptMechanics = extractConceptMechanics({
    mechanic_set: asRecord(concept?.mechanicSet) ?? {},
  });
  const mechanics = requestedMechanics.length > 0 ? requestedMechanics : conceptMechanics;
  const aestheticProfile = asRecord(concept?.aestheticProfile);

  return {
    conceptId: nonEmptyString(request.concept_id) ?? nonEmptyString(concept?.id) ?? "standalone",
    mechanics,
    genre: nonEmptyString(request.genre)
      ?? nonEmptyString(concept?.genre)
      ?? nonEmptyString(projectGenre)
      ?? "action",
    primaryAesthetic: nonEmptyString(request.primary_aesthetic)
      ?? nonEmptyString(concept?.primaryAesthetic)
      ?? nonEmptyString(aestheticProfile?.primary),
    mechanicsSource: requestedMechanics.length > 0
      ? "request"
      : conceptMechanics.length > 0
        ? "concept"
        : "missing",
  };
}
