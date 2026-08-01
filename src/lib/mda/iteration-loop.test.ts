/**
 * R4-08: Unit tests for the MDA iteration loop.
 *
 * Covers:
 *   - evaluateMdaPass: single-pass evaluation correctness.
 *   - runMdaIterationLoop: real iterations change the candidate set and save diffs.
 *   - Convergence: loop stops when overall_match >= threshold.
 *   - Termination reasons: already_converged, converged, max_iterations, no_candidates.
 *   - iterations_done reflects the real number of passes.
 *   - Each iteration adds a mechanic and records a diff with before/after scores.
 *   - Determinism.
 */

import { describe, it, expect } from "vitest";
import {
  evaluateMdaPass,
  runMdaIterationLoop,
  type MechanicSetForMda,
} from "./iteration-loop";

const emptySet: MechanicSetForMda = {
  base: [], combat: [], progression: [], spatial: [], social: [],
};

const rpgAesthetics = { primary: "challenge", secondary: "fantasy", tertiary: "discovery" };

function setWith(...mechanics: string[]): MechanicSetForMda {
  // Categorize each mechanic into its bucket.
  const set: MechanicSetForMda = { base: [], combat: [], progression: [], spatial: [], social: [] };
  for (const m of mechanics) {
    const lower = m.toLowerCase();
    let cat: keyof MechanicSetForMda = "base";
    if (/combat|fight|attack|damage|enemy|health|hitscan|projectile|ability_cooldown/.test(lower)) cat = "combat";
    else if (/xp|level|skill|upgrade|progress|tech|perk|score|unlock|quest|cutscene/.test(lower)) cat = "progression";
    else if (/map|explore|world|navigate|territory|build|city|tactical|dungeon/.test(lower)) cat = "spatial";
    else if (/party|guild|social|trade|diplomacy|leaderboard|squad|coop|merchant/.test(lower)) cat = "social";
    set[cat].push({ mechanic_name: m });
  }
  return set;
}

describe("evaluateMdaPass — single-pass evaluation", () => {
  it("returns zero overall_match for an empty mechanic set", () => {
    const r = evaluateMdaPass(emptySet, rpgAesthetics);
    expect(r.overall_match).toBe(0);
    expect(r.converged).toBe(false);
  });

  it("returns higher overall_match when target-aesthetic mechanics are present", () => {
    const empty = evaluateMdaPass(emptySet, rpgAesthetics);
    // challenge dynamics: skill_scaling, difficulty_curves, mastery_growth
    // → mechanics: health_damage, enemy_ai, ability_cooldowns, skill_trees, perk_trees, score_increase, level_unlock
    const withChallenge = evaluateMdaPass(
      setWith("health_damage", "enemy_ai", "skill_trees"),
      rpgAesthetics,
    );
    expect(withChallenge.overall_match).toBeGreaterThan(empty.overall_match);
  });

  it("predicted_aesthetics is in [0, 1] for all 8 aesthetics", () => {
    const r = evaluateMdaPass(setWith("health_damage", "world_exploration"), rpgAesthetics);
    for (const a of Object.values(r.predicted_aesthetics)) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
    }
  });

  it("is deterministic: same input → same output", () => {
    const a = evaluateMdaPass(setWith("health_damage"), rpgAesthetics);
    const b = evaluateMdaPass(setWith("health_damage"), rpgAesthetics);
    expect(a).toEqual(b);
  });
});

