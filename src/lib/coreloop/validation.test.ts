/**
 * TASK-2.20: Unit tests for Core Loop validation (Block 2).
 * Covers: TASK-2.4 (real closedness), TASK-2.6 (5 Gary questions), TASK-2.16 (all-5-required threshold).
 */

import { describe, it, expect } from "vitest";
import { buildValidation, checkLoopClosedness, checkGaryFiveQuestions, checkResourceSufficiency } from "./validation";
import type { CoreStep } from "./steps";
import type { PathologyReport } from "./pathologies";

function makeStep(overrides: Partial<CoreStep> = {}): CoreStep {
  return {
    action: "Test",
    mechanics: ["M1"],
    resources_consumed: [],
    resources_produced: [],
    feedback_type: "neutral",
    duration_estimate: 5,
    ...overrides,
  };
}

function makePathologyReport(criticalCount: number = 0): PathologyReport {
  return {
    pathologies: Array.from({ length: criticalCount }, (_, i) => ({
      name: `Critical ${i}`,
      type: `critical_${i}`,
      severity: "critical" as const,
      description: "test",
      correction: "test",
      affected_resources: [],
    })),
    total_count: criticalCount,
    critical_count: criticalCount,
  };
}

describe("checkLoopClosedness — TASK-2.4", () => {
  it("returns closed when last produces resource consumed by first", () => {
    const steps = [
      makeStep({ action: "Start", resources_consumed: ["momentum"] }),
      makeStep({ action: "Mid" }),
      makeStep({ action: "End", resources_produced: ["momentum"] }),
    ];
    const result = checkLoopClosedness(steps);
    expect(result.is_closed).toBe(true);
    expect(result.closing_resources).toContain("momentum");
  });

  it("returns closed when last action has return keyword", () => {
    const steps = [
      makeStep({ action: "Start" }),
      makeStep({ action: "Mid" }),
      makeStep({ action: "Повторить цикл" }),
    ];
    const result = checkLoopClosedness(steps);
    expect(result.is_closed).toBe(true);
  });

  it("returns closed when chain integrity intact (3+ steps)", () => {
    const steps = [
      makeStep({ resources_produced: ["a"] }),
      makeStep({ resources_consumed: ["a"], resources_produced: ["b"] }),
      makeStep({ resources_consumed: ["b"], resources_produced: ["c"] }),
    ];
    const result = checkLoopClosedness(steps);
    expect(result.is_closed).toBe(true);
  });

  it("returns NOT closed when no link between last and first", () => {
    const steps = [
      makeStep({ action: "Start", resources_consumed: ["x"] }),
      makeStep({ action: "End", resources_produced: ["y"] }), // y ≠ x
    ];
    const result = checkLoopClosedness(steps);
    expect(result.is_closed).toBe(false);
  });

  it("returns NOT closed when < 2 steps", () => {
    const result = checkLoopClosedness([makeStep()]);
    expect(result.is_closed).toBe(false);
  });
});

describe("checkGaryFiveQuestions — TASK-2.6", () => {
  it("returns is_loop=true when ≥ 2 steps", () => {
    const steps = [makeStep(), makeStep()];
    const result = checkGaryFiveQuestions(steps);
    expect(result.is_loop).toBe(true);
  });

  it("returns is_loop=false when < 2 steps", () => {
    const result = checkGaryFiveQuestions([makeStep()]);
    expect(result.is_loop).toBe(false);
  });

  it("returns has_conflict=true when negative feedback exists", () => {
    const steps = [makeStep({ feedback_type: "negative" }), makeStep()];
    const result = checkGaryFiveQuestions(steps);
    expect(result.has_conflict).toBe(true);
  });

  it("returns has_conflict=true when resources consumed", () => {
    const steps = [makeStep({ resources_consumed: ["energy"] }), makeStep()];
    const result = checkGaryFiveQuestions(steps);
    expect(result.has_conflict).toBe(true);
  });

  it("returns has_resources=true when ≥ 2 resources", () => {
    const steps = [
      makeStep({ resources_produced: ["gold"] }),
      makeStep({ resources_produced: ["xp"] }),
    ];
    const result = checkGaryFiveQuestions(steps);
    expect(result.has_resources).toBe(true);
  });

  it("returns has_interaction=true when all steps have mechanics", () => {
    const steps = [makeStep({ mechanics: ["M1"] }), makeStep({ mechanics: ["M2"] })];
    const result = checkGaryFiveQuestions(steps);
    expect(result.has_interaction).toBe(true);
  });

  it("returns has_goal=true when positive feedback exists", () => {
    const steps = [makeStep({ feedback_type: "positive" }), makeStep()];
    const result = checkGaryFiveQuestions(steps);
    expect(result.has_goal).toBe(true);
  });

  it("returns all 5 answers as strings", () => {
    const steps = [makeStep(), makeStep()];
    const result = checkGaryFiveQuestions(steps);
    expect(Object.keys(result.answers).length).toBe(5);
    for (const v of Object.values(result.answers)) {
      expect(typeof v).toBe("string");
    }
  });
});

