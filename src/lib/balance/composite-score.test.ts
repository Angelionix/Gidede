/**
 * R5-08: Unit tests for composite balance score.
 */

import { describe, it, expect } from "vitest";
import { computeCompositeBalanceScore } from "./composite-score";

describe("computeCompositeBalanceScore — basic scoring", () => {
  it("returns stability when no issues exist", () => {
    const r = computeCompositeBalanceScore({
      stabilityIndex: 0.9,
      overpoweredCount: 0,
      underpoweredCount: 0,
      totalObjects: 4,
      hasDominantStrategy: false,
      dominatedStrategyCount: 0,
      monteCarloVerdict: "GOOD",
      criticalIssueCount: 0,
    });
    expect(r.score).toBe(0.9);
    expect(r.hard_gate_triggered).toBe(false);
  });

  it("penalises transitive OP/UP", () => {
    const r = computeCompositeBalanceScore({
      stabilityIndex: 0.9,
      overpoweredCount: 2,
      underpoweredCount: 1,
      totalObjects: 4,
      hasDominantStrategy: false,
      dominatedStrategyCount: 0,
      monteCarloVerdict: "GOOD",
      criticalIssueCount: 0,
    });
    // 0.9 - 0.10 * (2/4 + 1/4) = 0.9 - 0.075 = 0.825
    expect(r.score).toBe(Number((0.825).toFixed(3)));
  });

  it("penalises dominant strategy", () => {
    const r = computeCompositeBalanceScore({
      stabilityIndex: 0.9,
      overpoweredCount: 0,
      underpoweredCount: 0,
      totalObjects: 4,
      hasDominantStrategy: true,
      dominatedStrategyCount: 0,
      monteCarloVerdict: "GOOD",
      criticalIssueCount: 0,
    });
    // 0.9 - 0.15 = 0.75
    expect(r.score).toBe(0.75);
  });

  it("penalises dominated strategies", () => {
    const r = computeCompositeBalanceScore({
      stabilityIndex: 0.9,
      overpoweredCount: 0,
      underpoweredCount: 0,
      totalObjects: 4,
      hasDominantStrategy: false,
      dominatedStrategyCount: 2,
      monteCarloVerdict: "GOOD",
      criticalIssueCount: 0,
    });
    // 0.9 - 0.05 * (2/4) = 0.9 - 0.025 = 0.875
    expect(r.score).toBe(Number((0.875).toFixed(3)));
  });

  it("penalises Monte Carlo POOR verdict", () => {
    const r = computeCompositeBalanceScore({
      stabilityIndex: 0.9,
      overpoweredCount: 0,
      underpoweredCount: 0,
      totalObjects: 4,
      hasDominantStrategy: false,
      dominatedStrategyCount: 0,
      monteCarloVerdict: "POOR",
      criticalIssueCount: 0,
    });
    // 0.9 - 0.20 = 0.70
    expect(r.score).toBe(0.7);
  });

  it("penalises Monte Carlo MODERATE verdict", () => {
    const r = computeCompositeBalanceScore({
      stabilityIndex: 0.9,
      overpoweredCount: 0,
      underpoweredCount: 0,
      totalObjects: 4,
      hasDominantStrategy: false,
      dominatedStrategyCount: 0,
      monteCarloVerdict: "MODERATE",
      criticalIssueCount: 0,
    });
    // 0.9 - 0.10 = 0.80
    expect(r.score).toBe(0.8);
  });
});

describe("computeCompositeBalanceScore — hard gate", () => {
  it("caps score at 0.3 when critical issues exist", () => {
    const r = computeCompositeBalanceScore({
      stabilityIndex: 0.95,
      overpoweredCount: 0,
      underpoweredCount: 0,
      totalObjects: 4,
      hasDominantStrategy: false,
      dominatedStrategyCount: 0,
      monteCarloVerdict: "GOOD",
      criticalIssueCount: 1,
    });
    expect(r.hard_gate_triggered).toBe(true);
    expect(r.score).toBeLessThanOrEqual(0.3);
  });

  it("hard gate applies even with high stability", () => {
    const r = computeCompositeBalanceScore({
      stabilityIndex: 1.0,
      overpoweredCount: 0,
      underpoweredCount: 0,
      totalObjects: 4,
      hasDominantStrategy: false,
      dominatedStrategyCount: 0,
      monteCarloVerdict: "GOOD",
      criticalIssueCount: 2,
    });
    expect(r.score).toBeLessThanOrEqual(0.3);
  });

  it("no hard gate when criticalIssueCount is 0", () => {
    const r = computeCompositeBalanceScore({
      stabilityIndex: 0.9,
      overpoweredCount: 0,
      underpoweredCount: 0,
      totalObjects: 4,
      hasDominantStrategy: false,
      dominatedStrategyCount: 0,
      monteCarloVerdict: "GOOD",
      criticalIssueCount: 0,
    });
    expect(r.hard_gate_triggered).toBe(false);
  });
});

