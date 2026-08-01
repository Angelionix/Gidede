/**
 * TASK-1.16: Unit tests for validateConceptInput (Block 1, TASK-1.15).
 *
 * Покрывает:
 *   - idea validation (10-2000 символов)
 *   - genre validation (known list + aliases)
 *   - subgenres validation (known list + aliases + dedup + max 3)
 *   - forbidden_mechanics (max 20, lowercase normalization)
 *   - target_audience, platforms, constraints, reference_games (optional)
 *   - use_ai flag
 *   - Edge cases: empty body, non-object body, missing idea
 */

import { describe, it, expect } from "vitest";
import { validateConceptInput, normalizeGenre, isValidGenre, KNOWN_GENRES } from "./validation-input";

describe("normalizeGenre", () => {
  it("normalizes aliases to canonical genres", () => {
    expect(normalizeGenre("shooting")).toBe("shooter");
    expect(normalizeGenre("FPS")).toBe("shooter");
    expect(normalizeGenre("tower defense")).toBe("tower_defense");
    expect(normalizeGenre("TD")).toBe("tower_defense");
    expect(normalizeGenre("MMO")).toBe("mmorpg");
    expect(normalizeGenre("deck builder")).toBe("roguelike");
    expect(normalizeGenre("role-playing")).toBe("rpg");
  });

  it("passes through canonical genres unchanged", () => {
    expect(normalizeGenre("rpg")).toBe("rpg");
    expect(normalizeGenre("shooter")).toBe("shooter");
    expect(normalizeGenre("tower_defense")).toBe("tower_defense");
  });

  it("handles whitespace and case", () => {
    expect(normalizeGenre("  Tower Defense  ")).toBe("tower_defense");
    expect(normalizeGenre("RPG")).toBe("rpg");
  });

  it("passes through unknown genres as lowercase", () => {
    expect(normalizeGenre("UnknownGenre")).toBe("unknowngenre");
  });
});

describe("isValidGenre", () => {
  it("returns true for known genres", () => {
    expect(isValidGenre("rpg")).toBe(true);
    expect(isValidGenre("shooter")).toBe(true);
    expect(isValidGenre("tower_defense")).toBe(true);
  });

  it("returns true for known aliases", () => {
    expect(isValidGenre("shooting")).toBe(true); // → shooter
    expect(isValidGenre("fps")).toBe(true); // → shooter
    expect(isValidGenre("td")).toBe(true); // → tower_defense
  });

  it("returns false for unknown genres", () => {
    expect(isValidGenre("unknown")).toBe(false);
    expect(isValidGenre("foobar")).toBe(false);
  });
});

describe("validateConceptInput — idea", () => {
  it("rejects empty body", () => {
    const r = validateConceptInput(null);
    expect(r.valid).toBe(false);
    expect(r.error).toContain("объектом");
  });

  it("rejects non-object body", () => {
    const r = validateConceptInput("string");
    expect(r.valid).toBe(false);
  });

  it("rejects missing idea", () => {
    const r = validateConceptInput({ genre: "rpg" });
    expect(r.valid).toBe(false);
    expect(r.error).toContain("'idea' обязательно");
  });

  it("rejects idea shorter than 10 chars", () => {
    const r = validateConceptInput({ idea: "short" });
    expect(r.valid).toBe(false);
    expect(r.error).toContain("не менее 10 символов");
  });

  it("rejects idea longer than 2000 chars", () => {
    const r = validateConceptInput({ idea: "a".repeat(2001) });
    expect(r.valid).toBe(false);
    expect(r.error).toContain("не более 2000 символов");
  });

  it("accepts idea with exactly 10 chars", () => {
    const r = validateConceptInput({ idea: "1234567890" });
    expect(r.valid).toBe(true);
    expect(r.idea).toBe("1234567890");
  });

  it("accepts idea with exactly 2000 chars", () => {
    const r = validateConceptInput({ idea: "a".repeat(2000) });
    expect(r.valid).toBe(true);
  });

  it("trims whitespace around idea", () => {
    const r = validateConceptInput({ idea: "  Build a castle  " });
    expect(r.valid).toBe(true);
    expect(r.idea).toBe("Build a castle");
  });
});