describe("checkResourceSufficiency", () => {
  it("detects dead resources (produced but not consumed)", () => {
    const steps = [
      makeStep({ resources_produced: ["dead_resource"] }),
      makeStep({ resources_consumed: ["other"] }),
    ];
    const result = checkResourceSufficiency(steps);
    expect(result.has_dead_resources).toBe(true);
    expect(result.dead_resources).toContain("dead_resource");
  });

  it("detects unsourced consumables (consumed but not produced)", () => {
    const steps = [
      makeStep({ resources_consumed: ["unsourced"] }),
      makeStep({ resources_produced: ["other"] }),
    ];
    const result = checkResourceSufficiency(steps);
    expect(result.has_unsourced_consumables).toBe(true);
    expect(result.unsourced_consumables).toContain("unsourced");
  });

  it("returns false for both when resources are balanced", () => {
    const steps = [
      makeStep({ resources_produced: ["a"] }),
      makeStep({ resources_consumed: ["a"], resources_produced: ["b"] }),
      makeStep({ resources_consumed: ["b"] }),
    ];
    const result = checkResourceSufficiency(steps);
    expect(result.has_dead_resources).toBe(false);
    expect(result.has_unsourced_consumables).toBe(false);
  });
});

describe("buildValidation — TASK-2.16: all-5-required threshold", () => {
  it("overall_passed = true only when all 5 criteria pass", () => {
    const steps = [
      makeStep({ feedback_type: "positive", resources_produced: ["a"], mechanics: ["M1"] }),
      makeStep({ feedback_type: "neutral", resources_consumed: ["a"], resources_produced: ["b"], mechanics: ["M2"] }),
      makeStep({ feedback_type: "positive", resources_consumed: ["b"], resources_produced: ["a"], mechanics: ["M3"] }),
    ];
    const pathologies = makePathologyReport(0);
    const st = { type: "economy", has_braking: true };
    const result = buildValidation(steps, pathologies, st);
    expect(result.checklist_passed).toBe(5);
    expect(result.overall_passed).toBe(true);
  });

  it("overall_passed = false when critical pathologies exist", () => {
    const steps = [
      makeStep({ feedback_type: "positive", resources_produced: ["a"] }),
      makeStep({ feedback_type: "neutral", resources_consumed: ["a"], resources_produced: ["b"] }),
      makeStep({ feedback_type: "positive", resources_consumed: ["b"], resources_produced: ["a"] }),
    ];
    const pathologies = makePathologyReport(1); // 1 critical
    const st = { type: "economy", has_braking: true };
    const result = buildValidation(steps, pathologies, st);
    expect(result.overall_passed).toBe(false);
  });

  it("overall_passed = false when loop not closed", () => {
    const steps = [
      makeStep({ action: "Start", feedback_type: "positive", resources_produced: ["x"] }),
      makeStep({ action: "End", feedback_type: "neutral", resources_consumed: ["x"], resources_produced: ["y"] }),
      // y not consumed by Start → not closed
    ];
    const pathologies = makePathologyReport(0);
    const st = { type: "engine", has_braking: true };
    const result = buildValidation(steps, pathologies, st);
    expect(result.overall_passed).toBe(false);
    expect(result.warnings.some((w) => w.includes("не замкнут"))).toBe(true);
  });

  it("overall_passed = false when dead resources exist", () => {
    const steps = [
      makeStep({ feedback_type: "positive", resources_produced: ["a", "dead"] }),
      makeStep({ feedback_type: "neutral", resources_consumed: ["a"], resources_produced: ["b"] }),
      makeStep({ feedback_type: "positive", resources_consumed: ["b"], resources_produced: ["a"] }),
    ];
    const pathologies = makePathologyReport(0);
    const st = { type: "economy", has_braking: true };
    const result = buildValidation(steps, pathologies, st);
    expect(result.overall_passed).toBe(false);
  });

  it("overall_passed = false when step count outside 3-7", () => {
    const steps = Array.from({ length: 8 }, () => makeStep({ feedback_type: "positive" }));
    const pathologies = makePathologyReport(0);
    const st = { type: "engine", has_braking: true };
    const result = buildValidation(steps, pathologies, st);
    expect(result.overall_passed).toBe(false);
  });

  it("includes gary_five_questions in result", () => {
    const steps = [makeStep(), makeStep(), makeStep()];
    const pathologies = makePathologyReport(0);
    const st = { type: "engine", has_braking: true };
    const result = buildValidation(steps, pathologies, st);
    expect(result.gary_five_questions).toBeDefined();
    expect(result.gary_five_questions.answers).toBeDefined();
  });

  it("includes warnings array", () => {
    const steps = [makeStep(), makeStep()]; // only 2 steps
    const pathologies = makePathologyReport(1);
    const st = { type: "engine", has_braking: false };
    const result = buildValidation(steps, pathologies, st);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
