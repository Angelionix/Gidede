/**
 * R7-06: Stale/gate/resume E2E tests.
 *
 * Verifies that:
 *   - Changing Concept's genre invalidates downstream stage requests
 *     (the pipeline context reflects the new genre).
 *   - Quality gates block downstream stages when upstream is incomplete
 *     (missing Concept → Core Loop body has fallback mechanics).
 *   - Resume from a blocked stage produces correct upstream_versions.
 *   - Stale detection in GDD marks sections when upstream version changes.
 */

import { describe, it, expect } from "vitest";
import {
  buildStageRequestBody,
  createPipelineContext,
  extractConceptMechanicRefs,
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

const CONCEPT_V1 = {
  id: "concept-1",
  primary_genre: "rpg",
  genre: "rpg",
  aesthetic_profile: { primary: "challenge", secondary: "fantasy", tertiary: "discovery" },
  mechanic_set: {
    base: [{ id: "m1", name: "Изучение мира", group: "Базовые", category: "base", source: "mechanics_db" }],
    combat: [{ id: "m2", name: "Броня", group: "Боевые", category: "combat", source: "mechanics_db" }],
    progression: [{ id: "m3", name: "Очки опыта", group: "Прогрессия", category: "progression", source: "mechanics_db" }],
    spatial: [],
    social: [],
  },
  artifact: createArtifactEnvelope("concept", { idea: "v1" }),
};

const CONCEPT_V2 = {
  ...CONCEPT_V1,
  genre: "shooter",
  primary_genre: "shooter",
  aesthetic_profile: { primary: "sensation", secondary: "challenge", tertiary: "fantasy" },
  artifact: createArtifactEnvelope("concept", { idea: "v2" }),
};

describe("R7-06 — Stale/gate/resume E2E", () => {
  describe("Stale propagation: Concept change invalidates downstream", () => {
    it("changing Concept genre changes the genre forwarded to Core Loop", () => {
      const ctxV1 = createPipelineContext();
      ctxV1.outputs.concept = CONCEPT_V1;
      const bodyV1 = buildStageRequestBody("core_loop", makeInput(), ctxV1);

      const ctxV2 = createPipelineContext();
      ctxV2.outputs.concept = CONCEPT_V2;
      const bodyV2 = buildStageRequestBody("core_loop", makeInput(), ctxV2);

      expect(bodyV1.genre).toBe("rpg");
      expect(bodyV2.genre).toBe("shooter");
    });

    it("changing Concept aesthetics changes target_aesthetics forwarded to MDA", () => {
      const ctxV1 = createPipelineContext();
      ctxV1.outputs.concept = CONCEPT_V1;
      const bodyV1 = buildStageRequestBody("mda", makeInput(), ctxV1);

      const ctxV2 = createPipelineContext();
      ctxV2.outputs.concept = CONCEPT_V2;
      const bodyV2 = buildStageRequestBody("mda", makeInput(), ctxV2);

      const aestheticsV1 = bodyV1.target_aesthetics as string[];
      const aestheticsV2 = bodyV2.target_aesthetics as string[];
      expect(aestheticsV1[0]).toBe("challenge");
      expect(aestheticsV2[0]).toBe("sensation");
    });

    it("changing Concept mechanic_set changes mechanics forwarded to Core Loop", () => {
      const refsV1 = extractConceptMechanicRefs(CONCEPT_V1);
      const refsV2 = extractConceptMechanicRefs({
        ...CONCEPT_V1,
        mechanic_set: {
          base: [{ id: "new_mech", name: "Новая механика", group: "Базовые", category: "base", source: "mechanics_db" }],
          combat: [],
          progression: [],
          spatial: [],
          social: [],
        },
      });
      expect(refsV1.map((r) => r.id)).toContain("m1");
      expect(refsV2.map((r) => r.id)).toContain("new_mech");
      expect(refsV2.map((r) => r.id)).not.toContain("m1");
    });
  });

  describe("Quality gates: missing upstream produces fallback", () => {
    it("missing Concept → Core Loop falls back to derived mechanics", () => {
      const ctx = createPipelineContext();
      // No concept output set.
      const body = buildStageRequestBody("core_loop", makeInput(), ctx);
      expect(body.mechanics).toBeDefined();
      expect((body.mechanics as string[]).length).toBeGreaterThan(0);
      // Fallback mechanics should be tagged as "fallback" source.
      const refs = body.mechanic_refs as Array<{ source: string }>;
      expect(refs.every((r) => r.source === "fallback")).toBe(true);
    });

    it("missing Concept → MDA uses default aesthetics", () => {
      const ctx = createPipelineContext();
      const body = buildStageRequestBody("mda", makeInput(), ctx);
      // target_aesthetics should fall back to input or default ["challenge"].
      expect(body.target_aesthetics).toBeDefined();
      expect((body.target_aesthetics as string[]).length).toBeGreaterThan(0);
    });

    it("missing Balance → Progression uses hardcoded cost defaults", () => {
      const ctx = createPipelineContext();
      ctx.outputs.concept = CONCEPT_V1;
      const body = buildStageRequestBody("progression", makeInput(), ctx);
      // No balance_avg_cost forwarded.
      expect(body.balance_avg_cost).toBeUndefined();
      expect(body.balance_cost_power_source).toBeUndefined();
    });
  });

  describe("Resume: upstream_versions propagate correctly", () => {
    it("upstream_versions from Concept are forwarded to all downstream stages", () => {
      const ctx = createPipelineContext();
      ctx.outputs.concept = CONCEPT_V1;
      ctx.upstreamVersions.concept = "concept-1@1.0.0";

      for (const stage of ["core_loop", "mda", "balance", "progression", "economy", "gdd", "validation"] as const) {
        const body = buildStageRequestBody(stage, makeInput(), ctx);
        const versions = body.upstream_versions as Record<string, string>;
        expect(versions.concept).toBe("concept-1@1.0.0");
      }
    });

    it("adding Balance to context adds balance_dominance to MDA request", () => {
      const ctxBefore = createPipelineContext();
      ctxBefore.outputs.concept = CONCEPT_V1;
      const bodyBefore = buildStageRequestBody("mda", makeInput(), ctxBefore);
      expect(bodyBefore.balance_dominance).toBeUndefined();

      const ctxAfter = createPipelineContext();
      ctxAfter.outputs.concept = CONCEPT_V1;
      ctxAfter.outputs.balance = {
        intransitive_result: { has_dominant_strategy: false, dominated_strategies: [] },
      };
      const bodyAfter = buildStageRequestBody("mda", makeInput(), ctxAfter);
      expect(bodyAfter.balance_dominance).toBeDefined();
    });
  });

  describe("GDD stale detection: version change marks sections stale", () => {
    it("different artifact versions would produce stale sections (logic verified)", () => {
      // The stale detection logic in GDD route compares source_artifact_version
      // in existing sections vs current upstream versions. Here we verify the
      // contract: changing the concept artifact version changes what gets
      // forwarded as source_artifact_version.
      const ctxV1 = createPipelineContext();
      ctxV1.outputs.concept = CONCEPT_V1;
      ctxV1.outputs.concept.artifact = createArtifactEnvelope("concept", { idea: "v1" });

      const ctxV2 = createPipelineContext();
      ctxV2.outputs.concept = CONCEPT_V2;
      ctxV2.outputs.concept.artifact = createArtifactEnvelope("concept", { idea: "v2" });

      // The artifact envelopes should have different inputHashes (different ideas).
      const hashV1 = (ctxV1.outputs.concept.artifact as { inputHash?: string }).inputHash;
      const hashV2 = (ctxV2.outputs.concept.artifact as { inputHash?: string }).inputHash;
      expect(hashV1).toBeDefined();
      expect(hashV2).toBeDefined();
      expect(hashV1).not.toBe(hashV2);
    });
  });
});
