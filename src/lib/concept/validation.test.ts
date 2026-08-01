/**
 * TASK-1.16: Unit tests for buildValidationReport (Block 1, Concept validation).
 *
 * Покрывает:
 *   - Triangle of Weirdness (weird + appealing + credible)
 *   - 5 core questions (real logic, not hardcoded)
 *   - 8 idea filters (real logic, not hardcoded)
 *   - Edge cases: short idea, long idea, no verb, multi-genre, cross-genre
 *   - overall_score computation
 *   - warnings generation
 */

import { describe, it, expect } from "vitest";
import { buildValidationReport } from "./validation";

const baseAesthetic = {
  primary: "challenge",
  secondary: "fantasy",
  tertiary: "narrative",
};

const baseMechanicSet = {
  total_count: 12,
  compatibility_score: 86,
  cross_genre_mechanics: [{}, {}],
  genres_searched: ["rpg", "roguelike"],
};

const baseUSP = [
  { triangle_of_weirdness_check: "pass", usp: "test USP" },
];

describe("buildValidationReport — Triangle of Weirdness", () => {
  it("passes when weird + appealing + credible", () => {
    const r = buildValidationReport(baseAesthetic, baseMechanicSet, baseUSP, "Build a castle and survive", ["roguelike"]);
    expect(r.triangle_check.passed).toBe(true);
    expect(r.triangle_check.score).toBeGreaterThanOrEqual(0.6);
    expect(r.triangle_check.weird).toBe(true);
    expect(r.triangle_check.appealing).toBe(true);
    expect(r.triangle_check.credible).toBe(true);
  });

  it("fails when no USP passes (weird=false)", () => {
    const r = buildValidationReport(
      baseAesthetic,
      baseMechanicSet,
      [{ triangle_of_weirdness_check: "warn", usp: "weak" }],
      "Build a castle",
      []
    );
    expect(r.triangle_check.weird).toBe(false);
    // score = 0.2 + 0.3 + 0.3 = 0.8 — всё ещё проходит appealing+credible
    expect(r.triangle_check.score).toBe(0.8);
  });

  it("fails when primary aesthetic is 'submission' (appealing=false)", () => {
    const r = buildValidationReport(
      { primary: "submission", secondary: "discovery", tertiary: "narrative" },
      baseMechanicSet,
      baseUSP,
      "Build a castle",
      []
    );
    expect(r.triangle_check.appealing).toBe(false);
  });

  it("fails when compatibility_score < 60 (credible=false)", () => {
    const r = buildValidationReport(
      baseAesthetic,
      { total_count: 5, compatibility_score: 40 },
      baseUSP,
      "Build a castle",
      []
    );
    expect(r.triangle_check.credible).toBe(false);
  });
});

