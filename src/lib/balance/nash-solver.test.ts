/**
 * R5-04: Unit tests for the Nash equilibrium solver.
 */

import { describe, it, expect } from "vitest";
import {
  solveNash2x2,
  uniformOverNonDominated,
  solveNash,
} from "./nash-solver";

describe("solveNash2x2 — closed-form 2×2 zero-sum Nash", () => {
  it("solves a classic matching-pennies game (uniform [0.5, 0.5])", () => {
    // Matching pennies: [[1, -1], [-1, 1]] → p* = (1-(-1))/(1-(-1)-(-1)+1) = 2/4 = 0.5
    const r = solveNash2x2([[1, -1], [-1, 1]]);
    expect(r.strategy[0]).toBeCloseTo(0.5, 4);
    expect(r.strategy[1]).toBeCloseTo(0.5, 4);
    expect(r.method).toBe("closed_form_2x2");
    expect(r.source).toBe("solver");
  });

  it("solves an asymmetric game with non-uniform equilibrium", () => {
    // [[3, 1], [0, 2]] → p* = (2-0)/(3-1-0+2) = 2/4 = 0.5
    const r = solveNash2x2([[3, 1], [0, 2]]);
    expect(r.strategy[0]).toBeCloseTo(0.5, 4);
    expect(r.strategy[1]).toBeCloseTo(0.5, 4);
  });

  it("solves an asymmetric mixed-strategy game (no dominance)", () => {
    // [[10, 0], [0, 1]] → no strict dominance (10>0 but 0<1).
    // p* = (1-0)/(10-0-0+1) = 1/11 ≈ 0.0909
    const r = solveNash2x2([[10, 0], [0, 1]]);
    expect(r.strategy[0]).toBeCloseTo(1 / 11, 3);
    expect(r.strategy[1]).toBeCloseTo(10 / 11, 3);
  });

  it("detects strict row-0 dominance and returns pure strategy [1, 0]", () => {
    // [[2, 1], [0, 0]] — row 0 strictly dominates row 1 (2>0 && 1>0).
    // Without dominance detection, the formula returns p*=(0-0)/(2-1-0+0)=0 → [0,1],
    // which is WRONG (the dominant row 0 should be played with probability 1).
    const r = solveNash2x2([[2, 1], [0, 0]]);
    expect(r.strategy[0]).toBe(1);
    expect(r.strategy[1]).toBe(0);
    expect(r.reason).toContain("row 0 strictly dominates");
  });

  it("detects strict row-1 dominance and returns pure strategy [0, 1]", () => {
    // [[0, 0], [2, 1]] — row 1 strictly dominates row 0 (2>0 && 1>0).
    // Without dominance detection, the formula returns p*=(1-0)/(0-0-2+1)=-1/(-1)=1 → [1,0],
    // which is WRONG (the dominant row 1 should be played with probability 1).
    const r = solveNash2x2([[0, 0], [2, 1]]);
    expect(r.strategy[0]).toBe(0);
    expect(r.strategy[1]).toBe(1);
    expect(r.reason).toContain("row 1 strictly dominates");
  });

  it("detects dominance in mixed-magnitude payoffs", () => {
    // [[5, 2], [3, 1]] — row 0 dominates (5>3 && 2>1).
    const r = solveNash2x2([[5, 2], [3, 1]]);
    expect(r.strategy[0]).toBe(1);
    expect(r.strategy[1]).toBe(0);
  });

  it("does not falsely detect dominance when rows are incomparable", () => {
    // [[10, 0], [0, 1]] — 10>0 but 0<1, so NO dominance → interior mixed eq.
    const r = solveNash2x2([[10, 0], [0, 1]]);
    expect(r.reason).not.toContain("strictly dominates");
    expect(r.strategy[0]).toBeGreaterThan(0);
    expect(r.strategy[1]).toBeGreaterThan(0);
  });

  it("handles degenerate game (denominator ≈ 0) with uniform fallback", () => {
    // [[1, 1], [1, 1]] → denominator = 1-1-1+1 = 0 → uniform [0.5, 0.5]
    const r = solveNash2x2([[1, 1], [1, 1]]);
    expect(r.strategy[0]).toBe(0.5);
    expect(r.strategy[1]).toBe(0.5);
    expect(r.reason).toContain("degenerate");
  });

  it("returns probabilities summing to 1", () => {
    const r = solveNash2x2([[5, 2], [1, 3]]);
    const sum = r.strategy.reduce((s, p) => s + p, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
  });

  it("clamps probabilities to [0, 1]", () => {
    const r = solveNash2x2([[1, 0], [0, 1]]);
    for (const p of r.strategy) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it("throws for non-2×2 matrices", () => {
    expect(() => solveNash2x2([[1, 2, 3]])).toThrow();
    expect(() => solveNash2x2([[1, 2], [3, 4], [5, 6]])).toThrow();
    expect(() => solveNash2x2([])).toThrow();
  });
});

describe("uniformOverNonDominated — fallback for larger matrices", () => {
  it("returns uniform over all strategies when none dominated", () => {
    const r = uniformOverNonDominated([[0, 1, -1], [-1, 0, 1], [1, -1, 0]]);
    expect(r.strategy).toEqual([1 / 3, 1 / 3, 1 / 3].map((v) => Number(v.toFixed(4))));
    expect(r.method).toBe("uniform_non_dominated");
    expect(r.source).toBe("heuristic");
  });

  it("returns uniform over non-dominated strategies only", () => {
    // Strategy 1 is dominated → only 0 and 2 get 0.5 each.
    const r = uniformOverNonDominated([[0, 1, -1], [-2, -1, -3], [1, -1, 0]], [1]);
    expect(r.strategy[0]).toBe(0.5);
    expect(r.strategy[1]).toBe(0);
    expect(r.strategy[2]).toBe(0.5);
  });

  it("falls back to uniform over all when all are dominated", () => {
    const r = uniformOverNonDominated([[0, 0], [0, 0]], [0, 1]);
    expect(r.strategy[0]).toBe(0.5);
    expect(r.strategy[1]).toBe(0.5);
  });
});

describe("solveNash — dispatcher", () => {
  it("uses closed-form for 2×2", () => {
    const r = solveNash([[1, -1], [-1, 1]]);
    expect(r.method).toBe("closed_form_2x2");
    expect(r.source).toBe("solver");
  });

  it("uses uniform fallback for 3×3", () => {
    const r = solveNash([[0, 1, -1], [-1, 0, 1], [1, -1, 0]]);
    expect(r.method).toBe("uniform_non_dominated");
    expect(r.source).toBe("heuristic");
  });

  it("uses uniform fallback for 4×4", () => {
    const r = solveNash([[0, 1, -1, 0], [-1, 0, 1, 0], [1, -1, 0, 0], [0, 0, 0, 0]]);
    expect(r.method).toBe("uniform_non_dominated");
    expect(r.source).toBe("heuristic");
  });

  it("returns [1.0] for single-strategy game", () => {
    const r = solveNash([[5]]);
    expect(r.strategy).toEqual([1]);
    expect(r.source).toBe("solver");
  });

  it("returns [] for empty matrix", () => {
    const r = solveNash([]);
    expect(r.strategy).toEqual([]);
    expect(r.source).toBe("heuristic");
  });

  it("passes dominated strategies to the fallback", () => {
    const r = solveNash([[0, 1, -1], [-2, -1, -3], [1, -1, 0]], [1]);
    expect(r.strategy[1]).toBe(0);
  });
});

describe("R5-04 acceptance — real Nash or honest rename", () => {
  it("2×2 games get a real closed-form Nash equilibrium (source='solver')", () => {
    const r = solveNash([[3, 1], [0, 2]]);
    expect(r.source).toBe("solver");
    expect(r.method).toBe("closed_form_2x2");
    // The equilibrium should be a valid mixed strategy.
    expect(r.strategy.reduce((s, p) => s + p, 0)).toBeCloseTo(1, 6);
  });

  it("larger games honestly report source='heuristic' (not a real Nash)", () => {
    const r = solveNash([[0, 1, -1], [-1, 0, 1], [1, -1, 0]]);
    expect(r.source).toBe("heuristic");
    expect(r.method).toBe("uniform_non_dominated");
    expect(r.reason).toContain("fallback");
  });

  it("the 2×2 closed-form matches the textbook formula", () => {
    // Classic battle-of-the-sexes-like zero-sum: [[4, 1], [0, 3]]
    // p* = (3-0)/(4-1-0+3) = 3/6 = 0.5
    const r = solveNash2x2([[4, 1], [0, 3]]);
    expect(r.strategy[0]).toBeCloseTo(0.5, 4);
  });
});
