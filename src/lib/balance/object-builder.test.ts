/**
 * R5-02: Unit tests for Balance object builder from MDA/Core domain model.
 */

import { describe, it, expect } from "vitest";
import {
  buildBalanceObjectsFromDomain,
  buildBalanceObjectsLegacy,
  buildBalanceObjects,
  type MdaMechanicSet,
} from "./object-builder";
import type { MechanicRef } from "@/lib/mechanic-ref";

const sampleMechanicSet: MdaMechanicSet = {
  base: [{ mechanic_name: "Изучение мира" }, { mechanic_name: "Инвентарь" }],
  combat: [{ mechanic_name: "Броня" }, { mechanic_name: "Запас патронов" }],
  progression: [{ mechanic_name: "Очки опыта" }],
  spatial: [{ mechanic_name: "Карта" }],
  social: [{ mechanic_name: "Лидерборд" }],
};

const sampleRefs: MechanicRef[] = [
  { id: "bronya", name: "Броня", group: "Боевые", category: "combat", source: "mechanics_db" },
  { id: "izuchenie_mira", name: "Изучение мира", group: "Базовые", category: "base", source: "mechanics_db" },
];

describe("buildBalanceObjectsFromDomain — domain-based builder", () => {
  it("returns objects with source='mda_domain'", () => {
    const objects = buildBalanceObjectsFromDomain(sampleMechanicSet);
    expect(objects.length).toBeGreaterThan(0);
    for (const o of objects) {
      expect(o.source).toBe("mda_domain");
    }
  });

  it("derives object type from mechanic category", () => {
    const objects = buildBalanceObjectsFromDomain(sampleMechanicSet);
    const combat = objects.find((o) => o.name === "Броня");
    expect(combat).toBeDefined();
    expect(combat!.type).toBe("weapon");
    expect(combat!.derived_from_category).toBe("combat");

    const base = objects.find((o) => o.name === "Изучение мира");
    expect(base).toBeDefined();
    expect(base!.type).toBe("armor");
    expect(base!.derived_from_category).toBe("base");
  });

  it("attributes match the category schema", () => {
    const objects = buildBalanceObjectsFromDomain(sampleMechanicSet);
    const combat = objects.find((o) => o.name === "Броня")!;
    // combat → weapon → {power, speed}
    expect(combat.attributes).toHaveProperty("power");
    expect(combat.attributes).toHaveProperty("speed");
    expect(combat.attributes).not.toHaveProperty("defense");

    const baseObj = objects.find((o) => o.name === "Изучение мира")!;
    // base → armor → {defense, mobility}
    expect(baseObj.attributes).toHaveProperty("defense");
    expect(baseObj.attributes).toHaveProperty("mobility");
  });

  it("uses stable mechanic id from ref when available", () => {
    const objects = buildBalanceObjectsFromDomain(sampleMechanicSet, sampleRefs);
    const bronya = objects.find((o) => o.name === "Броня");
    expect(bronya!.id).toBe("bronya");
  });

  it("falls back to mechanic_N id when no ref available", () => {
    const objects = buildBalanceObjectsFromDomain(sampleMechanicSet);
    // All ids should be mechanic_N or ref-derived.
    for (const o of objects) {
      expect(o.id).toMatch(/^(mechanic_\d+|bronya|izuchenie_mira)$/);
    }
  });

  it("respects maxObjects limit", () => {
    const objects = buildBalanceObjectsFromDomain(sampleMechanicSet, undefined, 3);
    expect(objects.length).toBeLessThanOrEqual(3);
  });

  it("prioritizes combat > progression > base > spatial > social", () => {
    // With maxObjects=2, both objects come from combat (it has 2 mechanics).
    const objects = buildBalanceObjectsFromDomain(sampleMechanicSet, undefined, 2);
    expect(objects.length).toBe(2);
    expect(objects[0].derived_from_category).toBe("combat");
    expect(objects[1].derived_from_category).toBe("combat");

    // With a set that has 1 combat + 1 progression, maxObjects=2 → combat then progression.
    const singlePerCategory: MdaMechanicSet = {
      base: [], combat: [{ mechanic_name: "C1" }], progression: [{ mechanic_name: "P1" }],
      spatial: [], social: [],
    };
    const objects2 = buildBalanceObjectsFromDomain(singlePerCategory, undefined, 2);
    expect(objects2[0].derived_from_category).toBe("combat");
    expect(objects2[1].derived_from_category).toBe("progression");
  });

  it("is deterministic: same inputs → same outputs", () => {
    const a = buildBalanceObjectsFromDomain(sampleMechanicSet, sampleRefs);
    const b = buildBalanceObjectsFromDomain(sampleMechanicSet, sampleRefs);
    expect(a).toEqual(b);
  });

  it("different mechanics produce different attributes", () => {
    const objects = buildBalanceObjectsFromDomain(sampleMechanicSet);
    const bronya = objects.find((o) => o.name === "Броня")!;
    const zapas = objects.find((o) => o.name === "Запас патронов")!;
    expect(bronya.attributes.power).not.toBe(zapas.attributes.power);
  });

  it("returns [] for null/undefined mechanicSet", () => {
    expect(buildBalanceObjectsFromDomain(null)).toEqual([]);
    expect(buildBalanceObjectsFromDomain(undefined)).toEqual([]);
  });

  it("returns [] for empty mechanicSet", () => {
    expect(buildBalanceObjectsFromDomain({
      base: [], combat: [], progression: [], spatial: [], social: [],
    })).toEqual([]);
  });
});

