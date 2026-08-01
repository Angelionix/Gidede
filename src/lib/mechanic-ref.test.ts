/**
 * R4-07: Unit tests for the unified mechanic namespace module.
 *
 * Covers:
 *   - slugifyMechanicId: transliteration, slugification, edge cases.
 *   - categoryOfGroup: MechanicsDB group → canonical category.
 *   - categoryOfName: keyword regex fallback for non-DB mechanics.
 *   - toMechanicRef / refFromName / coerceToMechanicRef: conversion.
 *   - Determinism: same input → same id.
 *   - Uniqueness: different names → different ids.
 */

import { describe, it, expect } from "vitest";
import {
  slugifyMechanicId,
  categoryOfGroup,
  categoryOfName,
  toMechanicRef,
  refFromName,
  coerceToMechanicRef,
  mechanicIdOf,
} from "./mechanic-ref";
import type { Mechanic } from "@/lib/mechanics-db";

describe("slugifyMechanicId — transliteration", () => {
  it("transliterates Russian names to ASCII snake_case", () => {
    expect(slugifyMechanicId("Изучение мира")).toBe("izuchenie_mira");
    expect(slugifyMechanicId("Броня")).toBe("bronya");
    expect(slugifyMechanicId("Очки опыта")).toBe("ochki_opyta");
    expect(slugifyMechanicId("Достижения и очки")).toBe("dostizheniya_i_ochki");
  });

  it("handles ё → e folding", () => {
    expect(slugifyMechanicId("Счёт")).toBe("schet");
  });

  it("handles mixed Russian/English input", () => {
    expect(slugifyMechanicId("Combat бой")).toBe("combat_boy");
  });

  it("passes through pure English names", () => {
    expect(slugifyMechanicId("World Exploration")).toBe("world_exploration");
    expect(slugifyMechanicId("health_damage")).toBe("health_damage");
  });

  it("collapses multiple separators", () => {
    expect(slugifyMechanicId("A  B - C / D")).toBe("a_b_c_d");
  });

  it("trims leading/trailing underscores", () => {
    expect(slugifyMechanicId(" Изучение ")).toBe("izuchenie");
  });

  it("returns 'mechanic' for empty/whitespace input", () => {
    expect(slugifyMechanicId("")).toBe("mechanic");
    expect(slugifyMechanicId("   ")).toBe("mechanic");
  });

  it("drops punctuation (commas, dots, parentheses)", () => {
    expect(slugifyMechanicId("Очки (опыт), т.д.")).toBe("ochki_opyt_td");
  });

  it("is deterministic: same input always produces same output", () => {
    const a = slugifyMechanicId("Изучение мира");
    const b = slugifyMechanicId("Изучение мира");
    expect(a).toBe(b);
  });
});

describe("categoryOfGroup — MechanicsDB group → canonical category", () => {
  it("maps all 15 MechanicsDB groups correctly", () => {
    expect(categoryOfGroup("Базовые")).toBe("base");
    expect(categoryOfGroup("Боевые")).toBe("combat");
    expect(categoryOfGroup("Прогрессия")).toBe("progression");
    expect(categoryOfGroup("Пространство")).toBe("spatial");
    expect(categoryOfGroup("Экономика")).toBe("social");
    expect(categoryOfGroup("Движение")).toBe("spatial");
    expect(categoryOfGroup("Социальные")).toBe("social");
    expect(categoryOfGroup("Выживание")).toBe("base");
    expect(categoryOfGroup("Стелс")).toBe("combat");
    expect(categoryOfGroup("Навыки")).toBe("progression");
    expect(categoryOfGroup("Время")).toBe("base");
    expect(categoryOfGroup("Территория")).toBe("spatial");
    expect(categoryOfGroup("Сюжет")).toBe("social");
    expect(categoryOfGroup("Информация")).toBe("base");
    expect(categoryOfGroup("Мета")).toBe("progression");
  });

  it("falls back to 'base' for unknown groups", () => {
    expect(categoryOfGroup("Unknown")).toBe("base");
    expect(categoryOfGroup("")).toBe("base");
  });
});

