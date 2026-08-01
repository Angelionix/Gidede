/**
 * Gidede — MDA shared constants (Block 3).
 *
 * TASK-3.20: extracted from src/app/api/v1/mda/analyze/route.ts for testability.
 * These constants define the MDA framework mappings used by the analysis pipeline.
 */

// 8 Hunicke aesthetics (LeBlanc)
export const VALID_AESTHETICS = [
  "sensation", "fantasy", "narrative", "challenge",
  "fellowship", "discovery", "expression", "submission",
] as const;

// Aesthetic → dynamics that produce it (LeBlanc)
export const AESTHETIC_TO_DYNAMICS: Record<string, string[]> = {
  sensation: ["combat_pacing", "feedback_effects", "audio_visual_sync"],
  fantasy: ["role_immersion", "character_growth", "world_belief"],
  narrative: ["story_progression", "character_arcs", "lore_discovery"],
  challenge: ["skill_scaling", "difficulty_curves", "mastery_growth"],
  fellowship: ["team_coordination", "social_bonding", "shared_goals"],
  discovery: ["exploration_loops", "secret_finding", "world_unfolding"],
  expression: ["creative_tools", "customization", "sandbox_building"],
  submission: ["routine_formation", "habit_loops", "flow_state"],
};

// TASK-3.1: Dynamics → mechanics aligned with GENRE_DEFAULT_MECHANICS namespace.
export const DYNAMICS_TO_MECHANICS: Record<string, string[]> = {
  combat_pacing: ["health_damage", "ability_cooldowns", "enemy_ai"],
  feedback_effects: ["score_increase", "level_unlock", "input_action"],
  audio_visual_sync: ["input_action", "state_progression", "score_increase"],
  role_immersion: ["dialogue_trees", "party_management", "equipment_upgrade"],
  character_growth: ["xp_leveling", "skill_trees", "equipment_upgrade"],
  world_belief: ["dialogue_trees", "world_exploration", "merchant_trading"],
  story_progression: ["dialogue_trees", "quest_log", "cutscene_triggers"],
  character_arcs: ["dialogue_trees", "party_management", "equipment_upgrade"],
  lore_discovery: ["world_exploration", "map_exploration", "objective_navigation"],
  skill_scaling: ["health_damage", "enemy_ai", "ability_cooldowns"],
  difficulty_curves: ["enemy_ai", "health_damage", "level_unlock"],
  mastery_growth: ["skill_trees", "perk_trees", "score_increase"],
  team_coordination: ["squad_coordination", "coop_progression", "party_management"],
  social_bonding: ["party_management", "squad_coordination", "leaderboards"],
  shared_goals: ["coop_progression", "squad_coordination", "objective_navigation"],
  exploration_loops: ["map_exploration", "world_exploration", "objective_navigation"],
  secret_finding: ["map_exploration", "world_exploration", "dungeon_navigation"],
  world_unfolding: ["world_exploration", "map_exploration", "territory_control"],
  creative_tools: ["build_queues", "city_placement", "resource_gathering"],
  customization: ["equipment_upgrade", "perk_trees", "skill_trees"],
  sandbox_building: ["build_queues", "city_placement", "territory_control"],
  routine_formation: ["score_increase", "level_unlock", "leaderboards"],
  habit_loops: ["leaderboards", "score_increase", "state_progression"],
  flow_state: ["input_action", "state_progression", "tactical_movement"],
};

// Genre → typical mechanics
export const GENRE_DEFAULT_MECHANICS: Record<string, Record<string, string[]>> = {
  rpg: {
    base: ["inventory_management", "dialogue_trees"],
    combat: ["turn_based_combat", "ability_cooldowns"],
    progression: ["xp_leveling", "skill_trees"],
    spatial: ["world_exploration", "dungeon_navigation"],
    social: ["party_management", "merchant_trading"],
  },
  shooter: {
    base: ["aim_assist", "reload_mechanic"],
    combat: ["hitscan_combat", "projectile_physics"],
    progression: ["weapon_unlocks", "perk_trees"],
    spatial: ["tactical_movement", "vertical_traversal"],
    social: ["squad_coordination", "leaderboards"],
  },
  strategy: {
    base: ["resource_gathering", "build_queues"],
    combat: ["unit_formations", "fog_of_war"],
    progression: ["tech_trees", "era_advancement"],
    spatial: ["territory_control", "city_placement"],
    social: ["diplomacy", "trade_agreements"],
  },
  default: {
    base: ["input_action", "state_progression"],
    combat: ["health_damage", "enemy_ai"],
    progression: ["score_increase", "level_unlock"],
    spatial: ["map_exploration", "objective_navigation"],
    social: ["leaderboard", "coop_progression"],
  },
};

// TASK-3.19: Semantic categorization of mechanics by name keywords.
export function categorizeMechanic(mechanicName: string): "base" | "combat" | "progression" | "spatial" | "social" {
  const lower = mechanicName.toLowerCase();
  // TASK-3.19: Semantic categorization with word boundaries for short keywords.
  // "xp" must not match inside "exploration" (e-xp-loration).
  // Progression checked BEFORE combat so "weapon_unlocks" → progression (not combat via "weapon").
  if (/\bxp\b|level|skill|upgrade|progress|tech|\bera\b|perk|score|unlock|quest|cutscene/.test(lower))
    return "progression";
  if (/combat|fight|attack|damage|enemy|health|hitscan|projectile|ability_cooldown|unit_formation|fog_of_war/.test(lower))
    return "combat";
  if (/map|explore|world|navigate|territory|build|city|place|tactical|vertical|dungeon|landmark|biome/.test(lower))
    return "spatial";
  if (/party|guild|social|trade|diplomacy|leaderboard|squad|coop|merchant|squad_coordination/.test(lower))
    return "social";
  return "base";
}

/**
 * Collect all mechanic IDs across all genres in GENRE_DEFAULT_MECHANICS.
 * Used for namespace alignment verification (TASK-3.1).
 */
export function getAllGenreMechanicIds(): Set<string> {
  const ids = new Set<string>();
  for (const genre of Object.values(GENRE_DEFAULT_MECHANICS)) {
    for (const group of Object.values(genre)) {
      for (const m of group) ids.add(m);
    }
  }
  return ids;
}

/**
 * TASK-3.2: Get all mechanics for an aesthetic by iterating ALL its dynamics.
 * Returns a deduplicated Set of mechanic IDs.
 */
export function getMechanicsForAesthetic(aesthetic: string): Set<string> {
  const dynamics = AESTHETIC_TO_DYNAMICS[aesthetic] || [];
  const mechs = new Set<string>();
  for (const dyn of dynamics) {
    for (const m of DYNAMICS_TO_MECHANICS[dyn] || []) {
      mechs.add(m);
    }
  }
  return mechs;
}

/**
 * Compute overlap between aesthetic-derived mechanics and a given mechanic set.
 * Returns { overlap, total, percentage }.
 */
export function computeAestheticOverlap(
  aesthetic: string,
  mechanicNames: string[]
): { overlap: string[]; total: number; percentage: number } {
  const aestheticMechs = getMechanicsForAesthetic(aesthetic);
  const overlap = Array.from(aestheticMechs).filter((m) => mechanicNames.includes(m));
  return {
    overlap,
    total: aestheticMechs.size,
    percentage: aestheticMechs.size > 0 ? Math.round((overlap.length / aestheticMechs.size) * 100) : 0,
  };
}
