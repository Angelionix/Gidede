/**
 * R5-05: Unit tests for RPS cycle detection.
 */

import { describe, it, expect } from "vitest";
import { findAllRpsCycles } from "./rps-cycles";

describe("findAllRpsCycles — basic detection", () => {
  it("returns [] for fewer than 3 strategies", () => {
    expect(findAllRpsCycles([[0, 1], [-1, 0]], ["a", "b"])).toEqual([]);
    expect(findAllRpsCycles([], [])).toEqual([]);
  });

  it("detects a classic 3-cycle (rock-paper-scissors)", () => {
    // RPS: rock beats scissors, scissors beats paper, paper beats rock.
    // Payoff matrix [i][j] > 0 means i beats j.
    const matrix = [
      [0, -1, 1],   // rock: loses to paper (-1), beats scissors (1)
      [1, 0, -1],   // paper: beats rock (1), loses to scissors (-1)
      [-1, 1, 0],   // scissors: loses to rock (-1), beats paper (1)
    ];
    const cycles = findAllRpsCycles(matrix, ["rock", "paper", "scissors"]);
    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles[0].length).toBe(3);
    expect(cycles[0].cycle).toContain("rock");
    expect(cycles[0].cycle).toContain("paper");
    expect(cycles[0].cycle).toContain("scissors");
  });

  it("returns [] when no cycle exists (dominant strategy)", () => {
    // Strategy 0 beats everything — no cycle.
    const matrix = [
      [0, 1, 1],
      [-1, 0, -1],
      [-1, 1, 0],
    ];
    const cycles = findAllRpsCycles(matrix, ["a", "b", "c"]);
    expect(cycles).toEqual([]);
  });
});

describe("findAllRpsCycles — non-consecutive cycles (R5-05 acceptance)", () => {
  it("detects non-consecutive 3-cycle (0→2→4→0)", () => {
    // 5 strategies where only 0, 2, 4 form a cycle.
    // 0 beats 2, 2 beats 4, 4 beats 0. All other payoffs are 0 (no edge).
    const matrix = [
      [0, 0, 1, 0, -1],   // 0: beats 2, loses to 4
      [0, 0, 0, 0, 0],    // 1: passive
      [-1, 0, 0, 0, 1],   // 2: loses to 0, beats 4
      [0, 0, 0, 0, 0],    // 3: passive
      [1, 0, -1, 0, 0],   // 4: beats 0, loses to 2
    ];
    const cycles = findAllRpsCycles(matrix, ["s0", "s1", "s2", "s3", "s4"]);
    expect(cycles.length).toBeGreaterThan(0);
    // The cycle should involve s0, s2, s4 (not consecutive indices).
    const cycleNames = cycles[0].cycle.sort();
    expect(cycleNames).toEqual(["s0", "s2", "s4"]);
  });

  it("does NOT break after the first match — finds multiple cycles", () => {
    // Two independent RPS cycles: (0,1,2) and (3,4,5).
    const matrix = [
      [0, -1, 1, 0, 0, 0],
      [1, 0, -1, 0, 0, 0],
      [-1, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, -1, 1],
      [0, 0, 0, 1, 0, -1],
      [0, 0, 0, -1, 1, 0],
    ];
    const cycles = findAllRpsCycles(matrix, ["a", "b", "c", "d", "e", "f"]);
    expect(cycles.length).toBe(2);
    // One cycle involves a,b,c; the other involves d,e,f.
    const cycleSets = cycles.map((c) => c.cycle.sort().join(","));
    expect(cycleSets).toContain("a,b,c");
    expect(cycleSets).toContain("d,e,f");
  });
});

