/**
 * TASK-1.14 + TASK-1.16: Unit tests for MechanicsDB Taxonomy (Levels 0-2).
 */

import { describe, it, expect } from "vitest";
import {
  LEVEL_0_TYPES,
  LEVEL_1_TYPES,
  LEVEL_2_PATTERNS,
  getLevel0Types,
  getLevel1Types,
  getLevel2Patterns,
  getLevel0Type,
  getLevel1Type,
  getLevel2Pattern,
  getLevel2PatternsForLevel0,
  getTaxonomyStats,
  getMechanicHierarchy,
} from "./mechanics-taxonomy";

describe("MechanicsDB Taxonomy — Level 0 (Shell 7)", () => {
  it("contains exactly 7 fundamental types", () => {
    expect(LEVEL_0_TYPES.length).toBe(7);
  });

  it("has all required fields", () => {
    for (const t of LEVEL_0_TYPES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.nameEn).toBeTruthy();
      expect(t.desc).toBeTruthy();
      expect(t.desc.length).toBeGreaterThan(20);
      expect(t.level1Ids.length).toBeGreaterThan(0);
    }
  });

  it("includes Movement, Shooting, Combat, Collection, Building, Talking, Trading", () => {
    const ids = LEVEL_0_TYPES.map((t) => t.id);
    expect(ids).toContain("movement");
    expect(ids).toContain("shooting");
    expect(ids).toContain("combat");
    expect(ids).toContain("collection");
    expect(ids).toContain("building");
    expect(ids).toContain("talking");
    expect(ids).toContain("trading");
  });

  it("each level0 references valid level1 IDs", () => {
    const level1Ids = new Set(LEVEL_1_TYPES.map((t) => t.id));
    for (const t of LEVEL_0_TYPES) {
      for (const l1Id of t.level1Ids) {
        expect(level1Ids.has(l1Id)).toBe(true);
      }
    }
  });
});

describe("MechanicsDB Taxonomy — Level 1 (Adams/Dormans 5)", () => {
  it("contains exactly 5 structural types", () => {
    expect(LEVEL_1_TYPES.length).toBe(5);
  });

  it("includes Space, Objects, Actions, Rules, Skill", () => {
    const ids = LEVEL_1_TYPES.map((t) => t.id);
    expect(ids).toContain("space");
    expect(ids).toContain("objects");
    expect(ids).toContain("actions");
    expect(ids).toContain("rules");
    expect(ids).toContain("skill");
  });

  it("each level1 has reverse reference to level0", () => {
    expect(LEVEL_1_TYPES.every((t) => t.level0Ids.length > 0)).toBe(true);
  });
});

describe("MechanicsDB Taxonomy — Level 2 (16 patterns)", () => {
  it("contains 16+ patterns", () => {
    expect(LEVEL_2_PATTERNS.length).toBeGreaterThanOrEqual(16);
  });

  it("each pattern references valid level0 ID", () => {
    const level0Ids = new Set(LEVEL_0_TYPES.map((t) => t.id));
    for (const p of LEVEL_2_PATTERNS) {
      expect(level0Ids.has(p.level0Id)).toBe(true);
    }
  });

  it("each pattern references at least one MechanicsDB group", () => {
    for (const p of LEVEL_2_PATTERNS) {
      expect(p.mechanicGroups.length).toBeGreaterThan(0);
    }
  });

  it("includes key patterns: free_roam, real_time_combat, crafting_system, dialogue_trees", () => {
    const ids = LEVEL_2_PATTERNS.map((p) => p.id);
    expect(ids).toContain("free_roam");
    expect(ids).toContain("real_time_combat");
    expect(ids).toContain("crafting_system");
    expect(ids).toContain("dialogue_trees");
  });
});

describe("getTaxonomyStats", () => {
  it("returns counts for all 3 levels", () => {
    const stats = getTaxonomyStats();
    expect(stats.level0Count).toBe(7);
    expect(stats.level1Count).toBe(5);
    expect(stats.level2Count).toBeGreaterThanOrEqual(16);
  });
});

describe("getLevel2PatternsForLevel0", () => {
  it("returns patterns for movement", () => {
    const patterns = getLevel2PatternsForLevel0("movement");
    expect(patterns.length).toBeGreaterThanOrEqual(3); // free_roam, linear_progression, tactical_positioning
    expect(patterns.every((p) => p.level0Id === "movement")).toBe(true);
  });

  it("returns empty array for unknown level0", () => {
    expect(getLevel2PatternsForLevel0("unknown")).toEqual([]);
  });
});

describe("getMechanicHierarchy", () => {
  it("returns L0 → L1 → L2 path for known group", () => {
    const h = getMechanicHierarchy("Боевые");
    expect(h.length).toBe(3);
    expect(h[0].level).toBe(0);
    expect(h[1].level).toBe(1);
    expect(h[2].level).toBe(2);
  });

  it("returns path starting with valid Level 0 type for 'Боевые'", () => {
    const h = getMechanicHierarchy("Боевые");
    // Боевые связаны с несколькими паттернами: tactical_positioning (movement),
    // aim_and_shoot (shooting), real_time_combat (combat), bullet_hell (shooting).
    // Берём первый match — проверяем, что это валидный Level 0 ID.
    const level0Ids = h.filter((x) => x.level === 0).map((x) => x.typeId);
    const validLevel0Ids = ["movement", "shooting", "combat", "collection", "building", "talking", "trading"];
    expect(level0Ids.some((id) => validLevel0Ids.includes(id))).toBe(true);
  });

  it("returns empty array for unknown group", () => {
    expect(getMechanicHierarchy("UnknownGroup")).toEqual([]);
  });

  it("returns path for 'Экономика' (collection/trading)", () => {
    const h = getMechanicHierarchy("Экономика");
    expect(h.length).toBe(3);
    // Экономика связана с collection (resource_gathering) или trading (market_trading)
    const level0Ids = h.filter((x) => x.level === 0).map((x) => x.typeId);
    expect(level0Ids.some((id) => ["collection", "trading", "building"].includes(id))).toBe(true);
  });
});

describe("lookup functions", () => {
  it("getLevel0Type returns type by ID", () => {
    expect(getLevel0Type("movement")?.name).toBe("Движение");
    expect(getLevel0Type("unknown")).toBeUndefined();
  });

  it("getLevel1Type returns type by ID", () => {
    expect(getLevel1Type("space")?.name).toBe("Пространство");
    expect(getLevel1Type("unknown")).toBeUndefined();
  });

  it("getLevel2Pattern returns pattern by ID", () => {
    expect(getLevel2Pattern("free_roam")?.name).toBe("Свободное перемещение");
    expect(getLevel2Pattern("unknown")).toBeUndefined();
  });

  it("getLevel0Types returns all 7", () => {
    expect(getLevel0Types().length).toBe(7);
  });

  it("getLevel1Types returns all 5", () => {
    expect(getLevel1Types().length).toBe(5);
  });

  it("getLevel2Patterns returns 16+", () => {
    expect(getLevel2Patterns().length).toBeGreaterThanOrEqual(16);
  });
});
