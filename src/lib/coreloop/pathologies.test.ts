/**
 * TASK-2.20: Unit tests for Core Loop pathologies (Block 2).
 * Covers: TASK-2.3 (7 Bible pathologies), TASK-2.10 (&& vs ||).
 */

import { describe, it, expect } from "vitest";
import { detectPathologies } from "./pathologies";
import type { CoreStep } from "./steps";
import type { StructuralType } from "./classify";

function makeStructuralType(
  type: string,
  likelyPathologies: string[] = [],
  hasBraking: boolean = false
): StructuralType {
  return {
    type,
    sub_type: "test",
    has_braking: hasBraking,
    currencies: [],
    resources: [],
    loops: [],
    risk_assessment: {
      risk_level: "low",
      likely_pathologies: likelyPathologies,
      mitigation_suggestions: [],
    },
  };
}

function makeStep(overrides: Partial<CoreStep> = {}): CoreStep {
  return {
    action: "Test action",
    mechanics: ["M1"],
    resources_consumed: [],
    resources_produced: [],
    feedback_type: "neutral",
    duration_estimate: 5,
    ...overrides,
  };
}

describe("detectPathologies — Bible 4.10.1: Runaway", () => {
  it("detects runaway when positive > 50% AND no braking AND likely", () => {
    const steps = [
      makeStep({ feedback_type: "positive", resources_produced: ["xp"] }),
      makeStep({ feedback_type: "positive", resources_produced: ["gold"] }),
      makeStep({ feedback_type: "positive", resources_produced: ["power"] }),
      makeStep({ feedback_type: "neutral" }),
    ];
    const st = makeStructuralType("engine", ["runaway"], false);
    const report = detectPathologies(steps, st);
    expect(report.pathologies.some((p) => p.type === "runaway")).toBe(true);
    expect(report.pathologies.find((p) => p.type === "runaway")?.bible_ref).toBe("Bible 4.10.1");
  });

  it("does NOT detect runaway when has_braking (TASK-2.10: && logic)", () => {
    const steps = [
      makeStep({ feedback_type: "positive" }),
      makeStep({ feedback_type: "positive" }),
      makeStep({ feedback_type: "positive" }),
    ];
    const st = makeStructuralType("engine", ["runaway"], true); // has_braking = true
    const report = detectPathologies(steps, st);
    expect(report.pathologies.some((p) => p.type === "runaway")).toBe(false);
  });

  it("does NOT detect runaway when not likely (TASK-2.10: && logic)", () => {
    const steps = [
      makeStep({ feedback_type: "positive" }),
      makeStep({ feedback_type: "positive" }),
      makeStep({ feedback_type: "positive" }),
    ];
    const st = makeStructuralType("ecology", [], false); // runaway not in likely
    const report = detectPathologies(steps, st);
    expect(report.pathologies.some((p) => p.type === "runaway")).toBe(false);
  });
});

describe("detectPathologies — Bible 4.10.2: Deadlock", () => {
  it("detects deadlock when < 3 steps AND likely", () => {
    const steps = [makeStep(), makeStep()];
    const st = makeStructuralType("engine", ["deadlock"], false);
    const report = detectPathologies(steps, st);
    expect(report.pathologies.some((p) => p.type === "deadlock")).toBe(true);
  });

  it("detects deadlock when all steps produce nothing", () => {
    const steps = [makeStep(), makeStep(), makeStep()]; // all produce []
    const st = makeStructuralType("engine", ["deadlock"], false);
    const report = detectPathologies(steps, st);
    expect(report.pathologies.some((p) => p.type === "deadlock")).toBe(true);
  });
});

describe("detectPathologies — Bible 4.10.3: Stall", () => {
  it("detects stall when 0 positive feedback AND likely", () => {
    const steps = [
      makeStep({ feedback_type: "neutral" }),
      makeStep({ feedback_type: "neutral" }),
      makeStep({ feedback_type: "neutral" }),
    ];
    const st = makeStructuralType("ecology", ["stall"], false);
    const report = detectPathologies(steps, st);
    expect(report.pathologies.some((p) => p.type === "stall")).toBe(true);
  });
});

describe("detectPathologies — Bible 4.10.4: Grind (universal)", () => {
  it("detects grind when all steps use same mechanic", () => {
    const steps = [
      makeStep({ mechanics: ["SameMechanic"] }),
      makeStep({ mechanics: ["SameMechanic"] }),
      makeStep({ mechanics: ["SameMechanic"] }),
    ];
    const st = makeStructuralType("engine", [], false);
    const report = detectPathologies(steps, st);
    expect(report.pathologies.some((p) => p.type === "grind")).toBe(true);
  });

  it("detects grind when all neutral", () => {
    const steps = [
      makeStep({ feedback_type: "neutral", mechanics: ["M1"] }),
      makeStep({ feedback_type: "neutral", mechanics: ["M2"] }),
      makeStep({ feedback_type: "neutral", mechanics: ["M3"] }),
    ];
    const st = makeStructuralType("engine", [], false);
    const report = detectPathologies(steps, st);
    expect(report.pathologies.some((p) => p.type === "grind")).toBe(true);
  });
});

