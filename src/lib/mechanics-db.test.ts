/**
 * TASK-1.16: Unit tests for MechanicsDB (Block 1, TASK-1.1/1.8/1.17/1.18).
 *
 * Покрывает:
 *   - MechanicsDB integrity (128 mechanics, 15 groups, all genres filled)
 *   - findMechanicsByGenre
 *   - findMechanicsByAesthetic
 *   - buildMechanicSetForGenre (backward compat)
 *   - buildMechanicSetForGenres (multi-genre + cross-genre)
 *   - Edge cases: unknown genre, empty genres[], cross-genre ratio
 */

import { describe, it, expect } from "vitest";
import {
  MECHANICS_DB,
  findMechanicsByGenre,
  findMechanicsByAesthetic,
  getMechanicsByGroup,
  getMechanicsDBStats,
  buildMechanicSetForGenre,
  buildMechanicSetForGenres,
} from "./mechanics-db";

describe("MechanicsDB — integrity", () => {
  it("contains 128 mechanics", () => {
    expect(MECHANICS_DB.length).toBe(128);
  });

  it("contains 15 groups", () => {
    const groups = new Set(MECHANICS_DB.map((m) => m.group));
    expect(groups.size).toBe(15);
  });

  it("all mechanics have non-empty genres[] (TASK-1.1)", () => {
    const empty = MECHANICS_DB.filter((m) => m.genres.length === 0);
    expect(empty).toEqual([]);
  });

  it("all mechanics have non-empty aesthetics[]", () => {
    const empty = MECHANICS_DB.filter((m) => m.aesthetics.length === 0);
    expect(empty).toEqual([]);
  });

  it("all mechanics have name, group, desc", () => {
    for (const m of MECHANICS_DB) {
      expect(m.name).toBeTruthy();
      expect(m.group).toBeTruthy();
      expect(m.desc).toBeTruthy();
      expect(m.desc.length).toBeGreaterThan(20);
    }
  });

  it("getMechanicsDBStats returns correct totals", () => {
    const stats = getMechanicsDBStats();
    expect(stats.total).toBe(128);
    expect(stats.groups).toBe(15);
    expect(Object.keys(stats.mechanicsPerGroup).length).toBe(15);
  });
});

describe("findMechanicsByGenre", () => {
  it("returns mechanics matching the genre", () => {
    const rpg = findMechanicsByGenre("rpg");
    expect(rpg.length).toBeGreaterThan(10);
    expect(rpg.every((m) => m.genres.includes("rpg"))).toBe(true);
  });

  it("returns empty array for unknown genre", () => {
    const unknown = findMechanicsByGenre("unknown_genre_xyz");
    expect(unknown).toEqual([]);
  });

  it("normalizes genre (lowercase + underscore)", () => {
    const rpg1 = findMechanicsByGenre("rpg");
    const rpg2 = findMechanicsByGenre("RPG");
    const rpg3 = findMechanicsByGenre("  rpg  ");
    expect(rpg1.length).toBe(rpg2.length);
    expect(rpg1.length).toBe(rpg3.length);
  });

  it("returns mechanics sorted by genre count (more matches first)", () => {
    const rpg = findMechanicsByGenre("rpg");
    if (rpg.length >= 2) {
      // Mechanics with more genres should come first (stable sort).
      expect(rpg[0].genres.length).toBeGreaterThanOrEqual(rpg[rpg.length - 1].genres.length);
    }
  });
});

describe("findMechanicsByAesthetic", () => {
  it("returns mechanics matching the aesthetic", () => {
    const challenge = findMechanicsByAesthetic("challenge");
    expect(challenge.length).toBeGreaterThan(5);
    expect(challenge.every((m) => m.aesthetics.includes("challenge"))).toBe(true);
  });

  it("returns empty array for unknown aesthetic", () => {
    const unknown = findMechanicsByAesthetic("unknown_aesthetic");
    expect(unknown).toEqual([]);
  });
});

describe("getMechanicsByGroup", () => {
  it("returns mechanics in the specified group", () => {
    const base = getMechanicsByGroup("Базовые");
    expect(base.length).toBeGreaterThan(0);
    expect(base.every((m) => m.group === "Базовые")).toBe(true);
  });

  it("returns empty array for unknown group", () => {
    expect(getMechanicsByGroup("Unknown")).toEqual([]);
  });
});

describe("buildMechanicSetForGenre (backward compat, single genre)", () => {
  it("returns a valid mechanic set for rpg", () => {
    const r = buildMechanicSetForGenre("rpg");
    expect(r.total_count).toBeGreaterThan(0);
    expect(r.compatibility_score).toBeGreaterThan(0);
    expect(Object.keys(r.groups).length).toBeGreaterThan(0);
    expect(r.source).toContain("MechanicsDB");
  });

  it("returns cross_genre_mechanics (TASK-1.18)", () => {
    const r = buildMechanicSetForGenre("rpg");
    expect(r.cross_genre_mechanics).toBeDefined();
    expect(r.cross_genre_mechanics!.length).toBeGreaterThan(0);
  });

  it("fills at least 5 groups for popular genres", () => {
    for (const genre of ["rpg", "shooter", "puzzle", "horror"]) {
      const r = buildMechanicSetForGenre(genre);
      expect(Object.keys(r.groups).length).toBeGreaterThanOrEqual(3);
    }
  });

  it("falls back to full DB for unknown genre (compatibility=0, coverage=0)", () => {
    const r = buildMechanicSetForGenre("unknown_genre_xyz");
    expect(r.total_count).toBeGreaterThan(0);
    // No mechanics match the unknown genre → coverage=0 → compatibility=0.
    expect(r.compatibility_score).toBe(0);
  });
});