describe("computeCompositeBalanceScore — combined penalties", () => {
  it("multiple penalties stack", () => {
    const r = computeCompositeBalanceScore({
      stabilityIndex: 0.8,
      overpoweredCount: 2,
      underpoweredCount: 1,
      totalObjects: 4,
      hasDominantStrategy: true,
      dominatedStrategyCount: 2,
      monteCarloVerdict: "POOR",
      criticalIssueCount: 0,
    });
    // 0.8 - 0.10*(0.5+0.25) - 0.15 - 0.05*0.5 - 0.20 = 0.8 - 0.075 - 0.15 - 0.025 - 0.20 = 0.35
    expect(r.score).toBe(Number((0.35).toFixed(3)));
  });

  it("score never goes below 0", () => {
    const r = computeCompositeBalanceScore({
      stabilityIndex: 0.1,
      overpoweredCount: 4,
      underpoweredCount: 4,
      totalObjects: 4,
      hasDominantStrategy: true,
      dominatedStrategyCount: 4,
      monteCarloVerdict: "POOR",
      criticalIssueCount: 3,
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
  });

  it("score never exceeds 1", () => {
    const r = computeCompositeBalanceScore({
      stabilityIndex: 1.5, // over-max input
      overpoweredCount: 0,
      underpoweredCount: 0,
      totalObjects: 4,
      hasDominantStrategy: false,
      dominatedStrategyCount: 0,
      monteCarloVerdict: "GOOD",
      criticalIssueCount: 0,
    });
    expect(r.score).toBeLessThanOrEqual(1);
  });
});

describe("computeCompositeBalanceScore — factors breakdown", () => {
  it("returns per-factor breakdown", () => {
    const r = computeCompositeBalanceScore({
      stabilityIndex: 0.8,
      overpoweredCount: 1,
      underpoweredCount: 0,
      totalObjects: 4,
      hasDominantStrategy: false,
      dominatedStrategyCount: 0,
      monteCarloVerdict: "MODERATE",
      criticalIssueCount: 0,
    });
    expect(r.factors.length).toBe(4);
    expect(r.factors.map((f) => f.name)).toEqual([
      "stability", "transitive_imbalance", "intransitive_dominance", "monte_carlo_verdict",
    ]);
    for (const f of r.factors) {
      expect(typeof f.contribution).toBe("number");
      expect(typeof f.reason).toBe("string");
    }
  });
});

describe("R5-08 acceptance", () => {
  it("OP/UP reduces score independently of stability", () => {
    const noOp = computeCompositeBalanceScore({
      stabilityIndex: 0.9, overpoweredCount: 0, underpoweredCount: 0,
      totalObjects: 4, hasDominantStrategy: false, dominatedStrategyCount: 0,
      monteCarloVerdict: "GOOD", criticalIssueCount: 0,
    });
    const withOp = computeCompositeBalanceScore({
      stabilityIndex: 0.9, overpoweredCount: 2, underpoweredCount: 1,
      totalObjects: 4, hasDominantStrategy: false, dominatedStrategyCount: 0,
      monteCarloVerdict: "GOOD", criticalIssueCount: 0,
    });
    expect(withOp.score).toBeLessThan(noOp.score);
  });

  it("dominant strategy reduces score independently of stability", () => {
    const noDom = computeCompositeBalanceScore({
      stabilityIndex: 0.9, overpoweredCount: 0, underpoweredCount: 0,
      totalObjects: 4, hasDominantStrategy: false, dominatedStrategyCount: 0,
      monteCarloVerdict: "GOOD", criticalIssueCount: 0,
    });
    const withDom = computeCompositeBalanceScore({
      stabilityIndex: 0.9, overpoweredCount: 0, underpoweredCount: 0,
      totalObjects: 4, hasDominantStrategy: true, dominatedStrategyCount: 0,
      monteCarloVerdict: "GOOD", criticalIssueCount: 0,
    });
    expect(withDom.score).toBeLessThan(noDom.score);
  });

  it("POOR MC verdict reduces score independently of stability", () => {
    const goodMc = computeCompositeBalanceScore({
      stabilityIndex: 0.9, overpoweredCount: 0, underpoweredCount: 0,
      totalObjects: 4, hasDominantStrategy: false, dominatedStrategyCount: 0,
      monteCarloVerdict: "GOOD", criticalIssueCount: 0,
    });
    const poorMc = computeCompositeBalanceScore({
      stabilityIndex: 0.9, overpoweredCount: 0, underpoweredCount: 0,
      totalObjects: 4, hasDominantStrategy: false, dominatedStrategyCount: 0,
      monteCarloVerdict: "POOR", criticalIssueCount: 0,
    });
    expect(poorMc.score).toBeLessThan(goodMc.score);
  });

  it("critical issues are a hard gate (score capped at 0.3)", () => {
    const r = computeCompositeBalanceScore({
      stabilityIndex: 1.0, overpoweredCount: 0, underpoweredCount: 0,
      totalObjects: 4, hasDominantStrategy: false, dominatedStrategyCount: 0,
      monteCarloVerdict: "GOOD", criticalIssueCount: 1,
    });
    expect(r.hard_gate_triggered).toBe(true);
    expect(r.score).toBeLessThanOrEqual(0.3);
  });
});
