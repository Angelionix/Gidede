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
import {
  coerceToMechanicRef,
  type MechanicRef,
} from "@/lib/mechanic-ref";
import {
  buildBalanceObjects,
  type MdaMechanicSet,
} from "@/lib/balance/object-builder";

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

/**
 * R4-07: Extract mechanic refs (with stable id + category) from Concept's
 * persisted `mechanic_set`. Returns `MechanicRef[]` so downstream stages
 * (Core Loop, MDA) can use `ref.id` as the join key and `ref.category` as
 * the canonical 5-bucket — instead of re-deriving category from the name
 * via regex (which silently fails on Cyrillic).
 *
 * When the persisted entry already has `id` and `category` (R4-07+ Concept
 * output), they are preserved. When it's a legacy entry (only `name`), the
 * id is slugified and category is derived from the name — graceful fallback.
 */
export function extractConceptMechanicRefs(conceptOutput: unknown): MechanicRef[] {
  const concept = asRecord(conceptOutput);
  const mechanicSet = asRecord(concept?.mechanic_set);
  if (!mechanicSet) return [];

  const refs: MechanicRef[] = [];
  const seenIds = new Set<string>();
  for (const category of MECHANIC_CATEGORIES) {
    const entries = mechanicSet[category];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const ref = coerceToMechanicRef(entry, "mechanics_db");
      if (!ref) continue;
      // Override category with the canonical bucket from the mechanic_set key
      // (the key IS the authoritative category — Concept placed it there).
      ref.category = category as MechanicRef["category"];
      if (!seenIds.has(ref.id)) {
        seenIds.add(ref.id);
        refs.push(ref);
      }
    }
  }
  return refs;
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

/**
 * R4-07: Selected mechanic refs (with stable id + category) for forwarding
 * to downstream stages. Falls back to deriveMechanicsFromIdea verbs (as
 * refs) when Concept has no persisted mechanic_set.
 */
function selectedMechanicRefs(input: PipelineInput, context: PipelineContext): MechanicRef[] {
  const fromConcept = extractConceptMechanicRefs(context.outputs.concept);
  if (fromConcept.length > 0) return fromConcept;
  // Fallback: derive verbs from idea and wrap as refs.
  return deriveMechanicsFromIdea(input.idea).map((name) =>
    coerceToMechanicRef(name, "fallback")!,
  );
}

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function balanceObjects(
  mechanics: string[],
  refs: MechanicRef[],
  mdaMechanicSet: MdaMechanicSet | null | undefined,
): Array<Record<string, unknown>> {
  // R5-02: prefer domain-based builder (from MDA mechanic_set) over legacy
  // name-hash builder. Domain objects have meaningful types (weapon/armor/
  // upgrade/unit/support) and attributes derived from category semantics.
  return buildBalanceObjects(mdaMechanicSet, mechanics, refs, 8) as unknown as Array<Record<string, unknown>>;
}

function lineage(context: PipelineContext): Record<string, string> {
  return { ...context.upstreamVersions };
}

/**
 * R5-13: extract resource flows from Core Loop's stepsData so Economy can
 * build its Machinations model from the actual game loop instead of genre
 * presets. Returns null when Core Loop has not yet run.
 *
 * Reads stepsData[].resources_produced and stepsData[].resources_consumed
 * to build a deduplicated list of resource names with their roles.
 */
function extractCoreLoopResources(coreLoopOutput: unknown): Record<string, unknown> | null {
  const coreLoop = asRecord(coreLoopOutput);
  if (!coreLoop) return null;

  // stepsData may be a JSON string or already parsed.
  let steps: unknown = coreLoop.steps_data ?? coreLoop.stepsData;
  if (typeof steps === "string") {
    try { steps = JSON.parse(steps); } catch { return null; }
  }
  if (!Array.isArray(steps)) return null;

  const produced = new Set<string>();
  const consumed = new Set<string>();
  for (const step of steps) {
    const s = asRecord(step);
    if (!s) continue;
    const sp = Array.isArray(s.resources_produced) ? s.resources_produced : [];
    const sc = Array.isArray(s.resources_consumed) ? s.resources_consumed : [];
    for (const r of sp) {
      if (typeof r === "string" && r.trim()) produced.add(r.trim());
    }
    for (const r of sc) {
      if (typeof r === "string" && r.trim()) consumed.add(r.trim());
    }
  }

  if (produced.size === 0 && consumed.size === 0) return null;

  // Classify resources: anchor (produced AND consumed), faucet (produced only),
  // drain (consumed only).
  const all = new Set([...produced, ...consumed]);
  const resources = Array.from(all).map((name) => {
    const isProduced = produced.has(name);
    const isConsumed = consumed.has(name);
    const role = isProduced && isConsumed ? "anchor"
      : isProduced ? "faucet"
      : "drain";
    return { name, role, produced: isProduced, consumed: isConsumed };
  });

  return {
    core_loop_resources: resources,
    core_loop_resource_source: "core_loop_steps_data",
  };
}