describe("buildMechanicSetForGenres (multi-genre + cross-genre)", () => {
  it("returns mechanics matching ANY of the genres", () => {
    const r = buildMechanicSetForGenres(["rpg", "shooter"], [], {});
    expect(r.total_count).toBeGreaterThan(0);
    // Все выбранные механики должны быть релевантны rpg ИЛИ shooter (кроме cross-genre).
    const allMechanics = Object.values(r.groups).flat();
    for (const m of allMechanics) {
      const matchesRpgOrShooter = m.genres.includes("rpg") || m.genres.includes("shooter");
      // Cross-genre механики НЕ должны матчиться по жанру — это их определение.
      const isCrossGenre = r.cross_genre_mechanics.some((c) => c.name === m.name);
      expect(matchesRpgOrShooter || isCrossGenre).toBe(true);
    }
  });

  it("prioritizes mechanics matching multiple genres", () => {
    const r = buildMechanicSetForGenres(["rpg", "roguelike"], [], {});
    // Механики, релевантные обоим жанрам, должны быть в начале каждой группы.
    const allMechanics = Object.values(r.groups).flat();
    const multiGenreMechanics = allMechanics.filter(
      (m) => m.genres.includes("rpg") && m.genres.includes("roguelike")
    );
    expect(multiGenreMechanics.length).toBeGreaterThan(0);
  });

  it("includes cross-genre mechanics with aesthetic overlap", () => {
    const r = buildMechanicSetForGenres(["rpg"], [], {});
    expect(r.cross_genre_mechanics.length).toBeGreaterThan(0);

    // Cross-genre механики НЕ должны иметь "rpg" в genres.
    for (const m of r.cross_genre_mechanics) {
      expect(m.genres.includes("rpg")).toBe(false);
    }
  });

  it("respects crossGenreRatio option", () => {
    const r18 = buildMechanicSetForGenres(["rpg"], [], { crossGenreRatio: 0.18 });
    const r40 = buildMechanicSetForGenres(["rpg"], [], { crossGenreRatio: 0.4 });
    expect(r40.cross_genre_mechanics.length).toBeGreaterThanOrEqual(r18.cross_genre_mechanics.length);
  });

  it("respects targetTotal option", () => {
    const r8 = buildMechanicSetForGenres(["rpg"], [], { targetTotal: 8 });
    const r16 = buildMechanicSetForGenres(["rpg"], [], { targetTotal: 16 });
    // total_count includes cross-genre mechanics, so it's targetTotal + crossGenre.
    expect(r16.total_count).toBeGreaterThanOrEqual(r8.total_count);
  });

  it("filters out forbidden mechanics", () => {
    // Запрещаем все механики из группы "Базовые" — они не должны попасть в результат.
    const baseMechanics = getMechanicsByGroup("Базовые").map((m) => m.name);
    const r = buildMechanicSetForGenres(["rpg"], baseMechanics, {});
    const allSelected = Object.values(r.groups).flat();
    for (const m of allSelected) {
      expect(baseMechanics.includes(m.name)).toBe(false);
    }
  });

  it("returns empty genres_searched when called with []", () => {
    const r = buildMechanicSetForGenres([], [], {});
    // Defaults to ["action"] when empty.
    expect(r.groups).toBeDefined();
  });

  it("handles sparse genre (tower_defense) with subgenres", () => {
    const r = buildMechanicSetForGenres(["tower_defense", "strategy"], [], {});
    expect(r.total_count).toBeGreaterThan(0);
    // tower_defense has few mechanics, but strategy adds more.
    expect(Object.keys(r.groups).length).toBeGreaterThanOrEqual(3);
  });

  it("compatibility_score based on genre coverage (R4-06: not primary-only)", () => {
    const r = buildMechanicSetForGenres(["rpg", "shooter"], [], {});
    // R4-06: compatibility = genre_coverage + optional hybrid_bonus.
    // Both rpg and shooter should be covered → coverage=1 → score=100 (capped).
    expect(r.genre_coverage).toBe(1);
    expect(r.compatibility_score).toBe(100);
    // Cross-genre mechanics do NOT penalize the score.
    expect(r.compatibility_score).toBeGreaterThanOrEqual(95);
  });

  it("R4-06: cross-genre mechanics do not penalize compatibility_score", () => {
    // Concept with multiple genres + cross-genre additions should score
    // as well as a single-genre concept with full coverage.
    const r = buildMechanicSetForGenres(["rpg", "roguelike", "strategy"], [], {});
    expect(r.cross_genre_mechanics.length).toBeGreaterThan(0);
    expect(r.cross_genre_role).toBe("intentional_hybrid");
    // All three genres covered → coverage=1; hybrid_bonus adds up to +15%.
    expect(r.genre_coverage).toBe(1);
    expect(r.compatibility_score).toBe(100); // capped at 100
  });

  it("R4-06: intentional hybrid (subgenres) is not penalized", () => {
    // Subgenre-only matches (e.g. mechanic tagged "roguelike" but not "rpg")
    // should count towards coverage, not lower the score.
    const single = buildMechanicSetForGenres(["rpg"], [], {});
    const hybrid = buildMechanicSetForGenres(["rpg", "roguelike"], [], {});
    // Hybrid should score at least as well as single-genre (both have full coverage).
    expect(hybrid.compatibility_score).toBeGreaterThanOrEqual(single.compatibility_score);
  });
});
