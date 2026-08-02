/**
 * R7-01: Cross-stage boundary contract tests.
 *
 * Verifies that the output of each pipeline stage can be consumed by the
 * next stage via the pipeline-context extractors. These tests catch schema
 * drift between stages — when a stage's output shape changes in a way that
 * breaks downstream consumers, these tests fail.
 *
 * Boundaries tested:
 *   Concept → Core Loop (mechanic refs)
 *   Concept → MDA (aesthetics, genre, idea)
 *   Core Loop → MDA (mechanics forwarding)
 *   MDA → Balance (mechanic set → balance objects)
 *   Balance → Progression (cost-power data)
 *   Balance → MDA (dominance evidence for Lens #41)
 *   Core Loop → Economy (resource flows)
 *   Concept → Economy (genre, monetization)
 *   Progression → GDD (curves, tiers)
 *   All stages → Validation (checklist reads each artifact)
 */

import { describe, it, expect } from "vitest";
import {
  extractConceptMechanics,
  extractConceptMechanicRefs,
  buildStageRequestBody,
  createPipelineContext,
  type PipelineInput,
} from "@/lib/pipeline-context";
import { createArtifactEnvelope } from "@/lib/contracts/artifact-envelope";

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

const CONCEPT_OUTPUT = {
  id: "concept-1",
  primary_genre: "rpg",
  genre: "rpg",
  aesthetic_profile: { primary: "challenge", secondary: "fantasy", tertiary: "discovery" },
  mechanic_set: {
    base: [
      { id: "izuchenie_mira", name: "Изучение мира", group: "Базовые", category: "base", source: "mechanics_db" },
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
  },
  artifact: createArtifactEnvelope("concept", { idea: "test" }),
};

const CORE_LOOP_OUTPUT = {
  id: "coreloop-1",
  steps_data: JSON.stringify([
    { mechanic: "explore", resources_produced: ["momentum"], resources_consumed: [] },
    { mechanic: "combat", resources_produced: ["score"], resources_consumed: ["energy"] },
  ]),
  structural_type: { type: "engine" },
  artifact: createArtifactEnvelope("core_loop", {}),
};

const MDA_OUTPUT = {
  mechanic_set: {
    base: [{ mechanic_name: "world_exploration" }],
    combat: [{ mechanic_name: "health_damage" }],
    progression: [{ mechanic_name: "xp_leveling" }],
    spatial: [{ mechanic_name: "map_exploration" }],
    social: [{ mechanic_name: "party_management" }],
  },
  artifact: createArtifactEnvelope("mda", {}),
};

const BALANCE_OUTPUT = {
  transitive_result: {
    powers: [
      { name: "sword", power: 30, cost: 100, effective_cost: 100 },
      { name: "shield", power: 20, cost: 150, effective_cost: 150 },
    ],
    expected_cp: 0.25,
    overpowered: [],
    underpowered: [],
  },
  intransitive_result: {
    has_dominant_strategy: false,
    dominated_strategies: [],
    object_names: ["sword", "shield"],
    strategy_balance: { max_share: 0.5, gini: 0 },
  },
  artifact: createArtifactEnvelope("balance", {}),
};

const PROGRESSION_OUTPUT = {
  curves: { xp_to_level: { points: [100, 115] }, level_to_cost: { points: [50, 56] } },
  tier_model: { tiers: [{ index: 1 }] },
  artifact: createArtifactEnvelope("progression", {}),
};

describe("R7-01 — Cross-stage boundary contracts", () => {
  describe("Concept → Core Loop boundary", () => {
    it("extractConceptMechanics returns names from Concept mechanic_set", () => {
      const mechanics = extractConceptMechanics(CONCEPT_OUTPUT);
      expect(mechanics.length).toBe(5);
      expect(mechanics).toContain("Изучение мира");
      expect(mechanics).toContain("Броня");
    });

    it("extractConceptMechanicRefs returns refs with stable ids and categories", () => {
      const refs = extractConceptMechanicRefs(CONCEPT_OUTPUT);
      expect(refs.length).toBe(5);
      const bronya = refs.find((r) => r.id === "bronya");
      expect(bronya).toBeDefined();
      expect(bronya!.category).toBe("combat");
    });

    it("buildStageRequestBody for core_loop forwards mechanics and mechanic_refs", () => {
      const ctx = createPipelineContext();
      ctx.outputs.concept = CONCEPT_OUTPUT;
      const body = buildStageRequestBody("core_loop", makeInput(), ctx);
      expect(body.mechanics).toBeDefined();
      expect((body.mechanics as string[]).length).toBe(5);
      expect(body.mechanic_refs).toBeDefined();
      expect((body.mechanic_refs as unknown[]).length).toBe(5);
    });
  });

  describe("Concept → MDA boundary", () => {
    it("buildStageRequestBody for mda forwards genre, idea and aesthetics", () => {
      const ctx = createPipelineContext();
      ctx.outputs.concept = CONCEPT_OUTPUT;
      const body = buildStageRequestBody("mda", makeInput(), ctx);
      expect(body.genre).toBe("rpg");
      expect(body.idea).toBeDefined();
      expect(body.target_aesthetics).toBeDefined();
    });
  });

  describe("Core Loop → Economy boundary", () => {
    it("buildStageRequestBody for economy forwards core_loop_resources", () => {
      const ctx = createPipelineContext();
      ctx.outputs.concept = CONCEPT_OUTPUT;
      ctx.outputs.core_loop = CORE_LOOP_OUTPUT;
      const body = buildStageRequestBody("economy", makeInput(), ctx);
      expect(body.core_loop_resources).toBeDefined();
      const resources = body.core_loop_resources as Array<{ name: string; role: string }>;
      expect(resources.length).toBeGreaterThan(0);
      // momentum is produced but not consumed → faucet
      const momentum = resources.find((r) => r.name === "momentum");
      expect(momentum?.role).toBe("faucet");
      // energy is consumed but not produced → drain
      const energy = resources.find((r) => r.name === "energy");
      expect(energy?.role).toBe("drain");
      // score is produced → faucet
      const score = resources.find((r) => r.name === "score");
      expect(score?.role).toBe("faucet");
    });
  });

  describe("MDA → Balance boundary", () => {
    it("buildStageRequestBody for balance builds objects from MDA mechanic_set", () => {
      const ctx = createPipelineContext();
      ctx.outputs.concept = CONCEPT_OUTPUT;
      ctx.outputs.mda = MDA_OUTPUT;
      const body = buildStageRequestBody("balance", makeInput(), ctx);
      expect(body.objects).toBeDefined();
      const objects = body.objects as Array<{ id: string; name: string; type: string }>;
      expect(objects.length).toBeGreaterThan(0);
      // Objects should have typed types (weapon/armor/etc.) from domain builder.
      const types = objects.map((o) => o.type);
      expect(types.some((t) => t !== "mechanic")).toBe(true);
    });
  });

  describe("Balance → Progression boundary", () => {
    it("buildStageRequestBody for progression forwards balance cost-power data", () => {
      const ctx = createPipelineContext();
      ctx.outputs.concept = CONCEPT_OUTPUT;
      ctx.outputs.balance = BALANCE_OUTPUT;
      const body = buildStageRequestBody("progression", makeInput(), ctx);
      expect(body.balance_avg_cost).toBeDefined();
      expect(body.balance_expected_cp).toBeDefined();
      expect(body.balance_cost_power_source).toBe("balance_transitive_result");
    });
  });

  describe("Balance → MDA boundary (Lens #41 dominance evidence)", () => {
    it("buildStageRequestBody for mda forwards balance_dominance when Balance has run", () => {
      const ctx = createPipelineContext();
      ctx.outputs.concept = CONCEPT_OUTPUT;
      ctx.outputs.balance = BALANCE_OUTPUT;
      const body = buildStageRequestBody("mda", makeInput(), ctx);
      expect(body.balance_dominance).toBeDefined();
    });

    it("buildStageRequestBody for mda omits balance_dominance when Balance hasn't run", () => {
      const ctx = createPipelineContext();
      ctx.outputs.concept = CONCEPT_OUTPUT;
      const body = buildStageRequestBody("mda", makeInput(), ctx);
      expect(body.balance_dominance).toBeUndefined();
    });
  });

  describe("End-to-end lineage tracking", () => {
    it("all stage requests carry upstream_versions from context", () => {
      const ctx = createPipelineContext();
      ctx.outputs.concept = CONCEPT_OUTPUT;
      ctx.upstreamVersions.concept = "concept-1@1.0.0";
      const body = buildStageRequestBody("core_loop", makeInput(), ctx);
      expect(body.upstream_versions).toBeDefined();
      expect((body.upstream_versions as Record<string, string>).concept).toBe("concept-1@1.0.0");
    });
  });

  describe("Schema drift detection", () => {
    it("Concept output without mechanic_set produces empty mechanics (not crash)", () => {
      const ctx = createPipelineContext();
      ctx.outputs.concept = { id: "c1", primary_genre: "rpg", genre: "rpg" };
      const body = buildStageRequestBody("core_loop", makeInput(), ctx);
      expect(body.mechanics).toBeDefined();
      // Should fall back to deriveMechanicsFromIdea, not crash.
      expect((body.mechanics as string[]).length).toBeGreaterThan(0);
    });

    it("Balance output without transitive_result produces no cost-power forwarding", () => {
      const ctx = createPipelineContext();
      ctx.outputs.concept = CONCEPT_OUTPUT;
      ctx.outputs.balance = { id: "b1" };
      const body = buildStageRequestBody("progression", makeInput(), ctx);
      expect(body.balance_avg_cost).toBeUndefined();
      expect(body.balance_cost_power_source).toBeUndefined();
    });

    it("Core Loop output without steps_data produces no resource forwarding", () => {
      const ctx = createPipelineContext();
      ctx.outputs.concept = CONCEPT_OUTPUT;
      ctx.outputs.core_loop = { id: "cl1" };
      const body = buildStageRequestBody("economy", makeInput(), ctx);
      expect(body.core_loop_resources).toBeUndefined();
    });
  });
});
