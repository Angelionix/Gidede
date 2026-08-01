/**
 * R4-07: Contract test proving the unified mechanic namespace flows
 * Concept → Core Loop → MDA without losing or inventing mechanic IDs.
 *
 * Verifies:
 *   - extractConceptMechanicRefs returns refs with stable ids matching the
 *     persisted mechanic_set entries.
 *   - buildStageRequestBody for core_loop and mda forwards the SAME mechanic
 *     refs (same id set) to downstream stages.
 *   - MDA receives mechanic_refs so it can read category from the ref instead
 *     of re-deriving it via name regex (which fails on Cyrillic).
 *   - Legacy backward compat: a Concept output with only `name` (no id/category)
 *     still produces refs with slugified ids.
 *   - Balance objects use the stable mechanic id from the ref, not a synthetic
 *     'mechanic_N'.
 */

import { describe, it, expect } from "vitest";
import {
  createPipelineContext,
  buildStageRequestBody,
  extractConceptMechanicRefs,
  type PipelineInput,
} from "@/lib/pipeline-context";
import { createArtifactEnvelope } from "@/lib/contracts/artifact-envelope";

function makeConceptOutput(mechanicSet: Record<string, unknown>) {
  return {
    id: "concept-1",
    primary_genre: "rpg",
    genre: "rpg",
    mechanic_set: mechanicSet,
    aesthetic_profile: { primary: "challenge", secondary: "fantasy", tertiary: "narrative" },
    artifact: createArtifactEnvelope("concept", { idea: "test" }),
  };
}

function makeInput(): PipelineInput {
  return {
    idea: "Build a dark castle and survive the night",
    genre: "rpg",
    useAi: false,
    targetAesthetics: [],
    totalLevels: 50,
    format: "one_sheet",
  };
}

const RPG_MECHANIC_SET = {
  base: [
    { id: "izuchenie_mira", name: "Изучение мира", group: "Базовые", category: "base", source: "mechanics_db" },
    { id: "dostizheniya_i_ochki", name: "Достижения и очки", group: "Базовые", category: "base", source: "mechanics_db" },
  ],
  combat: [
    { id: "bronya", name: "Броня", group: "Боевые", category: "combat", source: "mechanics_db" },
  ],
  progression: [
    { id: "ochki_opyta", name: "Очки опыта", group: "Прогрессия", category: "progression", source: "mechanics_db" },
  ],
  spatial: [
    { id: "map_exploration", name: "map_exploration", group: "spatial", category: "spatial", source: "genre_default" },
  ],
  social: [
    { id: "leaderboard", name: "leaderboard", group: "social", category: "social", source: "genre_default" },
  ],
};

