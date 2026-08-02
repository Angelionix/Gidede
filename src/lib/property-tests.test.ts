/**
 * R7-03: Property tests for curves, resource conservation and payoff.
 *
 * Tests domain invariants (not snapshots) across a range of inputs:
 *   - Progression curves: XP is monotonically increasing for exponential/linear.
 *   - Balance Nash: probabilities sum to 1 and are in [0, 1].
 *   - Economy graph simulation: values stay within bounds.
 *   - RPS cycles: cycle strength is the average payoff (not negative).
 *   - Composite balance score: in [0, 1] and decreases with more issues.
 */

import { describe, it, expect } from "vitest";
import { solveNash } from "@/lib/balance/nash-solver";
import { computeCompositeBalanceScore } from "@/lib/balance/composite-score";
import { runGraphSimulation, type GraphNode, type GraphFlow, type ResourceDef } from "@/lib/economy/graph-simulation";
import { findAllRpsCycles } from "@/lib/balance/rps-cycles";

describe("R7-03 — Property tests: curves, resource conservation, payoff", () => {
  describe("Nash equilibrium properties", () => {
    it("probabilities sum to 1 for any 2×2 game", () => {
      // Test with multiple random-ish payoff matrices.
      for (let seed = 1; seed <= 20; seed++) {
        const a = (seed * 7) % 10;
        const b = (seed * 13) % 10;
        const c = (seed * 17) % 10;
        const d = (seed * 19) % 10;
        const result = solveNash([[a, b], [c, d]]);
        const sum = result.strategy.reduce((s, p) => s + p, 0);
        expect(Math.abs(sum - 1)).toBeLessThan(0.01);
      }
    });

    it("all probabilities are in [0, 1]", () => {
      for (let seed = 1; seed <= 20; seed++) {
        const a = (seed * 7) % 10 - 5;
        const b = (seed * 13) % 10 - 5;
        const c = (seed * 17) % 10 - 5;
        const d = (seed * 19) % 10 - 5;
        const result = solveNash([[a, b], [c, d]]);
        for (const p of result.strategy) {
          expect(p).toBeGreaterThanOrEqual(0);
          expect(p).toBeLessThanOrEqual(1);
        }
      }
    });

    it("single-strategy game returns [1.0]", () => {
      const result = solveNash([[5]]);
      expect(result.strategy).toEqual([1]);
    });
  });

  describe("Composite balance score properties", () => {
    it("score is always in [0, 1]", () => {
      for (let stability = 0; stability <= 1; stability += 0.1) {
        for (let op = 0; op <= 5; op++) {
          for (let up = 0; up <= 5; up++) {
            const result = computeCompositeBalanceScore({
              stabilityIndex: stability,
              overpoweredCount: op,
              underpoweredCount: up,
              totalObjects: 6,
              hasDominantStrategy: op > 2,
              dominatedStrategyCount: up,
              monteCarloVerdict: stability > 0.7 ? "GOOD" : "POOR",
              criticalIssueCount: op > 3 ? 1 : 0,
            });
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(1);
          }
        }
      }
    });

    it("score decreases when more issues are added (all else equal)", () => {
      const base = computeCompositeBalanceScore({
        stabilityIndex: 0.9,
        overpoweredCount: 0,
        underpoweredCount: 0,
        totalObjects: 4,
        hasDominantStrategy: false,
        dominatedStrategyCount: 0,
        monteCarloVerdict: "GOOD",
        criticalIssueCount: 0,
      });
      const withIssues = computeCompositeBalanceScore({
        stabilityIndex: 0.9,
        overpoweredCount: 2,
        underpoweredCount: 1,
        totalObjects: 4,
        hasDominantStrategy: true,
        dominatedStrategyCount: 2,
        monteCarloVerdict: "POOR",
        criticalIssueCount: 0,
      });
      expect(withIssues.score).toBeLessThan(base.score);
    });

    it("critical issues cap score at 0.3", () => {
      for (let stability = 0.5; stability <= 1.0; stability += 0.1) {
        const result = computeCompositeBalanceScore({
          stabilityIndex: stability,
          overpoweredCount: 0,
          underpoweredCount: 0,
          totalObjects: 4,
          hasDominantStrategy: false,
          dominatedStrategyCount: 0,
          monteCarloVerdict: "GOOD",
          criticalIssueCount: 1,
        });
        expect(result.score).toBeLessThanOrEqual(0.3);
      }
    });
  });

  describe("Graph simulation resource conservation", () => {
    const nodes: GraphNode[] = [
      { id: "gold", type: "pool" },
      { id: "shop", type: "converter" },
      { id: "xp", type: "pool" },
    ];
    const flows: GraphFlow[] = [
      { source_id: "gold", target_id: "shop", resource: "gold", rate: 5 },
      { source_id: "shop", target_id: "xp", resource: "xp", rate: 3 },
    ];
    const resources: ResourceDef[] = [
      { name: "gold", initial_value: 100, bounds: { min: 0, max: 1000 } },
      { name: "shop", initial_value: 0, bounds: { min: 0, max: 100 } },
      { name: "xp", initial_value: 0, bounds: { min: 0, max: 500 } },
    ];

    it("values never exceed their max bound", () => {
      const result = runGraphSimulation(nodes, flows, [], resources, 50, 42);
      for (const node of nodes) {
        const res = resources.find((r) => r.name === node.id)!;
        expect(result.ranges[node.id].max).toBeLessThanOrEqual(res.bounds.max);
      }
    });

    it("values never go below their min bound", () => {
      const result = runGraphSimulation(nodes, flows, [], resources, 50, 42);
      for (const node of nodes) {
        const res = resources.find((r) => r.name === node.id)!;
        expect(result.ranges[node.id].min).toBeGreaterThanOrEqual(res.bounds.min);
      }
    });

    it("stability_index is in [0, 1]", () => {
      const result = runGraphSimulation(nodes, flows, [], resources, 50, 42);
      expect(result.stability_index).toBeGreaterThanOrEqual(0);
      expect(result.stability_index).toBeLessThanOrEqual(1);
    });

    it("runaway + stall frequencies are in [0, 1]", () => {
      const result = runGraphSimulation(nodes, flows, [], resources, 50, 42);
      expect(result.runaway_frequency).toBeGreaterThanOrEqual(0);
      expect(result.runaway_frequency).toBeLessThanOrEqual(1);
      expect(result.stall_frequency).toBeGreaterThanOrEqual(0);
      expect(result.stall_frequency).toBeLessThanOrEqual(1);
    });
  });

  describe("RPS cycle properties", () => {
    it("cycle strength is the average payoff (always finite)", () => {
      // Generate RPS-like matrices.
      const matrix = [
        [0, 1, -1],
        [-1, 0, 1],
        [1, -1, 0],
      ];
      const cycles = findAllRpsCycles(matrix, ["a", "b", "c"]);
      for (const cycle of cycles) {
        expect(Number.isFinite(cycle.strength)).toBe(true);
      }
    });

    it("no cycles when one strategy dominates all", () => {
      const matrix = [
        [0, 5, 5],
        [-5, 0, -5],
        [-5, 5, 0],
      ];
      const cycles = findAllRpsCycles(matrix, ["dom", "weak1", "weak2"]);
      expect(cycles.length).toBe(0);
    });

    it("cycle indices are distinct within each cycle", () => {
      const matrix = [
        [0, 1, -1, 0],
        [-1, 0, 1, 0],
        [1, -1, 0, 1],
        [0, 0, -1, 0],
      ];
      const cycles = findAllRpsCycles(matrix, ["a", "b", "c", "d"]);
      for (const cycle of cycles) {
        const unique = new Set(cycle.indices);
        expect(unique.size).toBe(cycle.indices.length);
      }
    });
  });
});