describe("categoryOfName — keyword regex fallback", () => {
  it("categorises progression keywords", () => {
    expect(categoryOfName("xp_leveling")).toBe("progression");
    expect(categoryOfName("skill_trees")).toBe("progression");
    expect(categoryOfName("tech_trees")).toBe("progression");
    expect(categoryOfName("perk_trees")).toBe("progression");
    expect(categoryOfName("score_increase")).toBe("progression");
    expect(categoryOfName("level_unlock")).toBe("progression");
  });

  it("categorises combat keywords", () => {
    expect(categoryOfName("health_damage")).toBe("combat");
    expect(categoryOfName("enemy_ai")).toBe("combat");
    expect(categoryOfName("turn_based_combat")).toBe("combat");
    expect(categoryOfName("hitscan_combat")).toBe("combat");
  });

  it("categorises spatial keywords", () => {
    expect(categoryOfName("world_exploration")).toBe("spatial");
    expect(categoryOfName("map_exploration")).toBe("spatial");
    expect(categoryOfName("territory_control")).toBe("spatial");
    expect(categoryOfName("dungeon_navigation")).toBe("spatial");
  });

  it("categorises social keywords", () => {
    expect(categoryOfName("party_management")).toBe("social");
    expect(categoryOfName("merchant_trading")).toBe("social");
    expect(categoryOfName("squad_coordination")).toBe("social");
    expect(categoryOfName("leaderboards")).toBe("social");
  });

  it("falls back to 'base' for unmatched names", () => {
    expect(categoryOfName("inventory_management")).toBe("base");
    expect(categoryOfName("input_action")).toBe("base");
    expect(categoryOfName("dialogue_trees")).toBe("base"); // no keyword match
  });
});

describe("toMechanicRef — MechanicsDB Mechanic → MechanicRef", () => {
  const mechanic: Mechanic = {
    group: "Базовые",
    name: "Изучение мира",
    desc: "Игрок исследует игровое пространство.",
    aesthetics: ["discovery", "fantasy", "sensation"],
    genres: ["adventure", "rpg"],
  };

  it("generates stable id from name", () => {
    const ref = toMechanicRef(mechanic);
    expect(ref.id).toBe("izuchenie_mira");
    expect(ref.name).toBe("Изучение мира");
    expect(ref.group).toBe("Базовые");
    expect(ref.category).toBe("base");
    expect(ref.source).toBe("mechanics_db");
  });

  it("respects explicit source override", () => {
    const ref = toMechanicRef(mechanic, "request");
    expect(ref.source).toBe("request");
  });

  it("category comes from group, not name regex", () => {
    // "Боевые" → combat, even though the name has no combat keyword.
    const combatMechanic: Mechanic = {
      ...mechanic,
      group: "Боевые",
      name: "Какая-то механика",
    };
    const ref = toMechanicRef(combatMechanic);
    expect(ref.category).toBe("combat");
  });

  it("is deterministic across repeated calls", () => {
    const a = toMechanicRef(mechanic);
    const b = toMechanicRef(mechanic);
    expect(a).toEqual(b);
  });
});

describe("refFromName — raw name → MechanicRef (no group)", () => {
  it("generates id and category from name alone", () => {
    const ref = refFromName("health_damage", "dynamics_to_mechanics");
    expect(ref.id).toBe("health_damage");
    expect(ref.name).toBe("health_damage");
    expect(ref.group).toBe("");
    expect(ref.category).toBe("combat");
    expect(ref.source).toBe("dynamics_to_mechanics");
  });

  it("falls back to 'base' category for unknown names", () => {
    const ref = refFromName("unknown_mechanic", "genre_default");
    expect(ref.category).toBe("base");
    expect(ref.source).toBe("genre_default");
  });
});