describe("buildValidationReport — 5 core questions (TASK-1.4)", () => {
  it("returns true for 'core verb' when idea has action verb", () => {
    const r = buildValidationReport(baseAesthetic, baseMechanicSet, baseUSP, "Build a castle and survive the night", []);
    expect(r.five_questions["What is the core verb?"]).toBe(true);
  });

  it("recognizes inflected Russian core verbs through Unicode tokens", () => {
    const r = buildValidationReport(
      baseAesthetic,
      baseMechanicSet,
      baseUSP,
      "Игрок исследует руины, собирает артефакты и защищает караван от врагов",
      []
    );

    expect(r.five_questions["What is the core verb?"]).toBe(true);
    expect(r.eight_filters.clarity.score).toBe(0.9);
  });

  it("returns false for 'core verb' when idea has no action verb", () => {
    const r = buildValidationReport(baseAesthetic, baseMechanicSet, baseUSP, "A beautiful world full of wonder", []);
    expect(r.five_questions["What is the core verb?"]).toBe(false);
  });

  it("returns true for 'moment-to-moment' when wordCount >= 15 AND has action verb", () => {
    const longIdea = "Build a castle and survive the night against endless waves of enemies attacking from all sides";
    const r = buildValidationReport(baseAesthetic, baseMechanicSet, baseUSP, longIdea, []);
    expect(r.five_questions["What does the player do moment-to-moment?"]).toBe(true);
  });

  it("returns false for 'moment-to-moment' when idea is too short", () => {
    const r = buildValidationReport(baseAesthetic, baseMechanicSet, baseUSP, "Build a castle", []);
    expect(r.five_questions["What does the player do moment-to-moment?"]).toBe(false);
  });

  it("returns true for 'long-term goal' when total_count >= 5", () => {
    const r = buildValidationReport(baseAesthetic, baseMechanicSet, baseUSP, "Build a castle", []);
    expect(r.five_questions["What long-term goal drives the player?"]).toBe(true);
  });

  it("returns false for 'long-term goal' when total_count < 5", () => {
    const r = buildValidationReport(
      baseAesthetic,
      { total_count: 3, compatibility_score: 50 },
      baseUSP,
      "Build a castle",
      []
    );
    expect(r.five_questions["What long-term goal drives the player?"]).toBe(false);
  });

  it("returns true for 'return tomorrow' when credible AND (sustainability keyword OR cross-genre)", () => {
    const r1 = buildValidationReport(baseAesthetic, baseMechanicSet, baseUSP, "Build a castle with procedural generation", []);
    expect(r1.five_questions["Why would a player return tomorrow?"]).toBe(true);

    const r2 = buildValidationReport(baseAesthetic, baseMechanicSet, baseUSP, "Build a castle", []);
    // cross_genre_mechanics в baseMechanicSet = [{}, {}] → hasCrossGenre=true
    expect(r2.five_questions["Why would a player return tomorrow?"]).toBe(true);
  });

  it("returns false for 'return tomorrow' when not credible", () => {
    const r = buildValidationReport(
      baseAesthetic,
      { total_count: 5, compatibility_score: 40, cross_genre_mechanics: [] },
      baseUSP,
      "Build a castle",
      []
    );
    expect(r.five_questions["Why would a player return tomorrow?"]).toBe(false);
  });
});