/**
 * R5-10: extract cost-power data from Balance stage output so Progression's
 * level_to_cost curve can trace to the Balance artifact.
 *
 * Returns null when Balance has not yet run or the transitive result is
 * missing. When available, returns { balance_avg_power, balance_avg_cost,
 * balance_expected_cp, balance_cost_power_source }.
 */
function extractBalanceCostPower(balanceOutput: unknown): Record<string, unknown> | null {
  const balance = asRecord(balanceOutput);
  if (!balance) return null;
  const transitive = asRecord(balance?.transitive_result);
  if (!transitive) return null;

  // Extract avg power and avg cost from the transitive result.
  const powers = transitive.powers;
  const expectedCp = typeof transitive.expected_cp === "number" ? transitive.expected_cp : null;

  let avgPower: number | null = null;
  let avgCost: number | null = null;

  if (Array.isArray(powers)) {
    const powerValues = powers
      .map((p) => {
        const obj = asRecord(p);
        return typeof obj?.power === "number" ? obj.power : null;
      })
      .filter((v): v is number => v !== null);
    if (powerValues.length > 0) {
      avgPower = powerValues.reduce((s, v) => s + v, 0) / powerValues.length;
    }

    const costValues = powers
      .map((p) => {
        const obj = asRecord(p);
        return typeof obj?.cost === "number" ? obj.cost : (typeof obj?.effective_cost === "number" ? obj.effective_cost : null);
      })
      .filter((v): v is number => v !== null);
    if (costValues.length > 0) {
      avgCost = costValues.reduce((s, v) => s + v, 0) / costValues.length;
    }
  }

  if (avgPower === null && avgCost === null && expectedCp === null) return null;

  return {
    balance_avg_power: avgPower,
    balance_avg_cost: avgCost,
    balance_expected_cp: expectedCp,
    balance_cost_power_source: "balance_transitive_result",
  };
}

/**
 * R5-02: extract the MDA structured mechanic_set (5 categories) from the
 * MDA stage output record, so the Balance stage can build typed objects
 * from the domain model instead of hashing mechanic names.
 *
 * Returns null when MDA has not yet run or the mechanic_set is missing.
 */
function extractMdaMechanicSet(mdaOutput: unknown): MdaMechanicSet | null {
  const mda = asRecord(mdaOutput);
  if (!mda) return null;
  const mechanicSet = asRecord(mda?.mechanic_set);
  if (!mechanicSet) return null;

  const extractCategory = (key: string): Array<{ mechanic_name: string }> => {
    const arr = mechanicSet[key];
    if (!Array.isArray(arr)) return [];
    return arr
      .map((m) => {
        if (typeof m === "string") return { mechanic_name: m };
        const obj = asRecord(m);
        if (typeof obj?.mechanic_name === "string") return { mechanic_name: obj.mechanic_name };
        if (typeof obj?.name === "string") return { mechanic_name: obj.name };
        return null;
      })
      .filter((m): m is { mechanic_name: string } => m !== null);
  };

  return {
    base: extractCategory("base"),
    combat: extractCategory("combat"),
    progression: extractCategory("progression"),
    spatial: extractCategory("spatial"),
    social: extractCategory("social"),
  };
}

export function buildStageRequestBody(
  stage: ContractStageId,
  input: PipelineInput,
  context: PipelineContext,
): Record<string, unknown> {
  const genre = conceptGenre(input, context);
  const mechanics = selectedMechanics(input, context);
  const mechanicRefs = selectedMechanicRefs(input, context);
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
        // R4-07: forward structured refs with stable id + category so Core Loop
        // and downstream stages share the same mechanic namespace as Concept.
        mechanic_refs: mechanicRefs,
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
        // R4-07: forward structured refs so MDA reads category from the ref
        // instead of re-deriving it via name regex (which fails on Cyrillic).
        mechanic_refs: mechanicRefs,
        // R4-09: forward Balance dominance evidence when Balance has already
        // run (e.g. MDA re-run after stale propagation). When absent (first
        // forward pass, MDA before Balance), MDA's Lens #41 falls back to the
        // synergy proxy with source="heuristic".
        ...(context.outputs.balance ? { balance_dominance: context.outputs.balance } : {}),
        use_ai: input.useAi,
        upstream_versions: upstreamVersions,
      };
    case "balance":
      return {
        // R5-02: build objects from MDA mechanic_set when available (domain
        // model with typed weapon/armor/upgrade/unit/support), falling back
        // to legacy name-hash builder when MDA has not yet run.
        objects: balanceObjects(mechanics, mechanicRefs, extractMdaMechanicSet(context.outputs.mda)),
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
        // R5-10: forward Balance cost-power data so Progression's level_to_cost
        // curve traces to the Balance artifact instead of hardcoded base=50.
        ...(extractBalanceCostPower(context.outputs.balance) ?? {}),
      };
    case "economy":
      return {
        genre,
        use_ai: input.useAi,
        upstream_versions: upstreamVersions,
        // R5-13: forward Core Loop resource flows so Economy builds from the
        // actual game loop instead of genre presets. Also forward Progression's
        // economy link for monetization context.
        ...(extractCoreLoopResources(context.outputs.core_loop) ?? {}),
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
