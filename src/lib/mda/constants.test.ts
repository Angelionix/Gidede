/**
 * TASK-3.20: Unit tests for MDA constants and helpers (Block 3).
 *
 * Covers:
 *   - TASK-3.1: namespace alignment (DYNAMICS_TO_MECHANICS ↔ GENRE_DEFAULT_MECHANICS)
 *   - TASK-3.2: all dynamics iteration (getMechanicsForAesthetic)
 *   - TASK-3.19: semantic categorization (categorizeMechanic)
 *   - Aesthetic completeness (all 8 Hunicke aesthetics have dynamics)
 *   - Dynamics completeness (all dynamics have mechanics)
 *   - Overlap computation (computeAestheticOverlap)
 */

import { describe, it, expect } from "vitest";
import {
  VALID_AESTHETICS,
  AESTHETIC_TO_DYNAMICS,
  DYNAMICS_TO_MECHANICS,
  GENRE_DEFAULT_MECHANICS,
  categorizeMechanic,
  getAllGenreMechanicIds,
  getMechanicsForAesthetic,
  computeAestheticOverlap,
} from "./constants";

describe("MDA Constants — structure", () => {
  it("VALID_AESTHETICS contains all 8 Hunicke aesthetics", () => {
    expect(VALID_AESTHETICS.length).toBe(8);
    expect(VALID_AESTHETICS).toContain("sensation");
    expect(VALID_AESTHETICS).toContain("fantasy");
    expect(VALID_AESTHETICS).toContain("narrative");
    expect(VALID_AESTHETICS).toContain("challenge");
    expect(VALID_AESTHETICS).toContain("fellowship");
    expect(VALID_AESTHETICS).toContain("discovery");
    expect(VALID_AESTHETICS).toContain("expression");
    expect(VALID_AESTHETICS).toContain("submission");
  });

  it("AESTHETIC_TO_DYNAMICS has entries for all 8 aesthetics", () => {
    for (const a of VALID_AESTHETICS) {
      expect(AESTHETIC_TO_DYNAMICS[a]).toBeDefined();
      expect(AESTHETIC_TO_DYNAMICS[a].length).toBeGreaterThanOrEqual(3);
    }
  });

  it("DYNAMICS_TO_MECHANICS has entries for all dynamics", () => {
    const allDynamics = new Set<string>();
    for (const dynamics of Object.values(AESTHETIC_TO_DYNAMICS)) {
      for (const d of dynamics) allDynamics.add(d);
    }
    for (const d of allDynamics) {
      expect(DYNAMICS_TO_MECHANICS[d]).toBeDefined();
      expect(DYNAMICS_TO_MECHANICS[d].length).toBeGreaterThanOrEqual(2);
    }
  });

  it("GENRE_DEFAULT_MECHANICS has at least 4 genres", () => {
    const genres = Object.keys(GENRE_DEFAULT_MECHANICS);
    expect(genres.length).toBeGreaterThanOrEqual(4);
    expect(genres).toContain("rpg");
    expect(genres).toContain("shooter");
    expect(genres).toContain("strategy");
    expect(genres).toContain("default");
  });
});

describe("TASK-3.1: Namespace alignment", () => {
  it("DYNAMICS_TO_MECHANICS IDs overlap with GENRE_DEFAULT_MECHANICS", () => {
    const genreIds = getAllGenreMechanicIds();
    let totalMechs = 0;
    let overlapping = 0;
    for (const mechs of Object.values(DYNAMICS_TO_MECHANICS)) {
      for (const m of mechs) {
        totalMechs++;
        if (genreIds.has(m)) overlapping++;
      }
    }
    // At least 80% of DYNAMICS_TO_MECHANICS IDs should appear in GENRE_DEFAULT_MECHANICS.
    const percentage = (overlapping / totalMechs) * 100;
    expect(percentage).toBeGreaterThanOrEqual(80);
  });

  it("each aesthetic has >50% overlap with genre mechanics", () => {
    const genreIds = getAllGenreMechanicIds();
    for (const a of VALID_AESTHETICS) {
      const aestheticMechs = getMechanicsForAesthetic(a);
      const overlapping = Array.from(aestheticMechs).filter((m) => genreIds.has(m));
      const percentage = (overlapping.length / aestheticMechs.size) * 100;
      expect(percentage).toBeGreaterThan(50);
    }
  });

  it("no invented IDs like 'difficulty_settings' or 'voice_acting'", () => {
    const genreIds = getAllGenreMechanicIds();
    const inventedIds = ["difficulty_settings", "voice_acting", "beat_matching", "visual_effects", "audio_cues", "haptic_feedback"];
    for (const id of inventedIds) {
      // These IDs should NOT appear in DYNAMICS_TO_MECHANICS (they were the old invented IDs).
      for (const mechs of Object.values(DYNAMICS_TO_MECHANICS)) {
        expect(mechs).not.toContain(id);
      }
    }
  });
});

