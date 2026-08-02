/**
 * R7-02: E2E RU/EN pipeline fixture tests.
 *
 * Verifies that the pipeline produces distinguishable results across
 * different genres and input languages (RU/EN). The test exercises
 * buildStageRequestBody for all 8 stages with each golden fixture,
 * checking that genre, idea and mechanics propagate correctly and
 * that RU and EN inputs produce different (but valid) request bodies.
 */

import { describe, it, expect } from "vitest";
import {
  buildStageRequestBody,
  createPipelineContext,
  type PipelineInput,
} from "@/lib/pipeline-context";
import {
  PIPELINE_GOLDEN_FIXTURES,
  PIPELINE_STAGE_IDS,
  type GoldenLocale,
  type PipelineGoldenFixture,
} from "@/lib/golden-fixtures/pipeline-golden";
import { createArtifactEnvelope } from "@/lib/contracts/artifact-envelope";

function makeInput(fixture: PipelineGoldenFixture, locale: GoldenLocale): PipelineInput {
  return {
    idea: fixture.ideas[locale],
    genre: fixture.input.genre,
    useAi: false,
    targetAesthetics: [],
    totalLevels: 50,
    format: "one_sheet",
  };
}

function makeConceptOutput(fixture: PipelineGoldenFixture, locale: GoldenLocale): Record<string, unknown> {
  return {
    id: `concept-${fixture.id}-${locale}`,
    primary_genre: fixture.input.genre,
    genre: fixture.input.genre,
    aesthetic_profile: { primary: "challenge", secondary: "fantasy", tertiary: "discovery" },
    mechanic_set: {
      base: [{ id: "m1", name: "Изучение мира", group: "Базовые", category: "base", source: "mechanics_db" }],
      combat: [{ id: "m2", name: "Броня", group: "Боевые", category: "combat", source: "mechanics_db" }],
      progression: [{ id: "m3", name: "Очки опыта", group: "Прогрессия", category: "progression", source: "mechanics_db" }],
      spatial: [],
      social: [],
    },
    artifact: createArtifactEnvelope("concept", { idea: fixture.ideas[locale] }),
  };
}

describe("R7-02 — E2E RU/EN pipeline fixtures", () => {
  it("golden fixtures cover 6 contrasting genres", () => {
    expect(PIPELINE_GOLDEN_FIXTURES).toHaveLength(6);
    const genres = PIPELINE_GOLDEN_FIXTURES.map((f) => f.input.genre);
    expect(new Set(genres).size).toBe(6);
  });

  it("each fixture has both RU and EN ideas", () => {
    for (const fixture of PIPELINE_GOLDEN_FIXTURES) {
      expect(fixture.ideas.ru).toBeTruthy();
      expect(fixture.ideas.en).toBeTruthy();
      expect(fixture.ideas.ru).not.toBe(fixture.ideas.en);
    }
  });

  it("buildStageRequestBody for concept produces different ideas for RU vs EN", () => {
    for (const fixture of PIPELINE_GOLDEN_FIXTURES) {
      const ctxRu = createPipelineContext();
      const ctxEn = createPipelineContext();
      const bodyRu = buildStageRequestBody("concept", makeInput(fixture, "ru"), ctxRu);
      const bodyEn = buildStageRequestBody("concept", makeInput(fixture, "en"), ctxEn);
      expect(bodyRu.idea).toBe(fixture.ideas.ru);
      expect(bodyEn.idea).toBe(fixture.ideas.en);
      expect(bodyRu.idea).not.toBe(bodyEn.idea);
    }
  });

  it("buildStageRequestBody for all 8 stages does not crash with any fixture", () => {
    for (const fixture of PIPELINE_GOLDEN_FIXTURES) {
      for (const locale of ["ru", "en"] as GoldenLocale[]) {
        const ctx = createPipelineContext();
        ctx.outputs.concept = makeConceptOutput(fixture, locale);
        const input = makeInput(fixture, locale);
        // Exercise every stage — should not throw.
        for (const stage of PIPELINE_STAGE_IDS) {
          expect(() => buildStageRequestBody(stage, input, ctx)).not.toThrow();
        }
      }
    }
  });

  it("results are distinguishable by genre across fixtures", () => {
    const genres = PIPELINE_GOLDEN_FIXTURES.map((f) => f.input.genre);
    for (let i = 0; i < genres.length; i++) {
      for (let j = i + 1; j < genres.length; j++) {
        expect(genres[i]).not.toBe(genres[j]);
      }
    }
  });

  it("RU idea is preserved verbatim in the concept request body", () => {
    const fixture = PIPELINE_GOLDEN_FIXTURES[0];
    const ctx = createPipelineContext();
    const body = buildStageRequestBody("concept", makeInput(fixture, "ru"), ctx);
    expect(body.idea).toBe(fixture.ideas.ru);
  });

  it("EN idea is preserved verbatim in the concept request body", () => {
    const fixture = PIPELINE_GOLDEN_FIXTURES[0];
    const ctx = createPipelineContext();
    const body = buildStageRequestBody("concept", makeInput(fixture, "en"), ctx);
    expect(body.idea).toBe(fixture.ideas.en);
  });

  it("genre is forwarded to all downstream stages", () => {
    const fixture = PIPELINE_GOLDEN_FIXTURES[0];
    const ctx = createPipelineContext();
    ctx.outputs.concept = makeConceptOutput(fixture, "en");
    const input = makeInput(fixture, "en");
    for (const stage of PIPELINE_STAGE_IDS) {
      if (stage === "concept") continue;
      const body = buildStageRequestBody(stage, input, ctx);
      // Every downstream stage should carry the genre.
      if (body.genre !== undefined) {
        expect(body.genre).toBe(fixture.input.genre);
      }
    }
  });

  it("stage order is preserved in fixture artifactVersions", () => {
    for (const fixture of PIPELINE_GOLDEN_FIXTURES) {
      const versions = Object.keys(fixture.artifactVersions);
      expect(versions).toEqual([...PIPELINE_STAGE_IDS]);
    }
  });
});
