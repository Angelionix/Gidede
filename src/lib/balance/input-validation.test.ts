/**
 * R5-03: Unit tests for Balance input validation.
 */

import { describe, it, expect } from "vitest";
import {
  validateBalanceObjects,
  findInvalidAttributeValues,
  findDuplicateIds,
  findDuplicateNames,
  findEmptyAttributes,
  type BalanceObjectInput,
} from "./input-validation";

function obj(name: string, attrs: Record<string, unknown> = { power: 30 }, id?: string): BalanceObjectInput {
  return { name, attributes: attrs, ...(id ? { id } : {}) };
}

describe("validateBalanceObjects — basic checks", () => {
  it("rejects fewer than 2 objects", () => {
    const r = validateBalanceObjects([obj("a")]);
    expect(r.valid).toBe(false);
    expect(r.error).toContain("минимум 2");
  });

  it("rejects more than 100 objects", () => {
    const objects = Array.from({ length: 101 }, (_, i) => obj(`o${i}`));
    const r = validateBalanceObjects(objects);
    expect(r.valid).toBe(false);
    expect(r.error).toContain("Максимум 100");
  });

  it("accepts a valid set of 2 objects", () => {
    const r = validateBalanceObjects([
      obj("sword", { power: 30, speed: 5 }),
      obj("shield", { defense: 20, mobility: 3 }),
    ]);
    expect(r.valid).toBe(true);
  });

  it("rejects objects without name", () => {
    const r = validateBalanceObjects([
      obj("", { power: 30 }),
      obj("b", { power: 40 }),
    ]);
    expect(r.valid).toBe(false);
    expect(r.error).toContain("name");
  });
});

describe("validateBalanceObjects — finite numeric attributes", () => {
  it("rejects NaN attribute values", () => {
    const r = validateBalanceObjects([
      obj("a", { power: NaN }),
      obj("b", { power: 40 }),
    ]);
    expect(r.valid).toBe(false);
    expect(r.error).toContain("NaN");
    expect(r.error).toContain("a");
    expect(r.error).toContain("power");
  });

  it("rejects Infinity attribute values", () => {
    const r = validateBalanceObjects([
      obj("a", { power: Infinity }),
      obj("b", { power: 40 }),
    ]);
    expect(r.valid).toBe(false);
    expect(r.error).toContain("Infinity");
  });

  it("rejects -Infinity attribute values", () => {
    const r = validateBalanceObjects([
      obj("a", { power: -Infinity }),
      obj("b", { power: 40 }),
    ]);
    expect(r.valid).toBe(false);
  });

  it("rejects string attribute values", () => {
    const r = validateBalanceObjects([
      obj("a", { power: "30" as unknown as number }),
      obj("b", { power: 40 }),
    ]);
    expect(r.valid).toBe(false);
    expect(r.error).toContain("тип string");
  });

  it("rejects boolean attribute values", () => {
    const r = validateBalanceObjects([
      obj("a", { power: true as unknown as number }),
      obj("b", { power: 40 }),
    ]);
    expect(r.valid).toBe(false);
  });

  it("accepts zero and negative finite numbers", () => {
    const r = validateBalanceObjects([
      obj("a", { power: 0, defense: -10 }),
      obj("b", { power: 40 }),
    ]);
    expect(r.valid).toBe(true);
  });
});

describe("validateBalanceObjects — empty attributes", () => {
  it("rejects objects with empty attributes record", () => {
    const r = validateBalanceObjects([
      obj("a", {}),
      obj("b", { power: 40 }),
    ]);
    expect(r.valid).toBe(false);
    expect(r.error).toContain("без attributes");
    expect(r.error).toContain("a");
  });

  it("rejects objects with undefined attributes", () => {
    const r = validateBalanceObjects([
      { name: "a", attributes: undefined as unknown as Record<string, number> },
      obj("b", { power: 40 }),
    ]);
    expect(r.valid).toBe(false);
  });
});