describe("R4-07 — unified mechanic namespace contract", () => {
  it("extractConceptMechanicRefs returns refs with stable ids matching the persisted set", () => {
    const concept = makeConceptOutput(RPG_MECHANIC_SET);
    const refs = extractConceptMechanicRefs(concept);
    const ids = refs.map((r) => r.id).sort();
    expect(ids).toEqual([
      "bronya",
      "dostizheniya_i_ochki",
      "izuchenie_mira",
      "leaderboard",
      "map_exploration",
      "ochki_opyta",
    ]);
  });

  it("extractConceptMechanicRefs assigns canonical category from the mechanic_set key", () => {
    const concept = makeConceptOutput(RPG_MECHANIC_SET);
    const refs = extractConceptMechanicRefs(concept);
    const bronya = refs.find((r) => r.id === "bronya");
    expect(bronya).toBeDefined();
    expect(bronya!.category).toBe("combat");
    // The Russian name "Броня" would be miscategorised as "base" by the name
    // regex (no English keyword), but the ref carries the correct category.
    expect(bronya!.name).toBe("Броня");
  });

  it("buildStageRequestBody forwards the SAME mechanic refs to Core Loop", () => {
    const context = createPipelineContext();
    context.outputs.concept = makeConceptOutput(RPG_MECHANIC_SET);
    const body = buildStageRequestBody("core_loop", makeInput(), context);
    const refs = body.mechanic_refs as Array<{ id: string; name: string; category: string }>;
    expect(Array.isArray(refs)).toBe(true);
    expect(refs.length).toBe(6);
    const ids = refs.map((r) => r.id).sort();
    expect(ids).toContain("bronya");
    expect(ids).toContain("izuchenie_mira");
    expect(ids).toContain("ochki_opyta");
  });

  it("buildStageRequestBody forwards the SAME mechanic refs to MDA", () => {
    const context = createPipelineContext();
    context.outputs.concept = makeConceptOutput(RPG_MECHANIC_SET);
    const body = buildStageRequestBody("mda", makeInput(), context);
    const refs = body.mechanic_refs as Array<{ id: string; name: string; category: string }>;
    expect(Array.isArray(refs)).toBe(true);
    expect(refs.length).toBe(6);
    // Same id set as Core Loop received — no invention, no loss.
    const coreLoopBody = buildStageRequestBody("core_loop", makeInput(), context);
    const coreLoopIds = (coreLoopBody.mechanic_refs as Array<{ id: string }>)
      .map((r) => r.id).sort();
    const mdaIds = refs.map((r) => r.id).sort();
    expect(mdaIds).toEqual(coreLoopIds);
  });

  it("MDA receives ref.category so Cyrillic names are not miscategorised", () => {
    const context = createPipelineContext();
    context.outputs.concept = makeConceptOutput(RPG_MECHANIC_SET);
    const body = buildStageRequestBody("mda", makeInput(), context);
    const refs = body.mechanic_refs as Array<{ id: string; name: string; category: string }>;
    const bronya = refs.find((r) => r.id === "bronya");
    expect(bronya).toBeDefined();
    // The ref carries category="combat" (from MechanicsDB group "Боевые"), NOT
    // "base" (which the name regex would return for the Cyrillic name "Броня").
    expect(bronya!.category).toBe("combat");
  });

  it("Balance objects use the stable mechanic id from the ref, not synthetic 'mechanic_N'", () => {
    const context = createPipelineContext();
    context.outputs.concept = makeConceptOutput(RPG_MECHANIC_SET);
    const body = buildStageRequestBody("balance", makeInput(), context);
    const objects = body.objects as Array<{ id: string; name: string }>;
    expect(objects.length).toBeGreaterThan(0);
    // At least one object should have a MechanicsDB-derived id (not 'mechanic_N').
    const dbIds = objects.filter((o) => !o.id.startsWith("mechanic_"));
    expect(dbIds.length).toBeGreaterThan(0);
    expect(dbIds.some((o) => o.id === "bronya" || o.id === "izuchenie_mira")).toBe(true);
  });

  it("legacy backward compat: Concept output with only names still produces refs", () => {
    // Pre-R4-07 Concept output: entries have only {name, group}, no id/category.
    const legacySet = {
      base: [{ name: "Изучение мира", group: "Базовые" }],
      combat: [{ name: "Броня", group: "Боевые" }],
      progression: [{ name: "Очки опыта", group: "Прогрессия" }],
      spatial: [],
      social: [],
    };
    const concept = makeConceptOutput(legacySet);
    const refs = extractConceptMechanicRefs(concept);
    expect(refs.length).toBe(3);
    // Ids are slugified from the Russian names.
    expect(refs.map((r) => r.id).sort()).toEqual(["bronya", "izuchenie_mira", "ochki_opyta"]);
    // Category comes from the mechanic_set key (authoritative).
    expect(refs.find((r) => r.id === "bronya")!.category).toBe("combat");
  });

  it("fallback: when Concept has no mechanic_set, derived verbs are wrapped as refs", () => {
    const context = createPipelineContext();
    // Concept output with no mechanic_set at all.
    context.outputs.concept = {
      id: "concept-1",
      primary_genre: "rpg",
      genre: "rpg",
      aesthetic_profile: { primary: "challenge" },
      artifact: createArtifactEnvelope("concept", { idea: "test" }),
    };
    const body = buildStageRequestBody("core_loop", makeInput(), context);
    const refs = body.mechanic_refs as Array<{ id: string; source: string }>;
    expect(refs.length).toBeGreaterThan(0);
    // All refs should be tagged as fallback source.
    expect(refs.every((r) => r.source === "fallback")).toBe(true);
  });

  it("the same mechanic id appears in Concept, Core Loop and MDA outputs (end-to-end)", () => {
    const context = createPipelineContext();
    context.outputs.concept = makeConceptOutput(RPG_MECHANIC_SET);

    // Concept's persisted mechanic_set ids.
    const conceptRefs = extractConceptMechanicRefs(context.outputs.concept);
    const conceptIds = new Set(conceptRefs.map((r) => r.id));

    // Core Loop receives the same ids.
    const coreLoopBody = buildStageRequestBody("core_loop", makeInput(), context);
    const coreLoopIds = new Set(
      (coreLoopBody.mechanic_refs as Array<{ id: string }>).map((r) => r.id),
    );

    // MDA receives the same ids.
    const mdaBody = buildStageRequestBody("mda", makeInput(), context);
    const mdaIds = new Set(
      (mdaBody.mechanic_refs as Array<{ id: string }>).map((r) => r.id),
    );

    // All MechanicsDB-derived ids from Concept must be present in both
    // downstream stages (genre_default fallback ids may or may not appear,
    // but the MechanicsDB ones must survive).
    const mechanicsDbIds = new Set(
      conceptRefs.filter((r) => r.source === "mechanics_db").map((r) => r.id),
    );
    for (const id of mechanicsDbIds) {
      expect(coreLoopIds.has(id), `Core Loop missing id ${id}`).toBe(true);
      expect(mdaIds.has(id), `MDA missing id ${id}`).toBe(true);
    }
    // The id set is the same across all three stages.
    expect(coreLoopIds).toEqual(conceptIds);
    expect(mdaIds).toEqual(conceptIds);
  });
});