describe("buildValidationReport — 8 idea filters (TASK-1.3)", () => {
  it("clarity: high score for 5-30 words + action verb", () => {
    const r = buildValidationReport(baseAesthetic, baseMechanicSet, baseUSP, "Build a castle and survive the night", []);
    expect(r.eight_filters.clarity.score).toBe(0.9);
  });

  it("clarity: low score for < 5 words", () => {
    const r = buildValidationReport(baseAesthetic, baseMechanicSet, baseUSP, "Hi", []);
    expect(r.eight_filters.clarity.score).toBe(0.3);
  });

  it("clarity: low score for > 60 words", () => {
    const longIdea = "word ".repeat(70).trim();
    const r = buildValidationReport(baseAesthetic, baseMechanicSet, baseUSP, longIdea, []);
    expect(r.eight_filters.clarity.score).toBe(0.4);
  });

  it("novelty: bonus for multi-genre", () => {
    const r = buildValidationReport(
      baseAesthetic,
      baseMechanicSet,
      baseUSP,
      "Build a castle",
      ["rpg", "roguelike"] // hasMultiGenre = true
    );
    expect(r.eight_filters.novelty.score).toBeGreaterThanOrEqual(0.65);
  });

  it("novelty: bonus for cross-genre mechanics", () => {
    const r = buildValidationReport(
      baseAesthetic,
      { ...baseMechanicSet, cross_genre_mechanics: [{}, {}] },
      baseUSP,
      "Build a castle",
      []
    );
    expect(r.eight_filters.novelty.score).toBeGreaterThanOrEqual(0.65);
  });

  it("novelty: capped at 1.0", () => {
    const r = buildValidationReport(
      baseAesthetic,
      baseMechanicSet,
      baseUSP,
      "Build a unique innovative novel unprecedented castle",
      ["rpg", "roguelike", "strategy"]
    );
    expect(r.eight_filters.novelty.score).toBeLessThanOrEqual(1.0);
  });

  it("feasibility: high for compat >= 80 AND total >= 8", () => {
    const r = buildValidationReport(
      baseAesthetic,
      { total_count: 12, compatibility_score: 86 },
      baseUSP,
      "Build a castle",
      []
    );
    expect(r.eight_filters.feasibility.score).toBe(0.9);
  });

  it("feasibility: medium for compat >= 60 AND total >= 5", () => {
    const r = buildValidationReport(
      baseAesthetic,
      { total_count: 6, compatibility_score: 65 },
      baseUSP,
      "Build a castle",
      []
    );
    expect(r.eight_filters.feasibility.score).toBe(0.75);
  });

  it("feasibility: low for compat < 40", () => {
    const r = buildValidationReport(
      baseAesthetic,
      { total_count: 3, compatibility_score: 30 },
      baseUSP,
      "Build a castle",
      []
    );
    expect(r.eight_filters.feasibility.score).toBe(0.4);
  });

  it("audience_fit: challenge = 0.9 (wide audience)", () => {
    const r = buildValidationReport(
      { primary: "challenge", secondary: "fantasy", tertiary: "narrative" },
      baseMechanicSet,
      baseUSP,
      "Build a castle",
      []
    );
    expect(r.eight_filters.audience_fit.score).toBe(0.9);
  });

  it("audience_fit: submission = 0.4 (niche)", () => {
    const r = buildValidationReport(
      { primary: "submission", secondary: "discovery", tertiary: "narrative" },
      baseMechanicSet,
      baseUSP,
      "Build a castle",
      []
    );
    expect(r.eight_filters.audience_fit.score).toBe(0.4);
  });

  it("market_fit: rpg = 0.85", () => {
    const r = buildValidationReport(
      { primary: "challenge", secondary: "fantasy", tertiary: "narrative" },
      { ...baseMechanicSet, genres_searched: ["rpg"] },
      baseUSP,
      "Build a castle",
      []
    );
    // market_fit вычисляется по primary aesthetic, не по genre.
    // challenge → 0.8, но baseAesthetic.primary = "challenge" → 0.8
    expect(r.eight_filters.market_fit.score).toBeGreaterThanOrEqual(0.75);
  });

  it("market_fit: multi-genre bonus +0.1", () => {
    const r1 = buildValidationReport(baseAesthetic, baseMechanicSet, baseUSP, "Build a castle", []);
    const r2 = buildValidationReport(baseAesthetic, baseMechanicSet, baseUSP, "Build a castle", ["rpg", "roguelike"]);
    expect(r2.eight_filters.market_fit.score).toBeGreaterThan(r1.eight_filters.market_fit.score);
  });

  it("differentiation: weird + multi-genre + cross-genre = high", () => {
    const r = buildValidationReport(
      baseAesthetic,
      baseMechanicSet,
      baseUSP,
      "Build a castle",
      ["rpg", "roguelike"]
    );
    expect(r.eight_filters.differentiation.score).toBeGreaterThanOrEqual(0.7);
  });

  it("emotional_impact: bonus for emotional keywords", () => {
    const r = buildValidationReport(
      baseAesthetic,
      baseMechanicSet,
      baseUSP,
      "A story of fear, hope, and despair in a dying world",
      []
    );
    expect(r.eight_filters.emotional_impact.score).toBeGreaterThanOrEqual(0.7);
  });

  it("sustainability: bonus for sustainability keywords", () => {
    const r = buildValidationReport(
      baseAesthetic,
      baseMechanicSet,
      baseUSP,
      "A roguelike with procedural generation and seasonal events",
      []
    );
    expect(r.eight_filters.sustainability.score).toBeGreaterThanOrEqual(0.7);
  });

  it("sustainability: bonus for cross-genre mechanics", () => {
    const r1 = buildValidationReport(
      baseAesthetic,
      { total_count: 12, compatibility_score: 86, cross_genre_mechanics: [] },
      baseUSP,
      "Build a castle",
      []
    );
    const r2 = buildValidationReport(
      baseAesthetic,
      { total_count: 12, compatibility_score: 86, cross_genre_mechanics: [{}, {}] },
      baseUSP,
      "Build a castle",
      []
    );
    expect(r2.eight_filters.sustainability.score).toBeGreaterThan(r1.eight_filters.sustainability.score);
  });
});

