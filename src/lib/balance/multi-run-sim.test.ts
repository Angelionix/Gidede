/**
 * R5-09: Unit tests for multi-run simulation and confidence intervals.
 */

import { describe, it, expect } from "vitest";
import {
  mean,
  std,
  computeConfidenceInterval,
  runMultiRunSimulation,
  aggregateRuns,
} from "./multi-run-sim";

describe("mean / std — basic statistics", () => {
  it("mean returns 0 for empty array", () => {
    expect(mean([])).toBe(0);
  });

  it("mean computes the arithmetic mean", () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3);
  });

  it("std returns 0 for fewer than 2 values", () => {
    expect(std([])).toBe(0);
    expect(std([5])).toBe(0);
  });

  it("std computes Bessel-corrected sample standard deviation", () => {
    // [2, 4, 4, 4, 5, 5, 7, 9] → std = 2.138...
    const s = std([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(s).toBeCloseTo(2.138, 2);
  });
});

describe("computeConfidenceInterval", () => {
  it("returns zero CI for empty array", () => {
    const ci = computeConfidenceInterval([]);
    expect(ci.n).toBe(0);
    expect(ci.mean).toBe(0);
  });

  it("returns point estimate for single value", () => {
    const ci = computeConfidenceInterval([42]);
    expect(ci.mean).toBe(42);
    expect(ci.ci_lower).toBe(42);
    expect(ci.ci_upper).toBe(42);
    expect(ci.n).toBe(1);
  });

  it("ci_lower <= mean <= ci_upper for multiple values", () => {
    const ci = computeConfidenceInterval([10, 20, 30, 40, 50]);
    expect(ci.mean).toBe(30);
    expect(ci.ci_lower).toBeLessThanOrEqual(ci.mean);
    expect(ci.ci_upper).toBeGreaterThanOrEqual(ci.mean);
  });

  it("larger sample → narrower CI (all else equal)", () => {
    const small = computeConfidenceInterval([10, 20, 30]);
    const large = computeConfidenceInterval([10, 20, 30, 15, 25, 35, 12, 18, 28, 32, 14, 22, 26, 34, 16, 24, 11, 19, 29, 31, 13, 17, 23, 27, 33, 15, 25, 21, 20, 30]);
    const smallWidth = small.ci_upper - small.ci_lower;
    const largeWidth = large.ci_upper - large.ci_lower;
    expect(largeWidth).toBeLessThan(smallWidth);
  });

  it("higher confidence → wider CI", () => {
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

  it("zero-variance sample → CI = mean", () => {
    const ci = computeConfidenceInterval([5, 5, 5, 5, 5]);
    expect(ci.mean).toBe(5);
    expect(ci.ci_lower).toBe(5);
    expect(ci.ci_upper).toBe(5);
  });
});

describe("runMultiRunSimulation", () => {
  it("runs N independent passes with different seeds", () => {
    const runs = runMultiRunSimulation(
      (runIndex, seed) => ({ runIndex, seed_mod: seed % 100 }),
      5,
      1000,
    );
    expect(runs.length).toBe(5);
    // Each run has a different runIndex.
    expect(runs.map((r) => r.runIndex)).toEqual([0, 1, 2, 3, 4]);
    // Seeds differ across runs.
    const seeds = runs.map((r) => r.seed_mod);
    expect(new Set(seeds).size).toBe(5);
  });

  it("returns empty array for nRuns=0", () => {
    expect(runMultiRunSimulation(() => ({}), 0, 1000)).toEqual([]);
  });

  it("is deterministic: same baseSeed → same runs", () => {
    const fn = (i: number, s: number) => ({ x: (s * 31 + i) % 1000 });
    const a = runMultiRunSimulation(fn, 3, 42);
    const b = runMultiRunSimulation(fn, 3, 42);
    expect(a).toEqual(b);
  });

  it("different baseSeed → different runs", () => {
    const fn = (i: number, s: number) => ({ x: s % 1000 });
    const a = runMultiRunSimulation(fn, 3, 42);
    const b = runMultiRunSimulation(fn, 3, 99);
    expect(a).not.toEqual(b);
  });
});

describe("aggregateRuns", () => {
  it("returns empty object for empty runs", () => {
    expect(aggregateRuns([])).toEqual({});
  });

  it("aggregates metrics across runs with mean/std/CI", () => {
    const runs = [
      { win_rate: 0.5, duration: 60 },
      { win_rate: 0.6, duration: 70 },
      { win_rate: 0.4, duration: 50 },
    ];
    const agg = aggregateRuns(runs);
    expect(agg.win_rate).toBeDefined();
    expect(agg.win_rate.mean).toBeCloseTo(0.5, 2);
    expect(agg.win_rate.n).toBe(3);
    expect(agg.win_rate.ci_lower).toBeLessThanOrEqual(agg.win_rate.mean);
    expect(agg.win_rate.ci_upper).toBeGreaterThanOrEqual(agg.win_rate.mean);
    expect(agg.duration.mean).toBeCloseTo(60, 1);
  });

  it("handles runs with different metric keys", () => {
    const runs: Record<string, number>[] = [
      { a: 1, b: 2 },
      { a: 3, b: 4, c: 5 },
      { a: 5, c: 6 },
    ];
    const agg = aggregateRuns(runs);
    expect(agg.a.n).toBe(3);
    expect(agg.b.n).toBe(2);
    expect(agg.c.n).toBe(2);
  });

  it("filters out non-finite values", () => {
    const runs: Record<string, number>[] = [
      { x: 1 },
      { x: NaN },
      { x: 3 },
    ];
    const agg = aggregateRuns(runs);
    expect(agg.x.n).toBe(2);
    expect(agg.x.mean).toBe(2);
  });
});

describe("R5-09 acceptance", () => {
  it("N runs produce N independent samples (not 1 repeated)", () => {
    const runs = runMultiRunSimulation(
      (_i, seed) => ({ value: (seed % 100) / 100 }),
      10,
      12345,
    );
    expect(runs.length).toBe(10);
    // At least some runs should differ (not all identical).
    const values = runs.map((r) => r.value);
    expect(new Set(values).size).toBeGreaterThan(1);
  });

  it("confidence intervals reflect sample variance", () => {
    // High-variance sample → wide CI.
    const highVar = computeConfidenceInterval([0, 100, 0, 100, 0, 100]);
    // Low-variance sample → narrow CI.
    const lowVar = computeConfidenceInterval([49, 50, 51, 50, 50, 51]);
    const highWidth = highVar.ci_upper - highVar.ci_lower;
    const lowWidth = lowVar.ci_upper - lowVar.ci_lower;
    expect(highWidth).toBeGreaterThan(lowWidth);
  });

  it("aggregateRuns produces mean/std/ci for each metric", () => {
    const runs = runMultiRunSimulation(
      (i, s) => ({
        metric_a: (s % 50) / 100,
        metric_b: (s % 30) / 100,
      }),
      10,
      999,
    );
    const agg = aggregateRuns(runs);
    for (const key of ["metric_a", "metric_b"]) {
      expect(agg[key]).toBeDefined();
      expect(agg[key].n).toBe(10);
      expect(agg[key].mean).toBeGreaterThanOrEqual(0);
      expect(agg[key].std).toBeGreaterThanOrEqual(0);
      expect(agg[key].ci_lower).toBeLessThanOrEqual(agg[key].mean);
      expect(agg[key].ci_upper).toBeGreaterThanOrEqual(agg[key].mean);
    }
  });
});
