import { describe, expect, it } from "vitest";
import { validateConceptInput } from "@/lib/concept/validation-input";
import {
  GOLDEN_FIXTURE_SCHEMA_VERSION,
  PIPELINE_GOLDEN_FIXTURES,
  PIPELINE_STAGE_IDS,
} from "./pipeline-golden";

const CYRILLIC = /[А-Яа-яЁё]/;
const LATIN = /[A-Za-z]/;

describe("pipeline golden fixtures", () => {
  it("contains six contrasting, uniquely identified genres", () => {
    expect(PIPELINE_GOLDEN_FIXTURES).toHaveLength(6);
    expect(new Set(PIPELINE_GOLDEN_FIXTURES.map((fixture) => fixture.id)).size).toBe(6);
    expect(new Set(PIPELINE_GOLDEN_FIXTURES.map((fixture) => fixture.input.genre)).size).toBe(6);
  });

  it("contains a valid RU and EN Concept input for every genre", () => {
    for (const fixture of PIPELINE_GOLDEN_FIXTURES) {
      expect(fixture.ideas.ru).toMatch(CYRILLIC);
      expect(fixture.ideas.en).toMatch(LATIN);
      expect(fixture.ideas.ru).not.toBe(fixture.ideas.en);

      for (const locale of fixture.expectedInvariants.locales) {
        const result = validateConceptInput({
          ...fixture.input,
          idea: fixture.ideas[locale],
        });

        expect(result.valid, `${fixture.id}/${locale}: ${result.error ?? "invalid"}`).toBe(true);
        expect(result.idea).toBe(fixture.ideas[locale]);
        expect(result.genre).toBe(fixture.expectedInvariants.normalizedGenre);
        expect(result.subgenres).toEqual(fixture.expectedInvariants.requiredSubgenres);
        expect(result.forbiddenMechanics).toEqual(fixture.input.forbidden_mechanics);
        expect(result.use_ai).toBe(false);
      }
    }
  });

  it("pins every fixture and stage to an explicit positive artifact version", () => {
    for (const fixture of PIPELINE_GOLDEN_FIXTURES) {
      expect(fixture.schemaVersion).toBe(GOLDEN_FIXTURE_SCHEMA_VERSION);
      expect(Object.keys(fixture.artifactVersions)).toEqual([...PIPELINE_STAGE_IDS]);
      expect(fixture.expectedInvariants.stageOrder).toEqual(PIPELINE_STAGE_IDS);

      for (const stage of PIPELINE_STAGE_IDS) {
        expect(Number.isInteger(fixture.artifactVersions[stage])).toBe(true);
        expect(fixture.artifactVersions[stage]).toBeGreaterThan(0);
      }
    }
  });

  it("keeps invariants aligned with the executable input", () => {
    for (const fixture of PIPELINE_GOLDEN_FIXTURES) {
      expect(fixture.expectedInvariants.normalizedGenre).toBe(fixture.input.genre);
      expect(fixture.expectedInvariants.requiredSubgenres).toEqual(fixture.input.subgenres);
      expect(fixture.expectedInvariants.preserveIdeaVerbatim).toBe(true);
      expect(fixture.expectedInvariants.excludeForbiddenMechanics).toBe(true);
      expect(fixture.expectedInvariants.aiIndependentBaseline).toBe(true);
      expect(fixture.input.use_ai).toBe(false);
    }
  });
});
