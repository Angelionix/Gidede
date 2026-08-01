import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
} from "@/lib/contracts/artifact-envelope";
import {
  isGddDocumentFormat,
  normalizeGddInputAliases,
  normalizeProgressionInputAliases,
  type ContractStageId,
  type GddDocumentFormat,
} from "@/lib/contracts/stage-contracts";

export interface PipelineInput {
  idea: string;
  genre?: string | null;
  useAi: boolean;
  targetAesthetics: string[];
  totalLevels: number;
  format: GddDocumentFormat;
}

export interface PipelineContext {
  outputs: Partial<Record<ContractStageId, Record<string, unknown>>>;
  upstreamVersions: Record<string, string>;
}

const MECHANIC_CATEGORIES = ["base", "combat", "progression", "spatial", "social"] as const;

export function createPipelineContext(): PipelineContext {
  return { outputs: {}, upstreamVersions: {} };
}

export function resolvePipelineIdea(
  requestedIdea: unknown,
  projectDescription: string | null | undefined,
  projectName: string,
): string | null {
  const candidates = [requestedIdea, projectDescription, projectName];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const normalized = candidate.trim();
    if (normalized.length >= 10) return normalized;
  }
  return null;
}

export function resolvePipelineInput(
  requestBody: unknown,
  idea: string,
  projectGenre: string | null | undefined,
): PipelineInput {
  const body = asRecord(requestBody) ?? {};
  const progression = asRecord(normalizeProgressionInputAliases(body)) ?? {};
  const gdd = asRecord(normalizeGddInputAliases(body)) ?? {};
  const requestedLevels = Number(progression.target_levels);
  const requestedFormat = gdd.target_format;

  return {
    idea,
    genre: typeof body.genre === "string" && body.genre.trim()
      ? body.genre.trim()
      : projectGenre ?? null,
    useAi: body.use_ai === true || body.use_ai === "true",
    targetAesthetics: Array.isArray(body.target_aesthetics)
      ? body.target_aesthetics.filter(
          (aesthetic): aesthetic is string => typeof aesthetic === "string" && aesthetic.trim().length > 0,
        )
      : [],
    totalLevels: Number.isFinite(requestedLevels) && requestedLevels > 0
      ? Math.min(500, requestedLevels)
      : 50,
    format: isGddDocumentFormat(requestedFormat) ? requestedFormat : "one_sheet",
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function artifactRef(artifact: ArtifactEnvelope): string {
  return `${artifact.artifactId}@${artifact.schemaVersion}`;
}

export function recordStageOutput(
  context: PipelineContext,
  stage: ContractStageId,
  output: unknown,
): ArtifactEnvelope {
  const record = asRecord(output);
  if (!record) throw new Error(`Stage ${stage} returned a non-object payload`);

  const artifact = artifactEnvelopeSchema.parse(record.artifact);
  if (artifact.artifactType !== stage) {
    throw new Error(`Stage ${stage} returned artifact type ${artifact.artifactType}`);
  }

  context.outputs[stage] = record;
  context.upstreamVersions[stage] = artifactRef(artifact);
  return artifact;
}

export function seedStageOutput(
  context: PipelineContext,
  stage: ContractStageId,
  output: unknown,
): ArtifactEnvelope | null {
  const record = asRecord(output);
  if (!record) return null;
  context.outputs[stage] = record;

  const artifact = artifactEnvelopeSchema.safeParse(record.artifact);
  if (artifact.success && artifact.data.artifactType === stage) {
    context.upstreamVersions[stage] = artifactRef(artifact.data);
    return artifact.data;
  }
  return null;
}

export function extractConceptMechanics(conceptOutput: unknown): string[] {
  const concept = asRecord(conceptOutput);
  const mechanicSet = asRecord(concept?.mechanic_set);
  if (!mechanicSet) return [];

  const mechanics: string[] = [];
  for (const category of MECHANIC_CATEGORIES) {
    const entries = mechanicSet[category];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const name = typeof entry === "string"
        ? entry.trim()
        : typeof asRecord(entry)?.name === "string"
          ? (asRecord(entry)!.name as string).trim()
          : "";
      if (name && !mechanics.includes(name)) mechanics.push(name);
    }
  }
  return mechanics;
}

function deriveMechanicsFromIdea(idea: string): string[] {
  const text = idea.toLowerCase();
  const candidates = [
    { keywords: ["combat", "fight", "shoot", "attack", "battle", "бой", "стрел", "атак"], mechanic: "combat" },
    { keywords: ["explore", "discover", "map", "world", "исслед", "мир", "карт"], mechanic: "explore" },
    { keywords: ["collect", "gather", "loot", "farm", "собир", "добыч"], mechanic: "collect" },
    { keywords: ["build", "craft", "construct", "стро", "созда"], mechanic: "build" },
    { keywords: ["puzzle", "solve", "logic", "головолом", "логик"], mechanic: "puzzle" },
    { keywords: ["race", "speed", "run", "гонк", "скорост"], mechanic: "race" },
    { keywords: ["survive", "survival", "endure", "выжив"], mechanic: "survive" },
    { keywords: ["trade", "economy", "market", "торг", "эконом", "рынок"], mechanic: "trade" },
  ];
  const picked = candidates
    .filter((candidate) => candidate.keywords.some((keyword) => text.includes(keyword)))
    .map((candidate) => candidate.mechanic);
  return [...new Set([...picked, "explore", "interact", "progress"])].slice(0, 4);
}

function conceptGenre(input: PipelineInput, context: PipelineContext): string {
  const concept = asRecord(context.outputs.concept);
  const generated = concept?.primary_genre ?? concept?.genre;
  return typeof generated === "string" && generated.trim()
    ? generated.trim()
    : input.genre?.trim() || "rpg";
}

function conceptAesthetics(input: PipelineInput, context: PipelineContext): string[] {
  if (input.targetAesthetics.length > 0) return [...input.targetAesthetics];
  const concept = asRecord(context.outputs.concept);
  const profile = asRecord(concept?.aesthetic_profile);
  if (!profile) return ["challenge"];
  return [profile.primary, profile.secondary, profile.tertiary]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());
}