describe("validateBalanceObjects — duplicate IDs", () => {
  it("rejects duplicate explicit IDs", () => {
    const r = validateBalanceObjects([
      obj("a", { power: 30 }, "weapon_1"),
      obj("b", { power: 40 }, "weapon_1"),
    ]);
    expect(r.valid).toBe(false);
    expect(r.error).toContain("Дубликаты ID");
    expect(r.error).toContain("weapon_1");
    expect(r.duplicateIds).toEqual(["weapon_1"]);
  });

  it("accepts objects without explicit IDs (auto-assigned obj_N)", () => {
    const r = validateBalanceObjects([
      obj("a", { power: 30 }),
      obj("b", { power: 40 }),
    ]);
    expect(r.valid).toBe(true);
  });

  it("rejects when auto-assigned IDs collide with explicit ones", () => {
    // Object 1 gets id "obj_1" explicitly; object 2 has no id → auto "obj_2".
    // But if object 1 has no id → "obj_1", and object 3 has explicit "obj_1" → collision.
    const r = validateBalanceObjects([
      obj("a", { power: 30 }),             // auto id "obj_1"
      obj("b", { power: 40 }),             // auto id "obj_2"
      obj("c", { power: 50 }, "obj_1"),    // explicit id "obj_1" → collision
    ]);
    expect(r.valid).toBe(false);
    expect(r.duplicateIds).toContain("obj_1");
  });
});

describe("validateBalanceObjects — duplicate names", () => {
  it("rejects duplicate names (case-insensitive)", () => {
    const r = validateBalanceObjects([
      obj("Sword", { power: 30 }),
      obj("sword", { power: 40 }),
    ]);
    expect(r.valid).toBe(false);
    expect(r.error).toContain("Дубликаты имён");
  });

  it("rejects duplicate names with whitespace", () => {
    const r = validateBalanceObjects([
      obj("Sword", { power: 30 }),
      obj(" Sword ", { power: 40 }),
    ]);
    expect(r.valid).toBe(false);
  });

  it("accepts unique names", () => {
    const r = validateBalanceObjects([
      obj("sword", { power: 30 }),
      obj("shield", { power: 40 }),
    ]);
    expect(r.valid).toBe(true);
  });
});

describe("findInvalidAttributeValues — helper", () => {
  it("returns empty array for all-finite attributes", () => {
    expect(findInvalidAttributeValues([
      obj("a", { power: 30, speed: 5 }),
      obj("b", { power: 40 }),
    ])).toEqual([]);
  });

  it("finds NaN and string values", () => {
    const invalid = findInvalidAttributeValues([
      obj("a", { power: NaN, range: "5" as unknown as number }),
      obj("b", { power: 40 }),
    ]);
    expect(invalid).toHaveLength(2);
    expect(invalid[0].attr).toBe("power");
    expect(invalid[1].attr).toBe("range");
  });
});

describe("findDuplicateIds — helper", () => {
  it("returns empty array for unique IDs", () => {
    expect(findDuplicateIds([
      obj("a", { power: 30 }, "id1"),
      obj("b", { power: 40 }, "id2"),
    ])).toEqual([]);
  });

  it("finds duplicate explicit IDs", () => {
    expect(findDuplicateIds([
      obj("a", { power: 30 }, "dup"),
      obj("b", { power: 40 }, "dup"),
    ])).toEqual(["dup"]);
  });
});

describe("findDuplicateNames — helper", () => {
  it("is case-insensitive and trims whitespace", () => {
    expect(findDuplicateNames([
      obj(" Sword "),
      obj("sword"),
    ])).toEqual(["sword"]);
  });
});

describe("findEmptyAttributes — helper", () => {
  it("returns indices of objects with empty attributes", () => {
    expect(findEmptyAttributes([
      obj("a", { power: 30 }),
      obj("b", {}),
      obj("c", { power: 40 }),
    ])).toEqual([1]);
  });
});

describe("R5-03 acceptance — strict validation returns 422", () => {
  it("NaN attributes are rejected (would have corrupted transitive power)", () => {
    const r = validateBalanceObjects([
      obj("a", { power: NaN }),
      obj("b", { power: 40 }),
    ]);
    expect(r.valid).toBe(false);
  });

  it("string attributes are rejected", () => {
    const r = validateBalanceObjects([
      obj("a", { power: "high" as unknown as number }),
      obj("b", { power: 40 }),
    ]);
    expect(r.valid).toBe(false);
  });

  it("duplicate IDs are rejected", () => {
    const r = validateBalanceObjects([
      obj("a", { power: 30 }, "weapon"),
      obj("b", { power: 40 }, "weapon"),
    ]);
    expect(r.valid).toBe(false);
  });

  it("a well-formed set passes all checks", () => {
    const r = validateBalanceObjects([
      obj("sword", { power: 30, speed: 5 }, "weapon_1"),
      obj("shield", { defense: 20, mobility: 3 }, "armor_1"),
      obj("bow", { power: 25, range: 8 }, "weapon_2"),
    ]);
    expect(r.valid).toBe(true);
  });
});