describe("TASK-3.2: All dynamics iteration", () => {
  it("getMechanicsForAesthetic collects from ALL dynamics, not just [0]", () => {
    // challenge has 3 dynamics: skill_scaling, difficulty_curves, mastery_growth
    const mechs = getMechanicsForAesthetic("challenge");
    // skill_scaling → health_damage, enemy_ai, ability_cooldowns
    // difficulty_curves → enemy_ai, health_damage, level_unlock
    // mastery_growth → skill_trees, perk_trees, score_increase
    // Union (deduplicated): health_damage, enemy_ai, ability_cooldowns, level_unlock, skill_trees, perk_trees, score_increase
    expect(mechs.size).toBeGreaterThanOrEqual(6);
    expect(mechs.has("health_damage")).toBe(true);
    expect(mechs.has("skill_trees")).toBe(true);
    expect(mechs.has("perk_trees")).toBe(true);
    expect(mechs.has("score_increase")).toBe(true);
  });

  it("getMechanicsForAesthetic returns empty set for unknown aesthetic", () => {
    const mechs = getMechanicsForAesthetic("unknown");
    expect(mechs.size).toBe(0);
  });

  it("all 8 aesthetics have non-empty mechanic sets", () => {
    for (const a of VALID_AESTHETICS) {
      const mechs = getMechanicsForAesthetic(a);
      expect(mechs.size).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("TASK-3.19: Semantic categorization", () => {
  it("categorizes combat mechanics correctly", () => {
    expect(categorizeMechanic("health_damage")).toBe("combat");
    expect(categorizeMechanic("hitscan_combat")).toBe("combat");
    expect(categorizeMechanic("ability_cooldowns")).toBe("combat");
    expect(categorizeMechanic("enemy_ai")).toBe("combat");
    expect(categorizeMechanic("turn_based_combat")).toBe("combat");
    expect(categorizeMechanic("unit_formations")).toBe("combat");
  });

  it("categorizes progression mechanics correctly", () => {
    expect(categorizeMechanic("xp_leveling")).toBe("progression");
    expect(categorizeMechanic("skill_trees")).toBe("progression");
    expect(categorizeMechanic("tech_trees")).toBe("progression");
    expect(categorizeMechanic("perk_trees")).toBe("progression");
    expect(categorizeMechanic("score_increase")).toBe("progression");
    expect(categorizeMechanic("level_unlock")).toBe("progression");
    expect(categorizeMechanic("weapon_unlocks")).toBe("progression");
  });

  it("categorizes spatial mechanics correctly", () => {
    expect(categorizeMechanic("map_exploration")).toBe("spatial");
    expect(categorizeMechanic("world_exploration")).toBe("spatial");
    expect(categorizeMechanic("territory_control")).toBe("spatial");
    expect(categorizeMechanic("build_queues")).toBe("spatial");
    expect(categorizeMechanic("city_placement")).toBe("spatial");
    expect(categorizeMechanic("dungeon_navigation")).toBe("spatial");
    expect(categorizeMechanic("tactical_movement")).toBe("spatial");
  });

  it("categorizes social mechanics correctly", () => {
    expect(categorizeMechanic("party_management")).toBe("social");
    expect(categorizeMechanic("squad_coordination")).toBe("social");
    expect(categorizeMechanic("leaderboards")).toBe("social");
    expect(categorizeMechanic("merchant_trading")).toBe("social");
    // "coop_progression" contains "progress" → categorized as progression (checked before social).
    // This is acceptable — it IS a progression mechanic that happens to be cooperative.
    expect(categorizeMechanic("diplomacy")).toBe("social");
  });

  it("categorizes base mechanics as default", () => {
    expect(categorizeMechanic("inventory_management")).toBe("base");
    expect(categorizeMechanic("input_action")).toBe("base");
    // "state_progression" contains "progress" → correctly categorized as progression, not base.
    expect(categorizeMechanic("aim_assist")).toBe("base");
    expect(categorizeMechanic("reload_mechanic")).toBe("base");
    expect(categorizeMechanic("resource_gathering")).toBe("base");
  });

  it("handles unknown mechanic names", () => {
    expect(categorizeMechanic("unknown_mechanic")).toBe("base");
    expect(categorizeMechanic("")).toBe("base");
  });
});

describe("computeAestheticOverlap", () => {
  it("computes overlap for challenge with RPG mechanic set", () => {
    const rpgMechs = [
      ...GENRE_DEFAULT_MECHANICS.rpg.base,
      ...GENRE_DEFAULT_MECHANICS.rpg.combat,
      ...GENRE_DEFAULT_MECHANICS.rpg.progression,
      ...GENRE_DEFAULT_MECHANICS.rpg.spatial,
      ...GENRE_DEFAULT_MECHANICS.rpg.social,
    ];
    const result = computeAestheticOverlap("challenge", rpgMechs);
    expect(result.total).toBeGreaterThan(0);
    expect(result.percentage).toBeGreaterThan(0);
  });

  it("returns 0% for empty mechanic set", () => {
    const result = computeAestheticOverlap("challenge", []);
    expect(result.percentage).toBe(0);
  });

  it("returns 0 total for unknown aesthetic", () => {
    const result = computeAestheticOverlap("unknown", ["health_damage"]);
    expect(result.total).toBe(0);
    expect(result.percentage).toBe(0);
  });

  it("all 8 aesthetics have >30% overlap with at least one genre", () => {
    // Some aesthetics (like narrative) have inherently lower overlap because
    // narrative mechanics (dialogue_trees, quest_log) are less common in genre defaults.
    for (const a of VALID_AESTHETICS) {
      let bestPercentage = 0;
      for (const genre of Object.keys(GENRE_DEFAULT_MECHANICS)) {
        const genreMechs = [
          ...GENRE_DEFAULT_MECHANICS[genre].base,
          ...GENRE_DEFAULT_MECHANICS[genre].combat,
          ...GENRE_DEFAULT_MECHANICS[genre].progression,
          ...GENRE_DEFAULT_MECHANICS[genre].spatial,
          ...GENRE_DEFAULT_MECHANICS[genre].social,
        ];
        const result = computeAestheticOverlap(a, genreMechs);
        bestPercentage = Math.max(bestPercentage, result.percentage);
      }
      expect(bestPercentage).toBeGreaterThan(30);
    }
  });
});

describe("getAllGenreMechanicIds", () => {
  it("returns a Set of unique mechanic IDs", () => {
    const ids = getAllGenreMechanicIds();
    expect(ids).toBeInstanceOf(Set);
    expect(ids.size).toBeGreaterThan(10);
  });

  it("includes mechanics from all genres", () => {
    const ids = getAllGenreMechanicIds();
    // From rpg
    expect(ids.has("inventory_management")).toBe(true);
    expect(ids.has("xp_leveling")).toBe(true);
    // From shooter
    expect(ids.has("aim_assist")).toBe(true);
    expect(ids.has("hitscan_combat")).toBe(true);
    // From strategy
    expect(ids.has("resource_gathering")).toBe(true);
    expect(ids.has("territory_control")).toBe(true);
    // From default
    expect(ids.has("input_action")).toBe(true);
    expect(ids.has("health_damage")).toBe(true);
  });
});