function selectedMechanics(input: PipelineInput, context: PipelineContext): string[] {
  const fromConcept = extractConceptMechanics(context.outputs.concept);
  return fromConcept.length > 0 ? fromConcept : deriveMechanicsFromIdea(input.idea);
}

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function balanceObjects(mechanics: string[]): Array<Record<string, unknown>> {
  const source = mechanics.length >= 2 ? mechanics : [...mechanics, "secondary mechanic"];
  return source.slice(0, 8).map((name, index) => {
    const hash = hashText(name);
    return {
      id: `mechanic_${index + 1}`,
      name,
      type: "mechanic",
      attributes: {
        power: 20 + (hash % 61),
        speed: 1 + ((hash >>> 8) % 10),
        utility: 10 + ((hash >>> 16) % 51),
      },
      cost: 50 + (hash % 451),
      tier: 1 + (index % 3),
    };
  });
}

function lineage(context: PipelineContext): Record<string, string> {
  return { ...context.upstreamVersions };
}

export function buildStageRequestBody(
  stage: ContractStageId,
  input: PipelineInput,
  context: PipelineContext,
): Record<string, unknown> {
  const genre = conceptGenre(input, context);
  const mechanics = selectedMechanics(input, context);
  const concept = asRecord(context.outputs.concept);
  const aesthetics = conceptAesthetics(input, context);
  const upstreamVersions = lineage(context);

  switch (stage) {
    case "concept":
      return {
        idea: input.idea,
        ...(input.genre ? { genre: input.genre } : {}),
        use_ai: input.useAi,
        upstream_versions: upstreamVersions,
      };
    case "core_loop":
      return {
        concept_id: typeof concept?.id === "string" ? concept.id : "standalone",
        mechanics,
        genre,
        primary_aesthetic: aesthetics[0],
        use_ai: input.useAi,
        upstream_versions: upstreamVersions,
      };
    case "mda":
      return {
        concept_id: typeof concept?.id === "string" ? concept.id : "standalone",
        idea: input.idea,
        genre,
        target_aesthetics: aesthetics,
        existing_mechanics: mechanics,
        use_ai: input.useAi,
        upstream_versions: upstreamVersions,
      };
    case "balance":
      return {
        objects: balanceObjects(mechanics),
        game_mode: genre === "fighting" ? "PvP" : "PvE",
        genre,
        use_ai: input.useAi,
        upstream_versions: upstreamVersions,
      };
    case "progression":
      return {
        genre,
        target_levels: input.totalLevels,
        use_ai: input.useAi,
        upstream_versions: upstreamVersions,
      };
    case "economy":
      return {
        genre,
        use_ai: input.useAi,
        upstream_versions: upstreamVersions,
      };
    case "gdd":
      return {
        target_format: input.format,
        use_ai: input.useAi,
        upstream_versions: upstreamVersions,
      };
    case "validation":
      return { upstream_versions: upstreamVersions };
  }
}
