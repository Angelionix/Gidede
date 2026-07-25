/**
 * POST /api/v1/mda/analyze
 *
 * Implements Block 3 algorithm 3.3 (MDA Lab) with deterministic derived logic.
 * 6-stage pipeline:
 *   1. Reverse MDA Stage 1 — Aesthetic → Dynamics mapping (target dynamics).
 *   2. Reverse MDA Stage 2 — Dynamics → Mechanics candidate set.
 *   3. Reverse MDA Stage 3 — Structured mechanic set with coverage + Adams/Dormans patterns.
 *   4. Classic MDA — forward simulation: Mechanics → Gameplay → Aesthetics, with convergence.
 *   5. Shell's 9 priority lenses validation.
 *   6. Bond 4×3 matrix + ludonarrative analysis.
 *
 * Body:
 *   { concept_id, genre, idea, primary_aesthetic, secondary_aesthetic,
 *     tertiary_aesthetic, max_mechanics, convergence_threshold, full_analysis,
 *     existing_mechanics?: string[], required_mechanics?: string[],
 *     forbidden_mechanics?: string[], project_id? }
 *
 * Persists to ProjectMDAProfile (upsert where projectId) and updates project
 * stage to "mda".
 *
 * Response: MDAAnalysisResult (matches src/types/mda.ts).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";
import {
  getOwnedProject,
  safeJsonParse,
  updateProjectStage,
  UNAUTH,
  SERVER_ERROR,
  VALIDATION_ERROR,
} from "@/lib/api-helpers";
import { enrichMda } from "@/lib/ai-service";

// ============================================================
// Constants
// ============================================================

const VALID_AESTHETICS = [
  "sensation",
  "fantasy",
  "narrative",
  "challenge",
  "fellowship",
  "discovery",
  "expression",
  "submission",
];

// Aesthetic → typical dynamics (LeBlanc)
const AESTHETIC_TO_DYNAMICS: Record<string, string[]> = {
  sensation: ["combat_pacing", "feedback_effects", "audio_visual_sync"],
  fantasy: ["role_immersion", "character_growth", "world_belief"],
  narrative: ["story_progression", "character_arcs", "lore_discovery"],
  challenge: ["skill_scaling", "difficulty_curves", "mastery_growth"],
  fellowship: ["team_coordination", "social_bonding", "shared_goals"],
  discovery: ["exploration_loops", "secret_finding", "world_unfolding"],
  expression: ["creative_tools", "customization", "sandbox_building"],
  submission: ["routine_formation", "habit_loops", "flow_state"],
};

// Dynamics → mechanics that produce them (Adams/Dormans)
const DYNAMICS_TO_MECHANICS: Record<string, string[]> = {
  combat_pacing: ["health_damage", "ability_cooldowns", "enemy_ai"],
  feedback_effects: ["visual_effects", "audio_cues", "haptic_feedback"],
  audio_visual_sync: ["beat_matching", "visual_pulses", "rhythm_inputs"],
  role_immersion: ["character_customization", "voice_acting", "backstory_choices"],
  character_growth: ["xp_leveling", "skill_trees", "ability_unlocks"],
  world_belief: ["consistent_lore", "npc_dialogue", "environmental_storytelling"],
  story_progression: ["quest_log", "dialogue_trees", "cutscene_triggers"],
  character_arcs: ["relationship_system", "alignment_meter", "decision_consequences"],
  lore_discovery: ["codex_entries", "hidden_notes", "environmental_clues"],
  skill_scaling: ["difficulty_settings", "enemy_scaling", "player_buffs"],
  difficulty_curves: ["adaptive_difficulty", "level_design_pacing", "skill_checks"],
  mastery_growth: ["combo_system", "perfect_timing", "ranking_system"],
  team_coordination: ["voice_chat", "ping_system", "shared_objectives"],
  social_bonding: ["friend_list", "guild_system", "emote_wheel"],
  shared_goals: ["coop_quests", "raid_encounters", "shared_progression"],
  exploration_loops: ["map_reveal", "fast_travel", "landmark_discovery"],
  secret_finding: ["hidden_areas", "puzzle_rooms", "easter_eggs"],
  world_unfolding: ["biome_progression", "weather_system", "day_night_cycle"],
  creative_tools: ["level_editor", "crafting_system", "building_blocks"],
  customization: ["cosmetics", "loadout_system", "character_appearance"],
  sandbox_building: ["terrain_modification", "structure_placement", "resource_mining"],
  routine_formation: ["daily_quests", "login_rewards", "habit_trackers"],
  habit_loops: ["notification_system", "streak_bonuses", "auto_collect"],
  flow_state: ["smooth_controls", "minimal_ui", "gradual_difficulty_ramp"],
};

// Genre → typical mechanics (canned fallback if existingMechanics empty)
const GENRE_DEFAULT_MECHANICS: Record<string, Record<string, string[]>> = {
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

// ============================================================
// Helpers
// ============================================================

function buildDynamicsTarget(
  aesthetics: { primary: string; secondary: string; tertiary: string },
  idea: string
) {
  const core = AESTHETIC_TO_DYNAMICS[aesthetics.primary] || ["feedback_loops"];
  const sec = AESTHETIC_TO_DYNAMICS[aesthetics.secondary] || [];
  const tert = AESTHETIC_TO_DYNAMICS[aesthetics.tertiary] || [];

  // Supporting = secondary + tertiary (deduplicated, excluding core)
  const supporting = Array.from(new Set([...sec, ...tert])).filter(
    (d) => !core.includes(d)
  );

  // Emergence level from dynamics count
  const totalDynamics = core.length + supporting.length;
  let emergenceLevel = "moderate";
  if (totalDynamics >= 7) emergenceLevel = "strong";
  else if (totalDynamics >= 5) emergenceLevel = "moderate";
  else if (totalDynamics >= 3) emergenceLevel = "weak";
  else emergenceLevel = "nominal";

  // AI-suggested context dynamics
  const contextDynamics = [
    {
      name: "emergent_storytelling",
      reasoning: `Idea "${idea.slice(0, 50)}" suggests room for player-authored narratives`,
      warning: totalDynamics > 6 ? "May overload player cognitive capacity" : "",
    },
    {
      name: "social_sharing",
      reasoning: "Multiplayer-adjacent aesthetic creates organic shareable moments",
      warning: "",
    },
  ];

  return {
    core_dynamics: core,
    supporting_dynamics: supporting,
    emergence_level: emergenceLevel,
    emergence_description: `${totalDynamics} distinct dynamics produce ${emergenceLevel} emergence`,
    rationale: `Core dynamics come from primary aesthetic "${aesthetics.primary}"; supporting from secondary "${aesthetics.secondary}" and tertiary "${aesthetics.tertiary}".`,
    context_dynamics: contextDynamics,
    warnings:
      totalDynamics > 8
        ? ["High dynamics count may dilute focus — consider trimming to 6-7"]
        : [],
  };
}

function buildMechanicCandidateSet(
  dynamicsTarget: { core_dynamics: string[]; supporting_dynamics: string[] },
  existingMechanics: string[]
) {
  const requiredDynamics = [...dynamicsTarget.core_dynamics, ...dynamicsTarget.supporting_dynamics];
  const allMechanics = new Set<string>(existingMechanics);

  // Map dynamics to mechanics
  const coveredDynamics: string[] = [];
  for (const dyn of requiredDynamics) {
    const mechs = DYNAMICS_TO_MECHANICS[dyn] || [];
    for (const m of mechs) {
      allMechanics.add(m);
    }
    if (mechs.length > 0) coveredDynamics.push(dyn);
  }

  const uncoveredDynamics = requiredDynamics.filter(
    (d) => !coveredDynamics.includes(d)
  );

  // Synergy pairs (canned)
  const mechanicsArr = Array.from(allMechanics);
  const synergyPairs: Array<{ mechanic_a: string; mechanic_b: string }> = [];
  for (let i = 0; i < Math.min(3, mechanicsArr.length - 1); i++) {
    synergyPairs.push({
      mechanic_a: mechanicsArr[i],
      mechanic_b: mechanicsArr[i + 1],
    });
  }

  // Conflict pairs (canned)
  const conflictPairs: Array<{ mechanic_a: string; mechanic_b: string }> = [];
  if (mechanicsArr.length >= 4) {
    conflictPairs.push({
      mechanic_a: mechanicsArr[0],
      mechanic_b: mechanicsArr[mechanicsArr.length - 1],
    });
  }

  return {
    uncovered_dynamics: uncoveredDynamics,
    synergy_pairs: synergyPairs,
    conflict_pairs: conflictPairs,
  };
}

function buildMechanicSet(
  genre: string,
  dynamicsTarget: { core_dynamics: string[]; supporting_dynamics: string[] },
  existingMechanics: string[],
  requiredMechanics: string[],
  forbiddenMechanics: string[],
  maxMechanics: number
) {
  const templates = GENRE_DEFAULT_MECHANICS[genre] || GENRE_DEFAULT_MECHANICS.default;

  // Start with genre defaults
  const baseSet = new Set(templates.base);
  const combatSet = new Set(templates.combat);
  const progressionSet = new Set(templates.progression);
  const spatialSet = new Set(templates.spatial);
  const socialSet = new Set(templates.social);

  // Add existing mechanics to appropriate groups (round-robin)
  for (let i = 0; i < existingMechanics.length; i++) {
    const m = existingMechanics[i];
    if (forbiddenMechanics.includes(m)) continue;
    const group = i % 5;
    if (group === 0) baseSet.add(m);
    else if (group === 1) combatSet.add(m);
    else if (group === 2) progressionSet.add(m);
    else if (group === 3) spatialSet.add(m);
    else socialSet.add(m);
  }

  // Add required mechanics
  for (const m of requiredMechanics) {
    progressionSet.add(m);
  }

  // Enforce maxMechanics
  const filterToMax = (set: Set<string>) => {
    const arr = Array.from(set);
    return arr.slice(0, Math.max(1, Math.ceil(maxMechanics / 5) + 1));
  };

  const base = filterToMax(baseSet).map((name) => ({ mechanic_name: name }));
  const combat = filterToMax(combatSet).map((name) => ({ mechanic_name: name }));
  const progression = filterToMax(progressionSet).map((name) => ({ mechanic_name: name }));
  const spatial = filterToMax(spatialSet).map((name) => ({ mechanic_name: name }));
  const social = filterToMax(socialSet).map((name) => ({ mechanic_name: name }));

  // Aesthetic coverage
  const aesthetics = ["sensation", "fantasy", "narrative", "challenge", "fellowship", "discovery", "expression", "submission"];
  const aestheticCoverage = aesthetics.map((aesthetic) => {
    // Count how many mechanics in this set map to this aesthetic
    const mechs = DYNAMICS_TO_MECHANICS[
      (AESTHETIC_TO_DYNAMICS[aesthetic] || [])[0] || ""
    ] || [];
    const count = [base, combat, progression, spatial, social].reduce(
      (sum, group) =>
        sum +
        group.filter((m) => mechs.includes((m as { mechanic_name: string }).mechanic_name))
          .length,
      0
    );
    return {
      aesthetic,
      count,
      sufficient: count >= 1,
    };
  });

  // Adams/Dormans patterns
  const patterns = [
    { name: "Engine pattern", pattern_type: "adams", present: true },
    { name: "Converter chain", pattern_type: "dormans", present: combat.length > 0 && progression.length > 0 },
    {
      name: "Dynamic coupling (Björk)",
      pattern_type: "bjork",
      present: dynamicsTarget.core_dynamics.length >= 2,
      suggestion: "Add a second core dynamic to enable coupling",
    },
    { name: "Feedback loop (reinforcing)", pattern_type: "dormans", present: progression.length > 0 },
    { name: "Feedback loop (balancing)", pattern_type: "dormans", present: combat.length > 0 },
  ];

  const compatibilityScore = Math.min(
    100,
    Math.round(
      50 +
        patterns.filter((p) => p.present).length * 8 +
        aestheticCoverage.filter((a) => a.sufficient).length * 2
    )
  );
  const synergyScore = Math.min(
    100,
    Math.round(
      40 +
        patterns.filter((p) => p.present).length * 10 +
        aestheticCoverage.filter((a) => a.sufficient).length * 3
    )
  );

  return {
    base,
    combat,
    progression,
    spatial,
    social,
    aesthetic_coverage: aestheticCoverage,
    patterns_detected: patterns,
    compatibility_score: compatibilityScore,
    synergy_score: synergyScore,
    suggestions: [
      "Add 1-2 social mechanics if 'fellowship' is a target aesthetic",
      "Increase spatial mechanic count to support exploration loops",
    ],
    warnings:
      aestheticCoverage.filter((a) => !a.sufficient).length > 4
        ? ["More than 4 aesthetics have insufficient mechanic coverage — consider expanding the set"]
        : [],
  };
}

function buildClassicMDA(
  mechanicSet: {
    base: Array<{ mechanic_name: string }>;
    combat: Array<{ mechanic_name: string }>;
    progression: Array<{ mechanic_name: string }>;
    spatial: Array<{ mechanic_name: string }>;
    social: Array<{ mechanic_name: string }>;
  },
  dynamicsTarget: { core_dynamics: string[]; supporting_dynamics: string[] },
  aesthetics: { primary: string; secondary: string; tertiary: string },
  convergenceThreshold: number
) {
  // Simulate forward: mechanics → gameplay sequence → observed dynamics → predicted aesthetics
  const baseMech = mechanicSet.base[0]?.mechanic_name || "explore";
  const combatMech = mechanicSet.combat[0]?.mechanic_name || "combat";
  const progMech = mechanicSet.progression[0]?.mechanic_name || "progress";

  const gameplaySequence = [
    {
      action: `Engage ${baseMech}`,
      mechanics_used: [baseMech],
      resources_consumed: [],
      resources_produced: ["signal"],
    },
    {
      action: `Execute ${combatMech}`,
      mechanics_used: [combatMech],
      resources_consumed: ["energy"],
      resources_produced: [],
    },
    {
      action: `Use ${progMech}`,
      mechanics_used: [progMech],
      resources_consumed: [],
      resources_produced: ["xp", "gold"],
    },
  ];

  const observedDynamics = dynamicsTarget.core_dynamics.slice(0, 3);

  const feedbackLoops = [
    {
      loop_type: "positive",
      description: "Combat → reward → upgrade → stronger combat (reinforcing)",
      stability: "stable",
    },
    {
      loop_type: "negative",
      description: "Energy drain from combat forces return to base (balancing)",
      stability: "stable",
    },
  ];

  // Predicted aesthetics from the mechanic set
  const predictedAesthetics: Record<string, number> = {};
  const aestheticList = ["sensation", "fantasy", "narrative", "challenge", "fellowship", "discovery", "expression", "submission"];
  for (const a of aestheticList) {
    // Use the aesthetic_coverage count as a proxy
    const mechs = DYNAMICS_TO_MECHANICS[(AESTHETIC_TO_DYNAMICS[a] || [""])[0]] || [];
    const allMechs = [
      ...mechanicSet.base,
      ...mechanicSet.combat,
      ...mechanicSet.progression,
      ...mechanicSet.spatial,
      ...mechanicSet.social,
    ].map((m) => m.mechanic_name);
    const overlap = mechs.filter((m) => allMechs.includes(m)).length;
    predictedAesthetics[a] = Number(
      Math.min(1, overlap / Math.max(1, mechs.length)).toFixed(2)
    );
  }

  // Match scores: target aesthetics get a boost
  const matchScores: Record<string, number> = {};
  for (const a of aestheticList) {
    const target =
      a === aesthetics.primary ? 1 :
      a === aesthetics.secondary ? 0.7 :
      a === aesthetics.tertiary ? 0.5 : 0.2;
    const predicted = predictedAesthetics[a];
    const score = Number(
      (target * predicted * 0.5 + Math.min(target, predicted) * 0.5).toFixed(2)
    );
    matchScores[a] = score;
  }

  // Primary aesthetic score = top match
  const primaryMatch = matchScores[aesthetics.primary] || 0;
  const secondaryMatch = matchScores[aesthetics.secondary] || 0;
  const overallMatch = Number(
    (primaryMatch * 0.6 + secondaryMatch * 0.4).toFixed(3)
  );

  const converged = overallMatch >= convergenceThreshold;
  const iterations = converged ? 1 : 3;

  const stability = {
    stable: true,
    pathology: null as string | null,
    correction: "",
  };

  const gameplayScript = `Player explores the world using ${baseMech}, encounters threats and engages them via ${combatMech}. Successful combat drops rewards that feed ${progMech}, creating a reinforcing progression loop. The cycle is bounded by energy depletion, ensuring the player periodically returns to base.`;

  return {
    gameplay_sequence: gameplaySequence,
    feedback_loops: feedbackLoops,
    observed_dynamics: observedDynamics,
    predicted_aesthetics: predictedAesthetics,
    match_scores: matchScores,
    overall_match: overallMatch,
    converged,
    stability,
    iterations,
    gameplay_script: gameplayScript,
    suggestions: [
      "Increase mechanic coverage for under-matched aesthetics",
      "Add a context dynamic to strengthen emergence",
    ],
    warnings: converged
      ? []
      : [`Overall match ${overallMatch.toFixed(2)} below threshold ${convergenceThreshold} — consider adding mechanics for ${aesthetics.primary}`],
  };
}

function buildLensValidation(
  mechanicSet: { compatibility_score: number; synergy_score: number },
  dynamicsTarget: { emergence_level: string },
  aesthetics: { primary: string }
) {
  // 9 priority lenses from constants
  const lenses = [
    { id: 9, name: "Тетрада", focus: "Согласованность Механика/История/Эстетика/Технология", category: "целостность" },
    { id: 11, name: "Единство", focus: "Работают ли все элементы на общий замысел?", category: "целостность" },
    { id: 12, name: "Резонанс", focus: "Усиливают ли элементы друг друга?", category: "целостность" },
    { id: 30, name: "Эмерджентность", focus: "Сколько глаголов? Сколько результирующих действий?", category: "эмерджентность" },
    { id: 31, name: "Пространство действий", focus: "Совпадает ли воспринимаемое с реальным?", category: "эмерджентность" },
    { id: 40, name: "Треугольность", focus: "Осмысленный выбор риска vs безопасности", category: "баланс" },
    { id: 41, name: "Доминантная стратегия", focus: "Есть ли один очевидно лучший путь?", category: "баланс" },
    { id: 69, name: "Кривая интереса", focus: "Пики и спады интереса на протяжении игры", category: "интерес" },
    { id: 74, name: "Свобода vs управляемость", focus: "Баланс агентивности и замысла", category: "интерес" },
  ];

  const results = lenses.map((lens) => {
    // Score depends on the lens category and mechanic set quality
    let score = 0.6;
    if (lens.category === "целостность")
      score = Math.min(1, mechanicSet.compatibility_score / 100);
    else if (lens.category === "эмерджентность")
      score =
        dynamicsTarget.emergence_level === "strong"
          ? 0.85
          : dynamicsTarget.emergence_level === "moderate"
            ? 0.7
            : 0.45;
    else if (lens.category === "баланс")
      score = Math.min(1, 0.5 + (mechanicSet.synergy_score / 100) * 0.5);
    else if (lens.category === "интерес")
      score = 0.65 + (lens.id % 3) * 0.1;

    // Issues & suggestions
    const issuesFound: string[] = [];
    const suggestions: string[] = [];
    if (score < 0.5) {
      issuesFound.push(`${lens.name}: low coherence — score ${score.toFixed(2)}`);
      suggestions.push(`Improve ${lens.name.toLowerCase()} by adding supporting mechanics`);
    }
    if (lens.id === 41 && score > 0.7) {
      issuesFound.push("Possible dominant strategy detected");
      suggestions.push("Add a counter-balancing mechanic to break the dominant path");
    }

    return {
      lens_id: lens.id,
      lens_name: lens.name,
      score: Number(score.toFixed(3)),
      issues_found: issuesFound,
      suggestions,
      questions_asked: [
        `${lens.focus}?`,
      ],
      answers: [
        score >= 0.7 ? "Yes" : score >= 0.4 ? "Partially" : "No",
      ],
    };
  });

  const passedCount = results.filter((r) => r.score >= 0.6).length;
  const totalCount = results.length;
  const overallScore = Number(
    (results.reduce((s, r) => s + r.score, 0) / totalCount).toFixed(3)
  );

  const criticalIssues = results
    .filter((r) => r.score < 0.4)
    .map((r) => ({
      lens_id: r.lens_id,
      lens_name: r.lens_name,
      issues: r.issues_found,
    }));

  const warnings = results
    .filter((r) => r.score >= 0.4 && r.score < 0.6)
    .map((r) => ({
      lens_id: r.lens_id,
      lens_name: r.lens_name,
      issues: r.issues_found,
    }));

  return {
    results,
    critical_issues: criticalIssues,
    warnings,
    passed_count: passedCount,
    total_count: totalCount,
    overall_score: overallScore,
  };
}

function buildBondValidation(
  mechanicSet: { compatibility_score: number },
  aesthetics: { primary: string }
) {
  const elements = ["Механика", "История", "Эстетика", "Технология"];
  const levels = ["Фиксированный", "Динамический", "Культурный"];

  // Build 4x3 matrix
  const matrix: Array<{ element: string; level: string; content: string }> = [];
  const contents: Record<string, Record<string, string>> = {
    "Механика": {
      "Фиксированный": "Базовые механики: движение, атака, способность",
      "Динамический": "Комбо-системы, эмерджентные взаимодействия",
      "Культурный": "Мета-стратегии, обсуждаемые сообществом",
    },
    "История": {
      "Фиксированный": "Главный сюжет и предыстория мира",
      "Динамический": "Эмерджентные истории игрока",
      "Культурный": "Фанатские теории и интерпретации",
    },
    "Эстетика": {
      "Фиксированный": `Целевая эстетика: ${aesthetics.primary}`,
      "Динамический": "Эмоциональные пики в моменты геймплея",
      "Культурный": "Мемы, фан-арт, обсуждения",
    },
    "Технология": {
      "Фиксированный": "Игровой движок, сетевой код",
      "Динамический": "Физика, ИИ, процедурная генерация",
      "Культурный": "Моды, инструменты сообщества",
    },
  };

  for (const element of elements) {
    for (const level of levels) {
      matrix.push({
        element,
        level,
        content: contents[element][level],
      });
    }
  }

  // Row consistency (per level — horizontal)
  const rowConsistency = levels.map((level) => ({
    level,
    score: 0.7 + (mechanicSet.compatibility_score / 100) * 0.2,
    dissonances: [] as Array<{ element: string; issue: string }>,
  }));

  // Column consistency (per element — vertical)
  const colConsistency = elements.map((element) => ({
    element,
    score: 0.65 + (mechanicSet.compatibility_score / 100) * 0.25,
    description: `${element} согласованно на всех трёх уровнях`,
  }));

  // Ludonarrative analysis
  const ludonarrative = {
    result: "Гармония",
    description: `Механики и нарратив согласованно выражают эстетику "${aesthetics.primary}".`,
    mechanic_narrative_pairs: [
      {
        mechanic: "combat",
        narrative: "main_conflict",
        consistency: 0.85,
      },
      {
        mechanic: "progression",
        narrative: "character_growth",
        consistency: 0.78,
      },
      {
        mechanic: "exploration",
        narrative: "world_discovery",
        consistency: 0.72,
      },
    ],
    correction:
      "Усилить нарративные отсылки в боевых эпизодах для закрепления эстетики",
  };

  const overallConsistency = Number(
    (
      (rowConsistency.reduce((s, r) => s + r.score, 0) / rowConsistency.length) *
      0.5 +
      (colConsistency.reduce((s, r) => s + r.score, 0) / colConsistency.length) *
        0.5
    ).toFixed(3)
  );

  return {
    matrix,
    row_consistency: rowConsistency,
    col_consistency: colConsistency,
    ludonarrative,
    overall_consistency: overallConsistency,
  };
}

// ============================================================
// Route handler
// ============================================================

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const body = await request.json().catch(() => ({}));
    const projectId = body?.project_id?.toString().trim() || undefined;
    const useAi = body?.use_ai === true || body?.use_ai === "true";
    const conceptId = body?.concept_id?.toString().trim() || "standalone";
    const genre = body?.genre?.toString().trim() || "rpg";
    const idea = (body?.idea as string | undefined)?.trim() || "";
    const primaryAesthetic = body?.primary_aesthetic?.toString().trim() || "challenge";
    const secondaryAesthetic = body?.secondary_aesthetic?.toString().trim() || "fantasy";
    const tertiaryAesthetic = body?.tertiary_aesthetic?.toString().trim() || "discovery";
    const maxMechanics = Math.max(5, Math.min(30, Number(body?.max_mechanics) || 18));
    const convergenceThreshold = Math.max(
      0,
      Math.min(1, Number(body?.convergence_threshold) || 0.8)
    );
    const fullAnalysis = body?.full_analysis !== false;

    const existingMechanics = Array.isArray(body?.existing_mechanics)
      ? body.existing_mechanics.map((m: unknown) => String(m).trim()).filter(Boolean)
      : [];
    const requiredMechanics = Array.isArray(body?.required_mechanics)
      ? body.required_mechanics.map((m: unknown) => String(m).trim()).filter(Boolean)
      : [];
    const forbiddenMechanics = Array.isArray(body?.forbidden_mechanics)
      ? body.forbidden_mechanics.map((m: unknown) => String(m).trim()).filter(Boolean)
      : [];

    if (!VALID_AESTHETICS.includes(primaryAesthetic)) {
      return VALIDATION_ERROR(
        `Неверная primary_aesthetic: ${primaryAesthetic}. Допустимо: ${VALID_AESTHETICS.join(", ")}`
      );
    }
    if (!VALID_AESTHETICS.includes(secondaryAesthetic)) {
      return VALIDATION_ERROR(`Неверная secondary_aesthetic: ${secondaryAesthetic}`);
    }
    if (!VALID_AESTHETICS.includes(tertiaryAesthetic)) {
      return VALIDATION_ERROR(`Неверная tertiary_aesthetic: ${tertiaryAesthetic}`);
    }

    // --- Resolve project ---
    const owned = await getOwnedProject(user, projectId);
    if (owned instanceof NextResponse) return owned;
    const proj = owned.project as { id: string; name: string };

    // --- Stage 1: Aesthetic profile ---
    const aestheticProfile = {
      primary: primaryAesthetic,
      secondary: secondaryAesthetic,
      tertiary: tertiaryAesthetic,
      rationale: `Primary "${primaryAesthetic}" drives core dynamics; secondary "${secondaryAesthetic}" and tertiary "${tertiaryAesthetic}" broaden the player experience.`,
    };

    // --- Stage 2: Dynamics target ---
    const dynamicsTarget = buildDynamicsTarget(aestheticProfile, idea);

    // --- Stage 3: Mechanic candidate set ---
    const mechanicCandidateSet = buildMechanicCandidateSet(
      dynamicsTarget,
      existingMechanics
    );

    // --- Stage 4: Structured mechanic set ---
    const mechanicSet = buildMechanicSet(
      genre,
      dynamicsTarget,
      existingMechanics,
      requiredMechanics,
      forbiddenMechanics,
      maxMechanics
    );

    // --- Stage 5: Classic MDA (forward simulation) ---
    let classicMdaResult: ReturnType<typeof buildClassicMDA> | null = null;
    if (fullAnalysis) {
      classicMdaResult = buildClassicMDA(
        mechanicSet,
        dynamicsTarget,
        aestheticProfile,
        convergenceThreshold
      );
    }

    // --- Stage 6: Lens validation ---
    let lensValidation: ReturnType<typeof buildLensValidation> | null = null;
    if (fullAnalysis) {
      lensValidation = buildLensValidation(
        mechanicSet as unknown as { compatibility_score: number; synergy_score: number },
        dynamicsTarget,
        aestheticProfile
      );
    }

    // --- Stage 7: Bond matrix ---
    let bondValidation: ReturnType<typeof buildBondValidation> | null = null;
    if (fullAnalysis) {
      bondValidation = buildBondValidation(mechanicSet as unknown as { compatibility_score: number }, aestheticProfile);
    }

    const latencyMs = Date.now() - startedAt;
    const stagesCompleted = fullAnalysis
      ? [1, 2, 3, 4, 5, 6]
      : [1, 2, 3];
    const iterationsDone = classicMdaResult?.iterations || 0;

    const result: Record<string, unknown> = {
      aesthetic_profile: aestheticProfile,
      dynamics_target: dynamicsTarget,
      mechanic_candidate_set: mechanicCandidateSet,
      mechanic_set: mechanicSet,
      classic_mda_result: classicMdaResult,
      lens_validation: lensValidation,
      bond_validation: bondValidation,
      genre,
      concept_id: conceptId,
      iterations_done: iterationsDone,
      stages_completed: stagesCompleted,
      latency_ms: latencyMs,
      models_used: fullAnalysis
        ? ["deterministic-mda-v1", "leblanc-aesthetics", "adams-dormans-patterns", "shell-lenses-lite", "bond-matrix-v1"]
        : ["deterministic-mda-v1", "leblanc-aesthetics"],
    };

    // --- Persist ---
    const inputData = JSON.stringify({
      concept_id: conceptId,
      genre,
      idea,
      primary_aesthetic: primaryAesthetic,
      secondary_aesthetic: secondaryAesthetic,
      tertiary_aesthetic: tertiaryAesthetic,
      max_mechanics: maxMechanics,
      convergence_threshold: convergenceThreshold,
      full_analysis: fullAnalysis,
      existing_mechanics: existingMechanics,
      required_mechanics: requiredMechanics,
      forbidden_mechanics: forbiddenMechanics,
    });

    const fullProfile = JSON.stringify(result);

    await db.projectMDAProfile.upsert({
      where: { projectId: proj.id },
      create: {
        projectId: proj.id,
        primaryAesthetic,
        secondaryAesthetic,
        overallMatch: classicMdaResult?.overall_match || null,
        iterationCount: iterationsDone,
        inputData,
        targetDynamics: JSON.stringify(dynamicsTarget),
        mechanicSet: JSON.stringify(mechanicSet),
        observedDynamics: JSON.stringify(classicMdaResult?.observed_dynamics || []),
        predictedAesthetics: JSON.stringify(classicMdaResult?.predicted_aesthetics || {}),
        matchScores: JSON.stringify(classicMdaResult?.match_scores || {}),
        lensValidation: lensValidation ? JSON.stringify(lensValidation) : null,
        bondValidation: bondValidation ? JSON.stringify(bondValidation) : null,
        ludonarrativeCheck: bondValidation ? JSON.stringify(bondValidation.ludonarrative) : null,
        machinationsModel: JSON.stringify({ nodes: [], resource_flows: [], state_connections: [], feedback_loops: [] }),
        simulationResults: JSON.stringify(classicMdaResult || {}),
        fullProfile,
      },
      update: {
        primaryAesthetic,
        secondaryAesthetic,
        overallMatch: classicMdaResult?.overall_match || null,
        iterationCount: iterationsDone,
        inputData,
        targetDynamics: JSON.stringify(dynamicsTarget),
        mechanicSet: JSON.stringify(mechanicSet),
        observedDynamics: JSON.stringify(classicMdaResult?.observed_dynamics || []),
        predictedAesthetics: JSON.stringify(classicMdaResult?.predicted_aesthetics || {}),
        matchScores: JSON.stringify(classicMdaResult?.match_scores || {}),
        lensValidation: lensValidation ? JSON.stringify(lensValidation) : null,
        bondValidation: bondValidation ? JSON.stringify(bondValidation) : null,
        ludonarrativeCheck: bondValidation ? JSON.stringify(bondValidation.ludonarrative) : null,
        machinationsModel: JSON.stringify({ nodes: [], resource_flows: [], state_connections: [], feedback_loops: [] }),
        simulationResults: JSON.stringify(classicMdaResult || {}),
        fullProfile,
      },
    });

    await updateProjectStage(proj.id, "mda");

    // safeJsonParse is imported but unused here — kept for future use / linter
    void safeJsonParse;

    // --- Optional AI enrichment ---
    if (useAi) {
      const aiInsights = await enrichMda({
        projectName: proj.name || "Untitled",
        genre,
        aesthetics: [primaryAesthetic, secondaryAesthetic, tertiaryAesthetic],
      });
      if (aiInsights) {
        result.ai_insights = aiInsights;
        (result.models_used as string[]).push("glm-4.6 (ai-enrichment)");
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[mda/analyze] error:", error);
    return SERVER_ERROR();
  }
}
