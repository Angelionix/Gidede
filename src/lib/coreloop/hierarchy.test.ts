/**
 * TASK-2.20: Unit tests for Core Loop hierarchy + recommendations (Block 2).
 * Covers: TASK-2.19 (multi-entry loops, Bible 4.3).
 */

import { describe, it, expect } from "vitest";
import { buildLoopHierarchy, buildRecommendations } from "./hierarchy";
import type { CoreStep } from "./steps";
import type { PathologyReport } from "./pathologies";

function makeStep(action: string, overrides: Partial<CoreStep> = {}): CoreStep {
  return {
    action,
    mechanics: ["M1"],
    resources_consumed: [],
    resources_produced: [],
    feedback_type: "neutral",
    duration_estimate: 5,
    ...overrides,
  };
}

function makePathologyReport(count: number = 0): PathologyReport {
  return {
    pathologies: Array.from({ length: count }, (_, i) => ({
      name: `Pathology ${i}`,
      type: `type_${i}`,
      severity: "warning" as const,
      description: "test",
      correction: "test correction",
      affected_resources: [],
    })),
    total_count: count,
    critical_count: 0,
  };
}

describe("buildLoopHierarchy — TASK-2.19: 6 уровней (Bible 4.3)", () => {
  it("returns all 6 hierarchy levels", () => {
    const steps = [makeStep("A"), makeStep("B"), makeStep("C"), makeStep("D"), makeStep("E")];
    const h = buildLoopHierarchy(steps, "engine");
    expect(Object.keys(h).length).toBe(6);
    expect(h.micro).toBeDefined();
    expect(h.small).toBeDefined();
    expect(h.medium).toBeDefined();
    expect(h.large).toBeDefined();
    expect(h.macro).toBeDefined();
    expect(h.meta).toBeDefined();
  });

  it("micro level uses first 2 steps", () => {
    const steps = [makeStep("Alpha"), makeStep("Beta"), makeStep("Gamma")];
    const h = buildLoopHierarchy(steps, "engine");
    expect(h.micro[0].actions).toEqual(["Alpha", "Beta"]);
  });

  it("small level uses all steps", () => {
    const steps = [makeStep("A"), makeStep("B"), makeStep("C")];
    const h = buildLoopHierarchy(steps, "engine");
    expect(h.small[0].actions).toEqual(["A", "B", "C"]);
  });

  it("ecology adds extra micro loop (observe + adjust)", () => {
    const steps = [makeStep("A"), makeStep("B"), makeStep("C"), makeStep("D")];
    const h = buildLoopHierarchy(steps, "ecology");
    expect(h.micro.length).toBe(2); // extra micro for ecology
  });

  it("hybrid adds extra micro loop", () => {
    const steps = [makeStep("A"), makeStep("B"), makeStep("C")];
    const h = buildLoopHierarchy(steps, "hybrid");
    expect(h.micro.length).toBe(2);
  });

  it("tower_defense has wave-based medium loop", () => {
    const steps = [makeStep("Build"), makeStep("Defend"), makeStep("Upgrade")];
    const h = buildLoopHierarchy(steps, "tower_defense");
    expect(h.medium[0].parent_step).toBe("wave_loop");
  });

  it("rhythm has measure-based small loop", () => {
    const steps = [makeStep("Listen"), makeStep("Input"), makeStep("Score")];
    const h = buildLoopHierarchy(steps, "rhythm");
    expect(h.small[0].parent_step).toBe("measure");
  });

  it("puzzle has clear-based medium loop", () => {
    const steps = [makeStep("Scan"), makeStep("Analyze"), makeStep("Place")];
    const h = buildLoopHierarchy(steps, "puzzle");
    expect(h.medium[0].parent_step).toBe("clear_loop");
  });

  it("each level has duration_estimate", () => {
    const steps = [makeStep("A"), makeStep("B")];
    const h = buildLoopHierarchy(steps, "engine");
    for (const level of Object.values(h)) {
      for (const entry of level) {
        expect(typeof entry.duration_estimate).toBe("number");
        expect(entry.duration_estimate).toBeGreaterThan(0);
      }
    }
  });
});

describe("buildRecommendations", () => {
  it("generates recommendations from pathologies", () => {
    const pathologies = makePathologyReport(2);
    const st = { type: "engine", has_braking: true };
    const recs = buildRecommendations(pathologies, st);
    expect(recs.length).toBeGreaterThanOrEqual(2);
    expect(recs.some((r) => r.target.includes("Pathology"))).toBe(true);
  });

  it("adds braking recommendation when has_braking=false", () => {
    const pathologies = makePathologyReport(0);
    const st = { type: "engine", has_braking: false };
    const recs = buildRecommendations(pathologies, st);
    expect(recs.some((r) => r.target.includes("тормоз"))).toBe(true);
  });

  it("adds type-specific recommendations for tower_defense", () => {
    const pathologies = makePathologyReport(0);
    const st = { type: "tower_defense", has_braking: true };
    const recs = buildRecommendations(pathologies, st);
    expect(recs.some((r) => r.target.includes("pacing волн"))).toBe(true);
  });

  it("adds type-specific recommendations for rhythm", () => {
    const pathologies = makePathologyReport(0);
    const st = { type: "rhythm", has_braking: true };
    const recs = buildRecommendations(pathologies, st);
    expect(recs.some((r) => r.target.includes("сложности"))).toBe(true);
  });

  it("adds type-specific recommendations for puzzle", () => {
    const pathologies = makePathologyReport(0);
    const st = { type: "puzzle", has_braking: true };
    const recs = buildRecommendations(pathologies, st);
    expect(recs.some((r) => r.target.includes("preview"))).toBe(true);
  });

  it("always adds 30-second fun test recommendation", () => {
    const pathologies = makePathologyReport(0);
    const st = { type: "engine", has_braking: true };
    const recs = buildRecommendations(pathologies, st);
    expect(recs.some((r) => r.target.includes("30-second"))).toBe(true);
  });

  it("priority is high for critical pathologies", () => {
    const pathologies: PathologyReport = {
      pathologies: [{
        name: "Critical Issue",
        type: "critical_type",
        severity: "critical",
        description: "test",
        correction: "fix it",
        affected_resources: [],
      }],
      total_count: 1,
      critical_count: 1,
    };
    const st = { type: "engine", has_braking: true };
    const recs = buildRecommendations(pathologies, st);
    expect(recs[0].priority).toBe("high");
  });

  it("recommendations have valid structure", () => {
    const pathologies = makePathologyReport(1);
    const st = { type: "engine", has_braking: true };
    const recs = buildRecommendations(pathologies, st);
    for (const r of recs) {
      expect(r.target).toBeTruthy();
      expect(r.recommendation).toBeTruthy();
      expect(["high", "medium", "low"]).toContain(r.priority);
      expect(r.category).toBeTruthy();
      expect(["formal", "ai"]).toContain(r.source);
    }
  });
});