describe("validateConceptInput — genre", () => {
  it("accepts known genre", () => {
    const r = validateConceptInput({ idea: "Build a castle", genre: "rpg" });
    expect(r.valid).toBe(true);
    expect(r.genre).toBe("rpg");
  });

  it("accepts genre alias and normalizes it", () => {
    const r = validateConceptInput({ idea: "Build a castle", genre: "shooting" });
    expect(r.valid).toBe(true);
    expect(r.genre).toBe("shooter");
  });

  it("rejects unknown genre", () => {
    const r = validateConceptInput({ idea: "Build a castle", genre: "unknown_genre" });
    expect(r.valid).toBe(false);
    expect(r.error).toContain("Неизвестный жанр");
  });

  it("accepts null/missing genre (auto-inference)", () => {
    const r = validateConceptInput({ idea: "Build a castle" });
    expect(r.valid).toBe(true);
    expect(r.genre).toBeNull();
  });

  it("accepts empty string genre (treated as missing)", () => {
    const r = validateConceptInput({ idea: "Build a castle", genre: "  " });
    expect(r.valid).toBe(true);
    expect(r.genre).toBeNull();
  });
});

describe("validateConceptInput — subgenres", () => {
  it("accepts known subgenres", () => {
    const r = validateConceptInput({ idea: "Build a castle", subgenres: ["rpg", "roguelike"] });
    expect(r.valid).toBe(true);
    expect(r.subgenres).toEqual(["rpg", "roguelike"]);
  });

  it("normalizes subgenre aliases", () => {
    const r = validateConceptInput({ idea: "Build a castle", subgenres: ["shooting", "td"] });
    expect(r.valid).toBe(true);
    expect(r.subgenres).toEqual(["shooter", "tower_defense"]);
  });

  it("deduplicates subgenres after normalization", () => {
    const r = validateConceptInput({ idea: "Build a castle", subgenres: ["shooting", "shooter", "fps"] });
    expect(r.valid).toBe(true);
    // All three normalize to "shooter" → deduped to 1.
    expect(r.subgenres).toEqual(["shooter"]);
  });

  it("limits to max 3 subgenres", () => {
    const r = validateConceptInput({
      idea: "Build a castle",
      subgenres: ["rpg", "shooter", "puzzle", "strategy", "horror"],
    });
    expect(r.valid).toBe(true);
    expect(r.subgenres!.length).toBe(3);
  });

  it("filters out invalid subgenres (doesn't fail)", () => {
    const r = validateConceptInput({
      idea: "Build a castle",
      subgenres: ["rpg", "unknown_genre", "roguelike"],
    });
    expect(r.valid).toBe(true);
    expect(r.subgenres).toEqual(["rpg", "roguelike"]);
  });

  it("handles empty subgenres array", () => {
    const r = validateConceptInput({ idea: "Build a castle", subgenres: [] });
    expect(r.valid).toBe(true);
    expect(r.subgenres).toEqual([]);
  });
});

describe("validateConceptInput — forbidden_mechanics", () => {
  it("accepts forbidden mechanics and lowercases them", () => {
    const r = validateConceptInput({
      idea: "Build a castle",
      forbidden_mechanics: ["Combat", "Stealth"],
    });
    expect(r.valid).toBe(true);
    expect(r.forbiddenMechanics).toEqual(["combat", "stealth"]);
  });

  it("filters out empty strings", () => {
    const r = validateConceptInput({
      idea: "Build a castle",
      forbidden_mechanics: ["Combat", "", "  ", "Stealth"],
    });
    expect(r.valid).toBe(true);
    expect(r.forbiddenMechanics).toEqual(["combat", "stealth"]);
  });

  it("limits to max 20 forbidden mechanics", () => {
    const mechanics = Array.from({ length: 25 }, (_, i) => `mech${i}`);
    const r = validateConceptInput({ idea: "Build a castle", forbidden_mechanics: mechanics });
    expect(r.valid).toBe(true);
    expect(r.forbiddenMechanics!.length).toBe(20);
  });

  it("defaults to empty array when not provided", () => {
    const r = validateConceptInput({ idea: "Build a castle" });
    expect(r.valid).toBe(true);
    expect(r.forbiddenMechanics).toEqual([]);
  });
});

