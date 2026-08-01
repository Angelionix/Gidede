/**
 * R5-06: Unit tests for Balance simulation seed.
 */

import { describe, it, expect } from "vitest";
import { computeBalanceSeed, hashString, type BalanceObjectForSeed } from "./sim-seed";

const obj1: BalanceObjectForSeed = { name: "sword", attributes: { power: 30, speed: 5 }, cost: 100, tier: 1 };
const obj2: BalanceObjectForSeed = { name: "shield", attributes: { defense: 20, mobility: 3 }, cost: 150, tier: 2 };

describe("computeBalanceSeed — reproducibility", () => {
  it("same projectId + same objects → same seed (reproducible)", () => {
    const a = computeBalanceSeed("proj-1", [obj1, obj2]);
    const b = computeBalanceSeed("proj-1", [obj1, obj2]);
    expect(a).toBe(b);
  });

  it("same projectId + same objects + same simVersion → same seed", () => {
    const a = computeBalanceSeed("proj-1", [obj1], "v1");
    const b = computeBalanceSeed("proj-1", [obj1], "v1");
    expect(a).toBe(b);
  });
});

describe("computeBalanceSeed — input sensitivity", () => {
  it("different projectId + same objects → different seed", () => {
    const a = computeBalanceSeed("proj-1", [obj1, obj2]);
    const b = computeBalanceSeed("proj-2", [obj1, obj2]);
    expect(a).not.toBe(b);
  });

  it("same projectId + different objects → different seed (R5-06 acceptance)", () => {
    const a = computeBalanceSeed("proj-1", [obj1, obj2]);
    const b = computeBalanceSeed("proj-1", [{ ...obj1, attributes: { power: 40, speed: 5 } }, obj2]);
    expect(a).not.toBe(b);
  });

  it("changing object name changes seed", () => {
    const a = computeBalanceSeed("proj-1", [{ name: "sword", attributes: { power: 30 } }]);
    const b = computeBalanceSeed("proj-1", [{ name: "axe", attributes: { power: 30 } }]);
    expect(a).not.toBe(b);
  });

  it("changing attribute value changes seed", () => {
    const a = computeBalanceSeed("proj-1", [{ name: "sword", attributes: { power: 30 } }]);
    const b = computeBalanceSeed("proj-1", [{ name: "sword", attributes: { power: 31 } }]);
    expect(a).not.toBe(b);
  });

  it("changing cost changes seed", () => {
    const a = computeBalanceSeed("proj-1", [{ name: "sword", cost: 100 }]);
    const b = computeBalanceSeed("proj-1", [{ name: "sword", cost: 200 }]);
    expect(a).not.toBe(b);
  });

  it("changing object order changes seed", () => {
    const a = computeBalanceSeed("proj-1", [obj1, obj2]);
    const b = computeBalanceSeed("proj-1", [obj2, obj1]);
    expect(a).not.toBe(b);
  });

  it("different simVersion → different seed", () => {
    const a = computeBalanceSeed("proj-1", [obj1], "v1");
    const b = computeBalanceSeed("proj-1", [obj1], "v2");
    expect(a).not.toBe(b);
  });
});

describe("computeBalanceSeed — canonicalization", () => {
  it("attribute key order does not affect seed", () => {
    const a = computeBalanceSeed("proj-1", [{ name: "x", attributes: { power: 30, speed: 5 } }]);
    const b = computeBalanceSeed("proj-1", [{ name: "x", attributes: { speed: 5, power: 30 } }]);
    expect(a).toBe(b);
  });

  it("handles objects without attributes/cost/tier", () => {
    const seed = computeBalanceSeed("proj-1", [{ name: "bare" }]);
    expect(typeof seed).toBe("number");
    expect(seed).toBeGreaterThanOrEqual(0);
  });

  it("handles empty objects array", () => {
    const seed = computeBalanceSeed("proj-1", []);
    expect(typeof seed).toBe("number");
  });
});

describe("hashString — basic properties", () => {
  it("returns a 32-bit unsigned integer", () => {
    const hash = hashString("test");
    expect(typeof hash).toBe("number");
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThanOrEqual(0xFFFFFFFF);
  });

  it("is deterministic", () => {
    expect(hashString("hello")).toBe(hashString("hello"));
  });

  it("different strings → different hashes (usually)", () => {
    expect(hashString("hello")).not.toBe(hashString("world"));
  });
});

describe("R5-06 acceptance", () => {
  it("changing objects changes seed (was: only projectId)", () => {
    // Before R5-06: seed = hashString(proj.id) → same seed regardless of objects.
    // After R5-06: seed incorporates objects → different objects → different seed.
    const seed1 = computeBalanceSeed("proj-1", [obj1]);
    const seed2 = computeBalanceSeed("proj-1", [obj2]);
    expect(seed1).not.toBe(seed2);
  });

  it("same input is reproducible", () => {
    const seed1 = computeBalanceSeed("proj-1", [obj1, obj2], "v1");
    const seed2 = computeBalanceSeed("proj-1", [obj1, obj2], "v1");
    expect(seed1).toBe(seed2);
  });
});
