/**
 * R5-01: Unit tests for typed attribute units in Balance.
 *
 * Covers:
 *   - classifyAttributeUnit: name → unit group mapping.
 *   - normalizeAttributes: per-unit min-max normalization.
 *   - computeUnitAwareWeights: unit-group-aware weighting.
 *   - computeUnitAwarePower: weighted power from normalized attrs.
 *   - findInvalidAttributes: NaN/string detection.
 *   - R5-01 acceptance: incomparable units are not silently summed at different scales.
 */

import { describe, it, expect } from "vitest";
import {
  classifyAttributeUnit,
  normalizeAttributes,
  computeUnitAwareWeights,
  computeUnitAwarePower,
  findInvalidAttributes,
  UNIT_DEFAULT_WEIGHTS,
} from "./attribute-units";

describe("classifyAttributeUnit — name → unit group", () => {
  it("classifies combat_power attributes", () => {
    expect(classifyAttributeUnit("power").unit).toBe("combat_power");
    expect(classifyAttributeUnit("damage").unit).toBe("combat_power");
    expect(classifyAttributeUnit("attack").unit).toBe("combat_power");
    expect(classifyAttributeUnit("dps").unit).toBe("combat_power");
  });

  it("classifies survivability attributes", () => {
    expect(classifyAttributeUnit("defense").unit).toBe("survivability");
    expect(classifyAttributeUnit("hp").unit).toBe("survivability");
    expect(classifyAttributeUnit("health").unit).toBe("survivability");
    expect(classifyAttributeUnit("armor").unit).toBe("survivability");
    expect(classifyAttributeUnit("shield").unit).toBe("survivability");
  });

  it("classifies mobility attributes", () => {
    expect(classifyAttributeUnit("speed").unit).toBe("mobility");
    expect(classifyAttributeUnit("range").unit).toBe("mobility");
    expect(classifyAttributeUnit("mobility").unit).toBe("mobility");
    expect(classifyAttributeUnit("velocity").unit).toBe("mobility");
  });

  it("classifies utility attributes", () => {
    expect(classifyAttributeUnit("utility").unit).toBe("utility");
    expect(classifyAttributeUnit("crit").unit).toBe("utility");
    expect(classifyAttributeUnit("cooldown").unit).toBe("utility");
    expect(classifyAttributeUnit("mana").unit).toBe("utility");
  });

  it("classifies unknown attributes as 'unknown'", () => {
    expect(classifyAttributeUnit("quantum_flux").unit).toBe("unknown");
    expect(classifyAttributeUnit("xyz").unit).toBe("unknown");
  });

  it("is case-insensitive", () => {
    expect(classifyAttributeUnit("POWER").unit).toBe("combat_power");
    expect(classifyAttributeUnit("Defense").unit).toBe("survivability");
    expect(classifyAttributeUnit("Speed").unit).toBe("mobility");
  });

  it("returns default weight matching the unit group", () => {
    expect(classifyAttributeUnit("power").defaultWeight).toBe(UNIT_DEFAULT_WEIGHTS.combat_power);
    expect(classifyAttributeUnit("defense").defaultWeight).toBe(UNIT_DEFAULT_WEIGHTS.survivability);
    expect(classifyAttributeUnit("speed").defaultWeight).toBe(UNIT_DEFAULT_WEIGHTS.mobility);
  });
});

describe("normalizeAttributes — per-unit min-max normalization", () => {
  it("normalizes each attribute to [0, 1] across objects", () => {
    const normalized = normalizeAttributes([
      { power: 30, range: 5 },
      { power: 60, range: 8 },
      { power: 90, range: 10 },
    ]);
    // power: 30→0, 60→0.5, 90→1
    expect(normalized[0].power).toBe(0);
    expect(normalized[1].power).toBeCloseTo(0.5, 3);
    expect(normalized[2].power).toBe(1);
    // range: 5→0, 8→0.6, 10→1
    expect(normalized[0].range).toBe(0);
    expect(normalized[2].range).toBe(1);
  });

  it("handles equal values (range < 0.01 → neutral 0.5)", () => {
    const normalized = normalizeAttributes([
      { power: 50 },
      { power: 50 },
    ]);
    expect(normalized[0].power).toBe(0.5);
    expect(normalized[1].power).toBe(0.5);
  });

  it("handles single object (→ neutral 0.5)", () => {
    const normalized = normalizeAttributes([{ power: 30, range: 5 }]);
    expect(normalized[0].power).toBe(0.5);
    expect(normalized[0].range).toBe(0.5);
  });

  it("returns [] for empty input", () => {
    expect(normalizeAttributes([])).toEqual([]);
  });

  it("normalizes each unit group independently (incomparable units not mixed)", () => {
    // power (combat_power) and range (mobility) have different scales.
    // After normalization, both are in [0, 1] but computed from their own min/max.
    const normalized = normalizeAttributes([
      { power: 10, range: 1 },
      { power: 100, range: 100 },
    ]);
    expect(normalized[0].power).toBe(0);
    expect(normalized[1].power).toBe(1);
    expect(normalized[0].range).toBe(0);
    expect(normalized[1].range).toBe(1);
  });

  it("drops non-finite values to 0", () => {
    const normalized = normalizeAttributes([
      { power: 30, range: NaN },
      { power: 60, range: 8 },
    ]);
    expect(normalized[0].range).toBe(0);
  });
});