describe("detectPathologies — Bible 4.10.5: Frustration Plateau (universal)", () => {
  it("detects when negative > 50% AND 0 positive", () => {
    const steps = [
      makeStep({ feedback_type: "negative" }),
      makeStep({ feedback_type: "negative" }),
      makeStep({ feedback_type: "negative" }),
    ];
    const st = makeStructuralType("ecology", [], false);
    const report = detectPathologies(steps, st);
    expect(report.pathologies.some((p) => p.type === "frustration_plateau")).toBe(true);
    expect(report.pathologies.find((p) => p.type === "frustration_plateau")?.severity).toBe("critical");
  });
});

describe("detectPathologies — Bible 4.10.6: Disconnected Loops", () => {
  it("detects when no shared resources between steps", () => {
    const steps = [
      makeStep({ resources_produced: ["a"] }),
      makeStep({ resources_consumed: ["b"] }), // b not produced anywhere
      makeStep({ resources_produced: ["c"] }),
    ];
    const st = makeStructuralType("hybrid", ["disconnected_loops"], false);
    const report = detectPathologies(steps, st);
    expect(report.pathologies.some((p) => p.type === "disconnected_loops")).toBe(true);
  });

  it("does NOT detect when shared resources exist", () => {
    const steps = [
      makeStep({ resources_produced: ["shared"] }),
      makeStep({ resources_consumed: ["shared"], resources_produced: ["other"] }),
      makeStep({ resources_consumed: ["other"] }),
    ];
    const st = makeStructuralType("hybrid", ["disconnected_loops"], false);
    const report = detectPathologies(steps, st);
    expect(report.pathologies.some((p) => p.type === "disconnected_loops")).toBe(false);
  });
});

describe("detectPathologies — Bible 4.10.7: Loop Overload", () => {
  it("detects when > 7 steps AND likely", () => {
    const steps = Array.from({ length: 8 }, () => makeStep());
    const st = makeStructuralType("engine", ["loop_overload"], false);
    const report = detectPathologies(steps, st);
    expect(report.pathologies.some((p) => p.type === "loop_overload")).toBe(true);
  });

  it("does NOT detect when ≤ 7 steps", () => {
    const steps = Array.from({ length: 5 }, () => makeStep());
    const st = makeStructuralType("engine", ["loop_overload"], false);
    const report = detectPathologies(steps, st);
    expect(report.pathologies.some((p) => p.type === "loop_overload")).toBe(false);
  });
});

describe("detectPathologies — Type-specific", () => {
  it("tower_defense: detects No Recovery when no repair mechanic", () => {
    const steps = [
      makeStep({ mechanics: ["Строительство"] }),
      makeStep({ mechanics: ["Защита"] }),
      makeStep({ mechanics: ["Улучшение"] }),
    ];
    const st = makeStructuralType("tower_defense", [], false);
    const report = detectPathologies(steps, st);
    expect(report.pathologies.some((p) => p.type === "no_recovery")).toBe(true);
  });

  it("rhythm: detects Off-Beat Penalty when negative > 50%", () => {
    const steps = [
      makeStep({ feedback_type: "negative" }),
      makeStep({ feedback_type: "negative" }),
      makeStep({ feedback_type: "negative" }),
    ];
    const st = makeStructuralType("rhythm", [], false);
    const report = detectPathologies(steps, st);
    expect(report.pathologies.some((p) => p.type === "off_beat_penalty")).toBe(true);
  });

  it("puzzle: detects Stuck State when no hint/reset", () => {
    const steps = [
      makeStep({ mechanics: ["Сканирование"] }),
      makeStep({ mechanics: ["Анализ"] }),
      makeStep({ mechanics: ["Размещение"] }),
    ];
    const st = makeStructuralType("puzzle", [], false);
    const report = detectPathologies(steps, st);
    expect(report.pathologies.some((p) => p.type === "stuck_state")).toBe(true);
    expect(report.pathologies.find((p) => p.type === "stuck_state")?.severity).toBe("critical");
  });
});

describe("detectPathologies — report structure", () => {
  it("returns total_count and critical_count", () => {
    const steps = [
      makeStep({ feedback_type: "positive" }),
      makeStep({ feedback_type: "positive" }),
      makeStep({ feedback_type: "positive" }),
    ];
    const st = makeStructuralType("engine", ["runaway"], false);
    const report = detectPathologies(steps, st);
    expect(report.total_count).toBe(report.pathologies.length);
    expect(report.critical_count).toBe(report.pathologies.filter((p) => p.severity === "critical").length);
  });

  it("returns empty pathologies for healthy loop", () => {
    const steps = [
      makeStep({ feedback_type: "positive", resources_produced: ["a"], mechanics: ["M1"] }),
      makeStep({ feedback_type: "neutral", resources_consumed: ["a"], resources_produced: ["b"], mechanics: ["M2"] }),
      makeStep({ feedback_type: "positive", resources_consumed: ["b"], resources_produced: ["a"], mechanics: ["M3"] }),
    ];
    const st = makeStructuralType("economy", [], true);
    const report = detectPathologies(steps, st);
    expect(report.total_count).toBe(0);
  });
});