describe("buildBalanceObjectsLegacy — fallback builder", () => {
  it("returns objects with source='legacy_hash'", () => {
    const objects = buildBalanceObjectsLegacy(["combat", "explore"]);
    expect(objects.length).toBe(2);
    for (const o of objects) {
      expect(o.source).toBe("legacy_hash");
    }
  });

  it("all objects have type='mechanic' (generic)", () => {
    const objects = buildBalanceObjectsLegacy(["a", "b"]);
    for (const o of objects) {
      expect(o.type).toBe("mechanic");
    }
  });

  it("synthesizes at least 2 objects when given < 2 mechanics", () => {
    const objects = buildBalanceObjectsLegacy(["solo"]);
    expect(objects.length).toBe(2);
    expect(objects[1].name).toBe("secondary mechanic");
  });
});

describe("buildBalanceObjects — dispatcher", () => {
  it("uses domain builder when MDA mechanicSet is available", () => {
    const objects = buildBalanceObjects(sampleMechanicSet, ["Броня"], sampleRefs);
    expect(objects.length).toBeGreaterThan(0);
    expect(objects.some((o) => o.source === "mda_domain")).toBe(true);
  });

  it("falls back to legacy builder when mechanicSet is null", () => {
    const objects = buildBalanceObjects(null, ["combat", "explore"]);
    expect(objects.length).toBe(2);
    expect(objects.every((o) => o.source === "legacy_hash")).toBe(true);
  });

  it("falls back to legacy builder when mechanicSet produces < 2 objects", () => {
    const sparse: MdaMechanicSet = {
      base: [], combat: [{ mechanic_name: "only" }], progression: [],
      spatial: [], social: [],
    };
    const objects = buildBalanceObjects(sparse, ["fallback1", "fallback2"]);
    // Domain produces 1 object (< 2) → legacy fallback.
    expect(objects.every((o) => o.source === "legacy_hash")).toBe(true);
  });
});

describe("R5-02 acceptance — Balance objects from MDA/Core domain model", () => {
  it("objects are derived from MDA categories, not name hashing", () => {
    const objects = buildBalanceObjectsFromDomain(sampleMechanicSet);
    // Each object's derived_from_category is set.
    for (const o of objects) {
      expect(o.derived_from_category).toBeDefined();
      expect(["combat", "progression", "base", "spatial", "social"]).toContain(o.derived_from_category);
    }
  });

  it("object types reflect category semantics (weapon/armor/upgrade/unit/support)", () => {
    const objects = buildBalanceObjectsFromDomain(sampleMechanicSet);
    const types = new Set(objects.map((o) => o.type));
    // Should include at least weapon (combat) and armor (base).
    expect(types.has("weapon")).toBe(true);
    expect(types.has("armor")).toBe(true);
  });

  it("attributes are meaningful per category, not random", () => {
    const objects = buildBalanceObjectsFromDomain(sampleMechanicSet);
    // Combat objects have power+speed (not defense).
    const combat = objects.filter((o) => o.derived_from_category === "combat");
    for (const c of combat) {
      expect(c.attributes).toHaveProperty("power");
      expect(c.attributes).toHaveProperty("speed");
    }
    // Base objects have defense+mobility (not power).
    const base = objects.filter((o) => o.derived_from_category === "base");
    for (const b of base) {
      expect(b.attributes).toHaveProperty("defense");
      expect(b.attributes).toHaveProperty("mobility");
    }
  });

  it("dispatcher prefers domain model over legacy hash", () => {
    const domain = buildBalanceObjects(sampleMechanicSet, ["legacy"], sampleRefs);
    const legacy = buildBalanceObjects(null, ["legacy"], sampleRefs);
    // Domain-built objects have richer types than legacy 'mechanic'.
    expect(domain.some((o) => o.type !== "mechanic")).toBe(true);
    expect(legacy.every((o) => o.type === "mechanic")).toBe(true);
  });
});