describe("coerceToMechanicRef — heterogeneous input coercion", () => {
  it("coerces a string to a ref", () => {
    const ref = coerceToMechanicRef("Изучение мира", "request");
    expect(ref).not.toBeNull();
    expect(ref!.id).toBe("izuchenie_mira");
    expect(ref!.name).toBe("Изучение мира");
    expect(ref!.source).toBe("request");
  });

  it("passes through an existing MechanicRef", () => {
    const existing = {
      id: "world_exploration",
      name: "World Exploration",
      group: "",
      category: "spatial",
      source: "dynamics_to_mechanics",
    };
    const ref = coerceToMechanicRef(existing, "request");
    expect(ref).toEqual(existing);
  });

  it("coerces a {name, group} object (MechanicsDB entry shape)", () => {
    const entry = { name: "Изучение мира", group: "Базовые" };
    const ref = coerceToMechanicRef(entry, "mechanics_db");
    expect(ref).not.toBeNull();
    expect(ref!.id).toBe("izuchenie_mira");
    expect(ref!.name).toBe("Изучение мира");
    expect(ref!.group).toBe("Базовые");
    expect(ref!.category).toBe("base");
  });

  it("coerces a {name} object without group (falls back to name regex)", () => {
    const entry = { name: "health_damage" };
    const ref = coerceToMechanicRef(entry, "dynamics_to_mechanics");
    expect(ref).not.toBeNull();
    expect(ref!.category).toBe("combat");
  });

  it("coerces a {id, name} object (uses explicit id)", () => {
    const entry = { id: "custom_id", name: "Some Mechanic" };
    const ref = coerceToMechanicRef(entry, "request");
    expect(ref).not.toBeNull();
    expect(ref!.id).toBe("custom_id");
  });

  it("returns null for falsy input", () => {
    expect(coerceToMechanicRef(null, "request")).toBeNull();
    expect(coerceToMechanicRef(undefined, "request")).toBeNull();
    expect(coerceToMechanicRef("", "request")).toBeNull();
  });

  it("returns null for non-object, non-string input", () => {
    expect(coerceToMechanicRef(42, "request")).toBeNull();
    expect(coerceToMechanicRef([], "request")).toBeNull();
  });
});

describe("mechanicIdOf — stable id extraction", () => {
  it("extracts id from a string (slugifies)", () => {
    expect(mechanicIdOf("Изучение мира")).toBe("izuchenie_mira");
  });

  it("extracts explicit id from an object", () => {
    expect(mechanicIdOf({ id: "world_exploration", name: "World Exploration" }))
      .toBe("world_exploration");
  });

  it("slugifies name when id is absent", () => {
    expect(mechanicIdOf({ name: "Изучение мира" })).toBe("izuchenie_mira");
  });

  it("returns '' for falsy input", () => {
    expect(mechanicIdOf(null)).toBe("");
    expect(mechanicIdOf(undefined)).toBe("");
    expect(mechanicIdOf("")).toBe("");
  });
});

describe("R4-07 acceptance: unified namespace properties", () => {
  it("different MechanicsDB mechanics get different stable ids", () => {
    const m1: Mechanic = { group: "Базовые", name: "Изучение мира", desc: "", aesthetics: [], genres: [] };
    const m2: Mechanic = { group: "Боевые", name: "Броня", desc: "", aesthetics: [], genres: [] };
    const r1 = toMechanicRef(m1);
    const r2 = toMechanicRef(m2);
    expect(r1.id).not.toBe(r2.id);
    expect(r1.category).not.toBe(r2.category);
  });

  it("the same mechanic name always produces the same id regardless of source", () => {
    const fromDb = toMechanicRef(
      { group: "Базовые", name: "Изучение мира", desc: "", aesthetics: [], genres: [] },
      "mechanics_db",
    );
    const fromRequest = refFromName("Изучение мира", "request");
    expect(fromDb.id).toBe(fromRequest.id);
  });

  it("MechanicsDB group-based category is more reliable than name regex", () => {
    // A Russian name "Броня" has no English keyword, so name regex returns "base".
    // But its MechanicsDB group "Боевые" correctly maps to "combat".
    expect(categoryOfName("Броня")).toBe("base"); // name regex fails on Cyrillic
    expect(categoryOfGroup("Боевые")).toBe("combat"); // group lookup is correct
    // toMechanicRef uses group, so it gets the correct category.
    const ref = toMechanicRef(
      { group: "Боевые", name: "Броня", desc: "", aesthetics: [], genres: [] },
    );
    expect(ref.category).toBe("combat"); // NOT "base" — this is the R4-07 fix
  });
});