describe("runMdaIterationLoop — real iteration loop", () => {
  it("returns iterations=1 when already converged on first pass", () => {
    // Fill the set with enough challenge + fantasy mechanics to converge at threshold 0.
    const fullSet = setWith(
      "health_damage", "enemy_ai", "ability_cooldowns", "skill_trees", "perk_trees",
      "dialogue_trees", "party_management", "equipment_upgrade", "world_exploration",
    );
    const r = runMdaIterationLoop(fullSet, rpgAesthetics, 0.0, 5);
    expect(r.iterations).toBe(1);
    expect(r.converged).toBe(true);
    expect(r.termination_reason).toBe("already_converged");
    expect(r.iteration_diffs).toHaveLength(1);
    expect(r.iteration_diffs[0].added_mechanic).toBeNull();
  });

  it("performs real iterations when not converged, adding mechanics and saving diffs", () => {
    // Start with an empty set and a high threshold — loop must add mechanics.
    const r = runMdaIterationLoop(emptySet, rpgAesthetics, 0.5, 5);
    expect(r.iterations).toBeGreaterThan(1);
    expect(r.iteration_diffs.length).toBeGreaterThan(0);
    // Each diff should record a mechanic that was added.
    for (const diff of r.iteration_diffs) {
      expect(diff.added_mechanic).not.toBeNull();
      expect(diff.added_to_category).not.toBeNull();
      expect(diff.target_aesthetic).not.toBeNull();
      expect(typeof diff.overall_match_before).toBe("number");
      expect(typeof diff.overall_match_after).toBe("number");
    }
    // The final set should have more mechanics than the initial empty set.
    const finalMechCount = r.final_mechanic_set.base.length
      + r.final_mechanic_set.combat.length
      + r.final_mechanic_set.progression.length
      + r.final_mechanic_set.spatial.length
      + r.final_mechanic_set.social.length;
    expect(finalMechCount).toBeGreaterThan(0);
  });

  it("iterations_done reflects the real number of passes (not a hardcoded 3)", () => {
    const r = runMdaIterationLoop(emptySet, rpgAesthetics, 0.3, 4);
    // iterations should be between 1 and 4 (maxIterations).
    expect(r.iterations).toBeGreaterThanOrEqual(1);
    expect(r.iterations).toBeLessThanOrEqual(4);
    // iterations should equal 1 (initial pass) + number of diffs.
    expect(r.iterations).toBe(1 + r.iteration_diffs.length);
  });

  it("stops at max_iterations when convergence is not reached", () => {
    // Use a threshold of 1.0 (impossible to reach) and maxIterations=3.
    const r = runMdaIterationLoop(emptySet, rpgAesthetics, 1.0, 3);
    expect(r.iterations).toBe(3);
    expect(r.converged).toBe(false);
    expect(r.termination_reason).toBe("max_iterations");
    expect(r.iteration_diffs).toHaveLength(2); // 3 iterations - 1 initial = 2 diffs
  });

  it("stops with no_candidates when all target-aesthetic mechanics are already in the set", () => {
    // Fill the set with ALL mechanics from challenge + fantasy + discovery dynamics.
    const allMechs = new Set<string>();
    for (const a of ["challenge", "fantasy", "discovery"]) {
      for (const dyn of (AESTHETIC_TO_DYNAMICS as Record<string, string[]>)[a] || []) {
        for (const m of (DYNAMICS_TO_MECHANICS as Record<string, string[]>)[dyn] || []) {
          allMechs.add(m);
        }
      }
    }
    const fullSet = setWith(...allMechs);
    // With a threshold of 1.0, the loop can't converge and can't add more
    // mechanics → terminates with no_candidates.
    const r = runMdaIterationLoop(fullSet, rpgAesthetics, 1.0, 5);
    expect(r.termination_reason).toBe("no_candidates");
    expect(r.iteration_diffs).toHaveLength(0);
  });

  it("each iteration adds a DIFFERENT mechanic (no duplicates)", () => {
    const r = runMdaIterationLoop(emptySet, rpgAesthetics, 0.8, 5);
    const addedMechanics = r.iteration_diffs
      .map((d) => d.added_mechanic)
      .filter((m): m is string => m !== null);
    const unique = new Set(addedMechanics);
    expect(unique.size).toBe(addedMechanics.length);
  });

  it("overall_match improves or stays the same across iterations (never decreases)", () => {
    const r = runMdaIterationLoop(emptySet, rpgAesthetics, 0.5, 5);
    for (const diff of r.iteration_diffs) {
      expect(diff.overall_match_after).toBeGreaterThanOrEqual(diff.overall_match_before);
    }
  });

  it("does not mutate the input mechanic set", () => {
    const input = setWith("health_damage");
    const inputCopy = JSON.parse(JSON.stringify(input));
    runMdaIterationLoop(input, rpgAesthetics, 0.8, 5);
    expect(input).toEqual(inputCopy);
  });

  it("final_mechanic_set contains all mechanics added during iterations", () => {
    const r = runMdaIterationLoop(emptySet, rpgAesthetics, 0.5, 5);
    const finalMechs = new Set<string>([
      ...r.final_mechanic_set.base,
      ...r.final_mechanic_set.combat,
      ...r.final_mechanic_set.progression,
      ...r.final_mechanic_set.spatial,
      ...r.final_mechanic_set.social,
    ].map((m) => m.mechanic_name));
    for (const diff of r.iteration_diffs) {
      if (diff.added_mechanic) {
        expect(finalMechs.has(diff.added_mechanic), `missing ${diff.added_mechanic}`).toBe(true);
      }
    }
  });

  it("is deterministic: same inputs produce identical outputs", () => {
    const a = runMdaIterationLoop(emptySet, rpgAesthetics, 0.5, 5);
    const b = runMdaIterationLoop(emptySet, rpgAesthetics, 0.5, 5);
    expect(a).toEqual(b);
  });
});

describe("runMdaIterationLoop — R4-08 acceptance", () => {
  it("iterations_done is NOT a hardcoded constant (changes with inputs)", () => {
    // Empty set with high threshold → max_iterations.
    const empty = runMdaIterationLoop(emptySet, rpgAesthetics, 1.0, 5);
    // Partially-filled set with low threshold → converges in 1 (already converged).
    const partial = runMdaIterationLoop(
      setWith("health_damage", "enemy_ai", "skill_trees"),
      rpgAesthetics,
      0.0,
      5,
    );
    // The two runs should have different iteration counts (not both = 3 or 5).
    expect(empty.iterations).not.toBe(partial.iterations);
    expect(empty.termination_reason).toBe("max_iterations");
    expect(partial.termination_reason).toBe("already_converged");
  });

  it("each iteration changes the candidate set (adds a mechanic)", () => {
    const r = runMdaIterationLoop(emptySet, rpgAesthetics, 0.6, 5);
    // Every non-initial iteration should have added a mechanic.
    for (const diff of r.iteration_diffs) {
      expect(diff.added_mechanic, "iteration added no mechanic").not.toBeNull();
    }
  });

  it("each iteration saves a diff with before/after scores", () => {
    const r = runMdaIterationLoop(emptySet, rpgAesthetics, 0.6, 5);
    for (const diff of r.iteration_diffs) {
      expect(diff).toHaveProperty("iteration");
      expect(diff).toHaveProperty("added_mechanic");
      expect(diff).toHaveProperty("overall_match_before");
      expect(diff).toHaveProperty("overall_match_after");
      expect(diff).toHaveProperty("converged");
    }
  });
});

// Import the constants for the "no_candidates" test setup.
import { AESTHETIC_TO_DYNAMICS, DYNAMICS_TO_MECHANICS } from "@/lib/mda/constants";