describe("validateConceptInput — optional fields", () => {
  it("accepts target_audience", () => {
    const r = validateConceptInput({
      idea: "Build a castle",
      target_audience: { primary: ["challenge", "fantasy"], experience: "hardcore" },
    });
    expect(r.valid).toBe(true);
    expect(r.target_audience?.primary).toEqual(["challenge", "fantasy"]);
    expect(r.target_audience?.experience).toBe("hardcore");
  });

  it("accepts platforms array", () => {
    const r = validateConceptInput({
      idea: "Build a castle",
      platform: ["PC", "Mobile"],
    });
    expect(r.valid).toBe(true);
    expect(r.platform).toEqual(["pc", "mobile"]);
  });

  it("accepts constraints", () => {
    const r = validateConceptInput({
      idea: "Build a castle",
      constraints: { team_size: 5, budget: "medium" },
    });
    expect(r.valid).toBe(true);
    expect(r.constraints?.team_size).toBe(5);
    expect(r.constraints?.budget).toBe("medium");
  });

  it("rejects invalid team_size (negative or non-integer)", () => {
    const r = validateConceptInput({
      idea: "Build a castle",
      constraints: { team_size: -5 },
    });
    expect(r.valid).toBe(true);
    expect(r.constraints?.team_size).toBeUndefined();
  });

  it("accepts reference_games", () => {
    const r = validateConceptInput({
      idea: "Build a castle",
      reference_games: ["Dark Souls", "Hollow Knight"],
    });
    expect(r.valid).toBe(true);
    expect(r.reference_games).toEqual(["Dark Souls", "Hollow Knight"]);
  });

  it("accepts use_ai boolean", () => {
    const r = validateConceptInput({ idea: "Build a castle", use_ai: true });
    expect(r.valid).toBe(true);
    expect(r.use_ai).toBe(true);
  });

  it("accepts use_ai string 'true'", () => {
    const r = validateConceptInput({ idea: "Build a castle", use_ai: "true" });
    expect(r.valid).toBe(true);
    expect(r.use_ai).toBe(true);
  });

  it("defaults use_ai to false", () => {
    const r = validateConceptInput({ idea: "Build a castle" });
    expect(r.valid).toBe(true);
    expect(r.use_ai).toBe(false);
  });

  it("accepts project_id", () => {
    const r = validateConceptInput({ idea: "Build a castle", project_id: "  proj-123  " });
    expect(r.valid).toBe(true);
    expect(r.project_id).toBe("proj-123");
  });
});

describe("validateConceptInput — integration scenarios", () => {
  it("validates a complete valid request", () => {
    const r = validateConceptInput({
      idea: "Build a castle and survive the night against endless waves",
      genre: "rpg",
      subgenres: ["roguelike", "strategy"],
      forbidden_mechanics: [" permadeath"],
      target_audience: { primary: ["challenge"], experience: "hardcore" },
      platform: ["PC"],
      constraints: { team_size: 3, budget: "small" },
      reference_games: ["Dark Souls"],
      use_ai: true,
      project_id: "proj-123",
    });
    expect(r.valid).toBe(true);
    expect(r.idea).toBe("Build a castle and survive the night against endless waves");
    expect(r.genre).toBe("rpg");
    expect(r.subgenres).toEqual(["roguelike", "strategy"]);
    expect(r.forbiddenMechanics).toEqual(["permadeath"]);
    expect(r.use_ai).toBe(true);
    expect(r.project_id).toBe("proj-123");
  });

  it("validates minimal request (only idea)", () => {
    const r = validateConceptInput({ idea: "Build a castle" });
    expect(r.valid).toBe(true);
    expect(r.idea).toBe("Build a castle");
    expect(r.genre).toBeNull();
    expect(r.subgenres).toEqual([]);
    expect(r.forbiddenMechanics).toEqual([]);
    expect(r.use_ai).toBe(false);
  });
});