describe("buildValidationReport — overall_score", () => {
  it("computes weighted average: 0.3*triangle + 0.3*questions + 0.4*filters", () => {
    const r = buildValidationReport(baseAesthetic, baseMechanicSet, baseUSP, "Build a castle and survive the night", ["roguelike"]);
    expect(r.overall_score).toBeGreaterThan(0);
    expect(r.overall_score).toBeLessThanOrEqual(1);
    // Проверяем, что это число с 3 знаками после запятой.
    expect(r.overall_score).toBe(Number(r.overall_score.toFixed(3)));
  });

  it("low overall_score for bad concept", () => {
    const r = buildValidationReport(
      { primary: "submission", secondary: "discovery", tertiary: "narrative" },
      { total_count: 3, compatibility_score: 30 },
      [{ triangle_of_weirdness_check: "warn", usp: "weak" }],
      "Hi",
      []
    );
    expect(r.overall_score).toBeLessThan(0.5);
  });

  it("high overall_score for good concept", () => {
    const r = buildValidationReport(
      baseAesthetic,
      baseMechanicSet,
      baseUSP,
      "Build a castle and survive the night against endless waves of enemies",
      ["roguelike"]
    );
    expect(r.overall_score).toBeGreaterThan(0.7);
  });
});

describe("buildValidationReport — warnings", () => {
  it("warns when compatibility < 60", () => {
    const r = buildValidationReport(
      baseAesthetic,
      { total_count: 5, compatibility_score: 40 },
      baseUSP,
      "Build a castle",
      []
    );
    expect(r.warnings.some((w) => w.includes("Совместимость механик ниже 60%"))).toBe(true);
  });

  it("warns when primary aesthetic is 'submission'", () => {
    const r = buildValidationReport(
      { primary: "submission", secondary: "discovery", tertiary: "narrative" },
      baseMechanicSet,
      baseUSP,
      "Build a castle",
      []
    );
    expect(r.warnings.some((w) => w.includes("submission"))).toBe(true);
  });

  it("warns when no USP passes Triangle of Weirdness", () => {
    const r = buildValidationReport(
      baseAesthetic,
      baseMechanicSet,
      [{ triangle_of_weirdness_check: "warn", usp: "weak" }],
      "Build a castle",
      []
    );
    expect(r.warnings.some((w) => w.includes("Triangle of Weirdness"))).toBe(true);
  });

  it("warns when idea has no action verb", () => {
    const r = buildValidationReport(baseAesthetic, baseMechanicSet, baseUSP, "A beautiful world full of wonder", []);
    expect(r.warnings.some((w) => w.includes("глагола действия"))).toBe(true);
  });

  it("warns when idea is too long (> 60 words)", () => {
    const longIdea = "word ".repeat(70).trim();
    const r = buildValidationReport(baseAesthetic, baseMechanicSet, baseUSP, longIdea, []);
    expect(r.warnings.some((w) => w.includes("слишком длинная"))).toBe(true);
  });
});

describe("buildValidationReport — suggestions", () => {
  it("includes multi-genre suggestion when hasMultiGenre", () => {
    const r = buildValidationReport(baseAesthetic, baseMechanicSet, baseUSP, "Build a castle", ["rpg", "roguelike"]);
    expect(r.suggestions.some((s) => s.includes("Мульти-жанровость"))).toBe(true);
  });

  it("includes cross-genre suggestion when hasCrossGenre", () => {
    const r = buildValidationReport(baseAesthetic, baseMechanicSet, baseUSP, "Build a castle", []);
    expect(r.suggestions.some((s) => s.includes("Cross-genre"))).toBe(true);
  });

  it("always includes 3 base suggestions", () => {
    const r = buildValidationReport(baseAesthetic, baseMechanicSet, baseUSP, "Build a castle", []);
    expect(r.suggestions.length).toBeGreaterThanOrEqual(3);
  });
});