describe("findAllRpsCycles — cycle properties", () => {
  it("returns cycles sorted by strength descending", () => {
    // Two RPS cycles with different strengths:
    // Cycle 1 (weak): a→b→c→a with payoff 0.3
    // Cycle 2 (strong): d→e→f→d with payoff 0.9
    const matrix = [
      [0, 0.3, -0.3, 0, 0, 0],   // a: beats b (0.3), loses to c (-0.3)
      [-0.3, 0, 0.3, 0, 0, 0],   // b: loses to a, beats c (0.3)
      [0.3, -0.3, 0, 0, 0, 0],   // c: beats a (0.3), loses to b
      [0, 0, 0, 0, 0.9, -0.9],   // d: beats e (0.9), loses to f
      [0, 0, 0, -0.9, 0, 0.9],   // e: loses to d, beats f (0.9)
      [0, 0, 0, 0.9, -0.9, 0],   // f: beats d (0.9), loses to e
    ];
    const cycles = findAllRpsCycles(matrix, ["a", "b", "c", "d", "e", "f"]);
    expect(cycles.length).toBeGreaterThanOrEqual(2);
    // Stronger cycle (d,e,f with 0.9) should come first.
    expect(cycles[0].strength).toBeGreaterThan(cycles[1].strength);
    for (let i = 1; i < cycles.length; i++) {
      expect(cycles[i - 1].strength).toBeGreaterThanOrEqual(cycles[i].strength);
    }
  });

  it("respects maxResults limit", () => {
    // Create a matrix with many possible cycles.
    const n = 6;
    const matrix = Array.from({ length: n }, () => Array(n).fill(0.5));
    for (let i = 0; i < n; i++) matrix[i][i] = 0;
    const cycles = findAllRpsCycles(matrix, Array.from({ length: n }, (_, i) => `s${i}`), { maxResults: 5 });
    expect(cycles.length).toBeLessThanOrEqual(5);
  });

  it("uses threshold to filter weak edges", () => {
    // Cycle with payoffs just above 0.1 threshold.
    const matrix = [
      [0, 0.15, -0.15],
      [-0.15, 0, 0.15],
      [0.15, -0.15, 0],
    ];
    const cyclesLow = findAllRpsCycles(matrix, ["a", "b", "c"], { threshold: 0.1 });
    const cyclesHigh = findAllRpsCycles(matrix, ["a", "b", "c"], { threshold: 0.2 });
    expect(cyclesLow.length).toBeGreaterThan(0);
    expect(cyclesHigh.length).toBe(0); // 0.15 < 0.2 threshold
  });

  it("deduplicates rotational equivalents (0→1→2→0 == 1→2→0→1)", () => {
    const matrix = [
      [0, 1, -1],
      [-1, 0, 1],
      [1, -1, 0],
    ];
    const cycles = findAllRpsCycles(matrix, ["rock", "paper", "scissors"]);
    // Should return exactly 1 cycle (not 3 rotational duplicates).
    expect(cycles.length).toBe(1);
  });
});

describe("findAllRpsCycles — 4-cycles", () => {
  it("detects 4-cycles when maxLength >= 4", () => {
    // 4-strategy cycle: 0→1→2→3→0.
    const matrix = [
      [0, 1, 0, -1],
      [-1, 0, 1, 0],
      [0, -1, 0, 1],
      [1, 0, -1, 0],
    ];
    const cycles3 = findAllRpsCycles(matrix, ["a", "b", "c", "d"], { maxLength: 3 });
    const cycles4 = findAllRpsCycles(matrix, ["a", "b", "c", "d"], { maxLength: 4 });
    // 3-cycles: none (0→1→2→0 needs 0→2 edge which is 0, not > threshold).
    expect(cycles3.length).toBe(0);
    // 4-cycle: 0→1→2→3→0 exists.
    expect(cycles4.length).toBeGreaterThan(0);
    expect(cycles4[0].length).toBe(4);
  });
});

describe("R5-05 acceptance — all RPS cycles found", () => {
  it("non-consecutive cycle (0→2→4→0) is detected (was missed before R5-05)", () => {
    const matrix = [
      [0, 0, 1, 0, -1],
      [0, 0, 0, 0, 0],
      [-1, 0, 0, 0, 1],
      [0, 0, 0, 0, 0],
      [1, 0, -1, 0, 0],
    ];
    const cycles = findAllRpsCycles(matrix, ["s0", "s1", "s2", "s3", "s4"]);
    expect(cycles.length).toBeGreaterThan(0);
    // The detected cycle must involve s0, s2, s4 — non-consecutive indices.
    const detectedIndices = cycles[0].indices.sort();
    expect(detectedIndices).toEqual([0, 2, 4]);
  });

  it("multiple cycles are returned (no early break)", () => {
    const matrix = [
      [0, -1, 1, 0, 0, 0],
      [1, 0, -1, 0, 0, 0],
      [-1, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, -1, 1],
      [0, 0, 0, 1, 0, -1],
      [0, 0, 0, -1, 1, 0],
    ];
    const cycles = findAllRpsCycles(matrix, ["a", "b", "c", "d", "e", "f"]);
    expect(cycles.length).toBe(2);
  });
});
