/**
 * TASK-4.18: Unit tests for Balance pathologies (Block 4, TASK-4.9).
 *
 * Covers all 8 Bible 5.13 balance pathologies detection.
 */

import { describe, it, expect } from "vitest";
import { detectBalancePathologies } from "./pathologies";

describe("detectBalancePathologies — Bible 5.13", () => {
  const baseInput = {
    transitiveOverpowered: [],
    transitiveUnderpowered: [],
    dominatedStrategies: [],
    hasDominantStrategy: false,
    nashEquilibrium: [0.25, 0.25, 0.25, 0.25],
    maxShare: 0.25,
    runawayFrequency: 0,
    stallFrequency: 0,
    buildGap: 0,
    stabilityIndex: 0.8,
    winRateSpread: 10,
    rankingCorrelation: 0.85,
  };

  it("returns empty array for healthy balance", () => {
    const result = detectBalancePathologies(baseInput);
    expect(result.length).toBe(0);
  });

  // 5.13.1: Dominant Strategy
  it("detects Dominant Strategy when hasDominantStrategy=true", () => {
    const result = detectBalancePathologies({
      ...baseInput,
      hasDominantStrategy: true,
      dominatedStrategies: ["weak_object"],
    });
    const ds = result.find((p) => p.type === "dominant_strategy");
    expect(ds).toBeDefined();
    expect(ds?.severity).toBe("critical");
    expect(ds?.bible_ref).toBe("Bible 5.13.1");
    expect(ds?.description).toContain("weak_object");
  });

  // 5.13.2: Runaway
  it("detects Runaway when runawayFrequency > 0.3", () => {
    const result = detectBalancePathologies({
      ...baseInput,
      runawayFrequency: 0.4,
    });
    const r = result.find((p) => p.type === "runaway");
    expect(r).toBeDefined();
    expect(r?.severity).toBe("warning");
    expect(r?.bible_ref).toBe("Bible 5.13.2");
  });

  it("detects Runaway as critical when frequency > 0.5", () => {
    const result = detectBalancePathologies({
      ...baseInput,
      runawayFrequency: 0.6,
    });
    const r = result.find((p) => p.type === "runaway");
    expect(r?.severity).toBe("critical");
  });

  it("does NOT detect Runaway when frequency <= 0.3", () => {
    const result = detectBalancePathologies({
      ...baseInput,
      runawayFrequency: 0.2,
    });
    expect(result.find((p) => p.type === "runaway")).toBeUndefined();
  });

  // 5.13.3: Dead Zone
  it("detects Dead Zone when underpowered objects exist", () => {
    const result = detectBalancePathologies({
      ...baseInput,
      transitiveUnderpowered: ["weak_sword", "weak_armor"],
    });
    const dz = result.find((p) => p.type === "dead_zone");
    expect(dz).toBeDefined();
    expect(dz?.severity).toBe("warning");
    expect(dz?.bible_ref).toBe("Bible 5.13.3");
    expect(dz?.description).toContain("weak_sword");
  });

  // 5.13.4: Mandatory Choice
  it("detects Mandatory Choice when maxShare > 0.5", () => {
    const result = detectBalancePathologies({
      ...baseInput,
      maxShare: 0.6,
    });
    const mc = result.find((p) => p.type === "mandatory_choice");
    expect(mc).toBeDefined();
    expect(mc?.bible_ref).toBe("Bible 5.13.4");
  });

  it("does NOT detect Mandatory Choice when maxShare <= 0.5", () => {
    const result = detectBalancePathologies({
      ...baseInput,
      maxShare: 0.4,
    });
    expect(result.find((p) => p.type === "mandatory_choice")).toBeUndefined();
  });

  // 5.13.5: Build Gap
  it("detects Build Gap when buildGap > 0.25", () => {
    const result = detectBalancePathologies({
      ...baseInput,
      buildGap: 0.3,
    });
    const bg = result.find((p) => p.type === "build_gap");
    expect(bg).toBeDefined();
    expect(bg?.severity).toBe("warning");
    expect(bg?.bible_ref).toBe("Bible 5.13.5");
  });

  it("detects Build Gap as critical when gap > 0.4", () => {
    const result = detectBalancePathologies({
      ...baseInput,
      buildGap: 0.5,
    });
    const bg = result.find((p) => p.type === "build_gap");
    expect(bg?.severity).toBe("critical");
  });

  // 5.13.6: Inflation
  it("detects Inflation when stabilityIndex < 0.4", () => {
    const result = detectBalancePathologies({
      ...baseInput,
      stabilityIndex: 0.3,
    });
    const inf = result.find((p) => p.type === "inflation");
    expect(inf).toBeDefined();
    expect(inf?.bible_ref).toBe("Bible 5.13.6");
  });

  // 5.13.7: Economy Fragility
  it("detects Economy Fragility when stallFrequency > 0.3", () => {
    const result = detectBalancePathologies({
      ...baseInput,
      stallFrequency: 0.4,
    });
    const ef = result.find((p) => p.type === "economy_fragility");
    expect(ef).toBeDefined();
    expect(ef?.bible_ref).toBe("Bible 5.13.7");
  });

  // 5.13.8: Perceived Unfairness
  it("detects Perceived Unfairness when winRateSpread > 30", () => {
    const result = detectBalancePathologies({
      ...baseInput,
      winRateSpread: 35,
    });
    const pu = result.find((p) => p.type === "perceived_unfairness");
    expect(pu).toBeDefined();
    expect(pu?.bible_ref).toBe("Bible 5.13.8");
  });

  it("detects Perceived Unfairness when rankingCorrelation < 0.5", () => {
    const result = detectBalancePathologies({
      ...baseInput,
      rankingCorrelation: 0.4,
    });
    const pu = result.find((p) => p.type === "perceived_unfairness");
    expect(pu).toBeDefined();
  });

  it("detects Perceived Unfairness as critical when spread > 40", () => {
    const result = detectBalancePathologies({
      ...baseInput,
      winRateSpread: 45,
    });
    const pu = result.find((p) => p.type === "perceived_unfairness");
    expect(pu?.severity).toBe("critical");
  });

  it("can detect multiple pathologies simultaneously", () => {
    const result = detectBalancePathologies({
      ...baseInput,
      hasDominantStrategy: true,
      dominatedStrategies: ["weak"],
      transitiveUnderpowered: ["weak"],
      runawayFrequency: 0.5,
      buildGap: 0.3,
      winRateSpread: 35,
    });
    expect(result.length).toBeGreaterThanOrEqual(5);
    const types = result.map((p) => p.type);
    expect(types).toContain("dominant_strategy");
    expect(types).toContain("dead_zone");
    expect(types).toContain("runaway");
    expect(types).toContain("build_gap");
    expect(types).toContain("perceived_unfairness");
  });

  it("all pathologies include bible_ref, description, and correction", () => {
    const result = detectBalancePathologies({
      ...baseInput,
      hasDominantStrategy: true,
      dominatedStrategies: ["x"],
      runawayFrequency: 0.5,
      buildGap: 0.4,
    });
    for (const p of result) {
      expect(p.bible_ref).toMatch(/^Bible 5\.13\.\d+$/);
      expect(p.description).toBeTruthy();
      expect(p.correction).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.type).toBeTruthy();
      expect(["critical", "warning", "info"]).toContain(p.severity);
    }
  });
});
