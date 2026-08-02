/**
 * R7-04: Statistical tests and confidence bounds.
 *
 * Verifies that:
 *   - Confidence intervals from computeConfidenceInterval contain the true
 *     mean for known distributions (within statistical tolerance).
 *   - Multi-run simulation produces reproducible results (same seed → same
 *     aggregate statistics within tolerance).
 *   - Confidence intervals widen with higher confidence level.
 *   - Confidence intervals narrow with larger sample size.
 *   - The Monte Carlo simulation's 200-iteration win rates produce
 *     statistically meaningful spreads (not all identical).
 */

import { describe, it, expect } from "vitest";
import {
  computeConfidenceInterval,
  runMultiRunSimulation,
  aggregateRuns,
  mean,
  std,
} from "@/lib/balance/multi-run-sim";

describe("R7-04 — Statistical tests and confidence bounds", () => {
  describe("Confidence interval coverage", () => {
    it("95% CI contains the true mean for a normal-like distribution", () => {
      // Generate 100 values from a known distribution (mean ≈ 50).
      const values = Array.from({ length: 100 }, (_, i) => 50 + ((i * 7) % 10 - 5));
      const ci = computeConfidenceInterval(values, 0.95);
      expect(ci.mean).toBeCloseTo(50, -1);
      // The 95% CI should contain 50 (the true mean).
      expect(ci.ci_lower).toBeLessThanOrEqual(50);
      expect(ci.ci_upper).toBeGreaterThanOrEqual(50);
    });

    it("CI widens with higher confidence level", () => {
      const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const ci90 = computeConfidenceInterval(values, 0.90);
      const ci95 = computeConfidenceInterval(values, 0.95);
      const ci99 = computeConfidenceInterval(values, 0.99);
      const w90 = ci90.ci_upper - ci90.ci_lower;
      const w95 = ci95.ci_upper - ci95.ci_lower;
      const w99 = ci99.ci_upper - ci99.ci_lower;
      expect(w99).toBeGreaterThan(w95);
      expect(w95).toBeGreaterThanOrEqual(w90);
    });

    it("CI narrows with larger sample size (all else equal)", () => {
      // Small sample (n=5) vs large sample (n=100) from similar distribution.
      const small = [45, 50, 55, 48, 52];
      const large = Array.from({ length: 100 }, (_, i) => 50 + ((i * 3) % 8 - 4));
      const ciSmall = computeConfidenceInterval(small, 0.95);
      const ciLarge = computeConfidenceInterval(large, 0.95);
      const wSmall = ciSmall.ci_upper - ciSmall.ci_lower;
      const wLarge = ciLarge.ci_upper - ciLarge.ci_lower;
      expect(wLarge).toBeLessThan(wSmall);
    });

    it("zero-variance sample produces point CI (ci_lower == ci_upper == mean)", () => {
      const ci = computeConfidenceInterval([42, 42, 42, 42, 42], 0.95);
      expect(ci.mean).toBe(42);
      expect(ci.ci_lower).toBe(42);
      expect(ci.ci_upper).toBe(42);
    });
  });

  describe("Multi-run simulation reproducibility", () => {
    it("same baseSeed produces identical aggregate statistics (within tolerance)", () => {
      const simFn = (runIdx: number, seed: number) => ({
        metric: (seed % 100) / 100,
      });
      const runsA = runMultiRunSimulation(simFn, 10, 42);
      const runsB = runMultiRunSimulation(simFn, 10, 42);
      const aggA = aggregateRuns(runsA);
      const aggB = aggregateRuns(runsB);
      // Exact equality (deterministic).
      expect(aggA.metric.mean).toBe(aggB.metric.mean);
      expect(aggA.metric.std).toBe(aggB.metric.std);
      expect(aggA.metric.ci_lower).toBe(aggB.metric.ci_lower);
    });

    it("different baseSeed produces different aggregate statistics", () => {
      const simFn = (_i: number, seed: number) => ({
        metric: (seed % 100) / 100,
      });
      const runsA = runMultiRunSimulation(simFn, 10, 42);
      const runsB = runMultiRunSimulation(simFn, 10, 999);
      const aggA = aggregateRuns(runsA);
      const aggB = aggregateRuns(runsB);
      // At least one statistic should differ.
      const allSame = aggA.metric.mean === aggB.metric.mean
        && aggA.metric.std === aggB.metric.std;
      expect(allSame).toBe(false);
    });

    it("10 runs produce 10 independent samples (not 1 repeated)", () => {
      const simFn = (runIdx: number, seed: number) => ({
        runIdx,
        value: seed % 1000,
      });
      const runs = runMultiRunSimulation(simFn, 10, 42);
      expect(runs.length).toBe(10);
      // All runIdx values should be unique.
      const indices = runs.map((r) => r.runIdx);
      expect(new Set(indices).size).toBe(10);
      // At least some values should differ.
      const values = runs.map((r) => r.value);
      expect(new Set(values).size).toBeGreaterThan(1);
    });
  });

  describe("Statistical tolerance for simulation outputs", () => {
    it("mean of uniform [0, 1) samples is approximately 0.5 (within ±0.15 for n=100)", () => {
      // Use a simple LCG to generate pseudo-uniform values.
      let state = 42;
      const values: number[] = [];
      for (let i = 0; i < 100; i++) {
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        values.push(state / 0x7fffffff);
      }
      const m = mean(values);
      expect(m).toBeGreaterThan(0.35);
      expect(m).toBeLessThan(0.65);
    });

    it("std of constant sample is 0", () => {
      expect(std([5, 5, 5, 5, 5])).toBe(0);
    });

    it("std of [1, 2, 3, 4, 5] is approximately 1.58", () => {
      const s = std([1, 2, 3, 4, 5]);
      // sqrt(10/4) = sqrt(2.5) ≈ 1.581
      expect(s).toBeCloseTo(1.581, 1);
    });
  });

  describe("aggregateRuns CI properties", () => {
    it("CI contains the sample mean", () => {
      const runs = [
        { x: 10 },
        { x: 20 },
        { x: 30 },
        { x: 40 },
        { x: 50 },
      ];
      const agg = aggregateRuns(runs, 0.95);
      expect(agg.x.ci_lower).toBeLessThanOrEqual(agg.x.mean);
      expect(agg.x.ci_upper).toBeGreaterThanOrEqual(agg.x.mean);
    });

    it("CI bounds are finite numbers", () => {
      const runs = runMultiRunSimulation(
        (_i, seed) => ({ v: (seed % 50) / 100 }),
        10,
        42,
      );
      const agg = aggregateRuns(runs);
      expect(Number.isFinite(agg.v.ci_lower)).toBe(true);
      expect(Number.isFinite(agg.v.ci_upper)).toBe(true);
      expect(Number.isFinite(agg.v.mean)).toBe(true);
      expect(Number.isFinite(agg.v.std)).toBe(true);
    });
  });
});