describe("computeUnitAwareWeights — unit-group-aware weighting", () => {
  it("returns weights summing to 1 across all attributes", () => {
    const weights = computeUnitAwareWeights(["power", "defense", "speed"]);
    const sum = Object.values(weights).reduce((s, w) => s + w, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
  });

  it("gives combat_power attributes higher weight than mobility", () => {
    const weights = computeUnitAwareWeights(["power", "speed"]);
    expect(weights.power).toBeGreaterThan(weights.speed);
  });

  it("gives equal weight to attributes of the same unit group", () => {
    const weights = computeUnitAwareWeights(["power", "damage"]);
    expect(weights.power).toBeCloseTo(weights.damage, 4);
  });

  it("returns {} for empty input", () => {
    expect(computeUnitAwareWeights([])).toEqual({});
  });

  it("handles a mix of all unit groups", () => {
    const weights = computeUnitAwareWeights(["power", "defense", "speed", "utility"]);
    expect(weights.power).toBeGreaterThan(weights.defense);
    expect(weights.defense).toBeGreaterThan(weights.speed);
    expect(weights.speed).toBeGreaterThan(weights.utility);
  });
});

describe("computeUnitAwarePower — weighted power from normalized attrs", () => {
  it("returns a score in [0, 1]", () => {
    const weights = computeUnitAwareWeights(["power", "range"]);
    const normalized = normalizeAttributes([
      { power: 30, range: 5 },
      { power: 60, range: 10 },
    ]);
    const power0 = computeUnitAwarePower({ power: 30, range: 5 }, weights, normalized[0]);
    const power1 = computeUnitAwarePower({ power: 60, range: 10 }, weights, normalized[1]);
    expect(power0).toBeGreaterThanOrEqual(0);
    expect(power0).toBeLessThanOrEqual(1);
    expect(power1).toBeGreaterThanOrEqual(0);
    expect(power1).toBeLessThanOrEqual(1);
  });

  it("higher normalized attributes → higher power", () => {
    const weights = computeUnitAwareWeights(["power", "range"]);
    const normalized = normalizeAttributes([
      { power: 30, range: 5 },
      { power: 90, range: 10 },
    ]);
    const lowPower = computeUnitAwarePower({ power: 30, range: 5 }, weights, normalized[0]);
    const highPower = computeUnitAwarePower({ power: 90, range: 10 }, weights, normalized[1]);
    expect(highPower).toBeGreaterThan(lowPower);
  });
});

describe("findInvalidAttributes — NaN/string detection", () => {
  it("returns empty array when all attributes are finite numbers", () => {
    const invalid = findInvalidAttributes([
      { power: 30, range: 5 },
      { power: 60, range: 8 },
    ]);
    expect(invalid).toEqual([]);
  });

  it("detects NaN values", () => {
    const invalid = findInvalidAttributes([
      { power: 30, range: NaN },
    ]);
    expect(invalid).toHaveLength(1);
    expect(invalid[0]).toEqual({ objectIndex: 0, attr: "range", value: NaN });
  });

  it("detects string values", () => {
    const invalid = findInvalidAttributes([
      { power: 30, range: "5" as unknown as number },
    ]);
    expect(invalid).toHaveLength(1);
    expect(invalid[0].attr).toBe("range");
  });

  it("detects Infinity values", () => {
    const invalid = findInvalidAttributes([
      { power: Infinity },
    ]);
    expect(invalid).toHaveLength(1);
  });

  it("detects invalid attributes across multiple objects", () => {
    const invalid = findInvalidAttributes([
      { power: 30 },
      { power: "bad" as unknown as number, range: NaN },
    ]);
    expect(invalid).toHaveLength(2);
    expect(invalid[0].objectIndex).toBe(1);
    expect(invalid[1].objectIndex).toBe(1);
  });
});

describe("R5-01 acceptance — incomparable units not silently summed", () => {
  it("objects with same power but different range scales get different power scores", () => {
    // Two objects with power=50 but very different range scales (1 vs 100).
    // Before R5-01, range was summed at its raw scale, so the object with
    // range=100 would dominate regardless of unit. After R5-01, range is
    // normalized to [0,1] within its mobility unit group, so the difference
    // is captured proportionally, not absolutely.
    const normalized = normalizeAttributes([
      { power: 50, range: 1 },
      { power: 50, range: 100 },
    ]);
    const weights = computeUnitAwareWeights(["power", "range"]);
    const power0 = computeUnitAwarePower({ power: 50, range: 1 }, weights, normalized[0]);
    const power1 = computeUnitAwarePower({ power: 50, range: 100 }, weights, normalized[1]);
    // Both have power normalized to 0.5 (equal), but range differs:
    // object 0 range=0 (min), object 1 range=1 (max).
    expect(power1).toBeGreaterThan(power0);
    // The difference should be proportional to range weight, not 99 (raw diff).
    expect(power1 - power0).toBeLessThan(1);
  });

  it("normalization makes power and range contribute on the same [0,1] scale", () => {
    const normalized = normalizeAttributes([
      { power: 30, range: 5 },
      { power: 90, range: 10 },
    ]);
    // Both power and range are now in [0, 1], so they can be summed
    // without one dominating the other due to raw scale.
    for (const obj of normalized) {
      for (const v of Object.values(obj)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("unit-aware weights ensure combat_power attributes dominate appropriately", () => {
    // A set with power (combat_power) and utility (utility) — power should
    // have higher weight because combat_power > utility in default weights.
    const weights = computeUnitAwareWeights(["power", "utility"]);
    expect(weights.power).toBeGreaterThan(weights.utility);
  });
});
