/**
 * POST /api/v1/concept/generate
 *
 * Implements Block 1 algorithm 3.1 (Concept generator) with deterministic
 * derived logic (no real AI). Stage pipeline:
 *   1. Genre inference from idea keywords (if genre is null/auto).
 *   2. Aesthetic profile (Hunicke 8 — primary/secondary/tertiary).
 *   3. Dynamics profile (core + supporting dynamics).
 *   4. Mechanic set (base/combat/progression/spatial/social).
 *   5. Core Loop + USP candidates (3 each).
 *   6. Validation report (Triangle of Weirdness, 5 core questions, 8 filters).
 *   7. One-pager assembly + persistence.
 *
 * Body:
 *   { idea, genre?: string|null, target_audience?: {primary, experience},
 *     platform?: string[], constraints?: {team_size, budget},
 *     reference_games?: string[], forbidden_mechanics?: string[],
 *     project_id?: string }
 *
 * Persists to ProjectConcept (upsert where projectId) and updates project
 * stage to "concept".
 *
 * Response: ConceptGenerationResult (matches src/types/concept.ts).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";
import {
  getOwnedProject,
  updateProjectStage,
  UNAUTH,
  SERVER_ERROR,
  VALIDATION_ERROR,
} from "@/lib/api-helpers";
import { enrichConcept } from "@/lib/ai-service";
import { buildMechanicSetForGenres, type Mechanic } from "@/lib/mechanics-db";

// ============================================================
// Constants — valid enum values & static lookup tables
// ============================================================

const AESTHETIC_VALUES = [
  "sensation",
  "fantasy",
  "narrative",
  "challenge",
  "fellowship",
  "discovery",
  "expression",
  "submission",
] as const;

// Keyword → genre mapping for genre inference
const GENRE_KEYWORDS: Array<{ keywords: string[]; genre: string }> = [
  { keywords: ["shooter", "shoot", "gun", "bullet", "fps"], genre: "shooter" },
  { keywords: ["puzzle", "match-3", "logic", "tile"], genre: "puzzle" },
  { keywords: ["platformer", "jump", "platform", "speedrun"], genre: "platformer" },
  { keywords: ["rpg", "roleplay", "quest", "character", "leveling"], genre: "rpg" },
  { keywords: ["strategy", "tactic", "rts", "build", "empire"], genre: "strategy" },
  { keywords: ["horror", "scary", "fear", "survival"], genre: "horror" },
  { keywords: ["race", "racing", "car", "speed"], genre: "racing" },
  { keywords: ["card", "deck", "roguelike", "rogue"], genre: "roguelike" },
  { keywords: ["sandbox", "craft", "build", "open world"], genre: "sandbox" },
  { keywords: ["tower defense", "td", "wave"], genre: "tower_defense" },
  { keywords: ["mmo", "online", "raid"], genre: "mmorpg" },
  { keywords: ["idle", "clicker", "incremental"], genre: "idle" },
  { keywords: ["story", "visual novel", "narrative"], genre: "visual_novel" },
  { keywords: ["fighting", "brawl", "combat", "versus"], genre: "fighting" },
  { keywords: ["stealth", "sneak", "invisible"], genre: "stealth" },
  { keywords: ["metroid", "vania", "metroidvania"], genre: "metroidvania" },
  { keywords: ["rhythm", "music", "beat"], genre: "rhythm" },
];

// Genre → typical aesthetics (primary, secondary, tertiary)
const GENRE_AESTHETICS: Record<
  string,
  { primary: string; secondary: string; tertiary: string }
> = {
  action: { primary: "challenge", secondary: "sensation", tertiary: "fantasy" },
  platformer: { primary: "challenge", secondary: "sensation", tertiary: "discovery" },
  shooter: { primary: "challenge", secondary: "sensation", tertiary: "fellowship" },
  // TASK-1.6 FIXED: "competition" is a Yee motivation, not a Hunicke 8 aesthetic.
  // Replaced with "fellowship" (competitive social play) which IS a Hunicke 8.
  fighting: { primary: "challenge", secondary: "fellowship", tertiary: "expression" },
  stealth: { primary: "challenge", secondary: "discovery", tertiary: "submission" },
  survival_horror: { primary: "challenge", secondary: "narrative", tertiary: "submission" },
  rhythm: { primary: "sensation", secondary: "submission", tertiary: "expression" },
  adventure: { primary: "discovery", secondary: "narrative", tertiary: "fantasy" },
  rpg: { primary: "fantasy", secondary: "narrative", tertiary: "challenge" },
  action_rpg: { primary: "challenge", secondary: "fantasy", tertiary: "narrative" },
  jrpg: { primary: "narrative", secondary: "fantasy", tertiary: "challenge" },
  // TASK-1.6 FIXED: "strategy" is a Yee motivation, not a Hunicke 8 aesthetic.
  // Replaced with "discovery" (tactical exploration of build space).
  tactical_rpg: { primary: "challenge", secondary: "discovery", tertiary: "narrative" },
  mmorpg: { primary: "fellowship", secondary: "challenge", tertiary: "fantasy" },
  roguelike: { primary: "challenge", secondary: "discovery", tertiary: "sensation" },
  simulation: { primary: "submission", secondary: "expression", tertiary: "discovery" },
  strategy: { primary: "challenge", secondary: "discovery", tertiary: "expression" },
  rts: { primary: "challenge", secondary: "fellowship", tertiary: "discovery" },
  tbs: { primary: "challenge", secondary: "discovery", tertiary: "submission" },
  // TASK-1.6 FIXED: "strategy" replaced with "submission" (routine optimization flow).
  tower_defense: { primary: "challenge", secondary: "submission", tertiary: "discovery" },
  puzzle: { primary: "challenge", secondary: "discovery", tertiary: "submission" },
  party: { primary: "fellowship", secondary: "sensation", tertiary: "expression" },
  educational: { primary: "discovery", secondary: "challenge", tertiary: "narrative" },
  // TASK-1.6 FIXED: "competition" replaced with "fellowship" (asynchronous / direct competition is social).
  racing: { primary: "sensation", secondary: "challenge", tertiary: "fellowship" },
  sports: { primary: "fellowship", secondary: "challenge", tertiary: "sensation" },
  sandbox: { primary: "expression", secondary: "discovery", tertiary: "submission" },
  horror: { primary: "submission", secondary: "narrative", tertiary: "sensation" },
  metroidvania: { primary: "discovery", secondary: "challenge", tertiary: "narrative" },
  idle: { primary: "submission", secondary: "challenge", tertiary: "discovery" },
  visual_novel: { primary: "narrative", secondary: "fantasy", tertiary: "expression" },
};

// Aesthetic → dynamics that produce it
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

// Genre → typical mechanics by group
const GENRE_MECHANICS: Record<
  string,
  { base: string[]; combat: string[]; progression: string[]; spatial: string[]; social: string[] }
> = {
  rpg: {
    base: ["inventory_management", "dialogue_trees", "quest_log"],
    combat: ["turn_based_combat", "ability_cooldowns", "status_effects"],
    progression: ["xp_leveling", "skill_trees", "equipment_upgrade"],
    spatial: ["world_map_exploration", "fast_travel", "dungeon_navigation"],
    social: ["party_management", "npc_reputation", "merchant_trading"],
  },
  shooter: {
    base: ["aim_assist", "reload_mechanic", "cover_system"],
    combat: ["hitscan_combat", "projectile_physics", "headshot_multipliers"],
    progression: ["weapon_unlocks", "perk_trees", "killstreak_rewards"],
    spatial: ["tactical_movement", "level_pinning", "vertical_traversal"],
    social: ["squad_voice", "objective_coordination", "leaderboards"],
  },
  strategy: {
    base: ["resource_gathering", "build_queues", "tech_trees"],
    combat: ["unit_formations", "fog_of_war", "morale_system"],
    progression: ["era_advancement", "research_unlocks", "civilization_growth"],
    spatial: ["territory_control", "city_placement", "supply_lines"],
    social: ["diplomacy", "trade_agreements", "alliance_treaties"],
  },
  default: {
    base: ["input_action", "state_progression", "feedback_loop"],
    combat: ["health_damage", "ability_use", "enemy_ai"],
    progression: ["score_increase", "level_unlock", "reward_grant"],
    spatial: ["map_exploration", "objective_navigation", "spawn_points"],
    social: ["leaderboard", "achievement_share", "coop_progression"],
  },
};

// Genre → typical competitor reference games
const GENRE_COMPETITORS: Record<string, string[]> = {
  rpg: ["The Witcher 3", "Baldur's Gate 3", "Elder Scrolls V: Skyrim"],
  shooter: ["DOOM Eternal", "Call of Duty", "Overwatch 2"],
  strategy: ["Civilization VI", "Age of Empires II", "StarCraft II"],
  puzzle: ["Portal 2", "Tetris Effect", "Baba Is You"],
  platformer: ["Celeste", "Hollow Knight", "Super Mario Odyssey"],
  horror: ["Resident Evil 4", "Amnesia", "Outlast"],
  mmorpg: ["World of Warcraft", "Final Fantasy XIV", "Elder Scrolls Online"],
  roguelike: ["Hades", "Dead Cells", "Slay the Spire"],
  sandbox: ["Minecraft", "Terraria", "Valheim"],
  default: ["Stardew Valley", "Hades", "Among Us"],
};

// ============================================================
// Helper functions
// ============================================================

/**
 * TASK-1.17: Infer primary genre + subgenres from idea keywords.
 *
 * Поддержка primary + subgenres: "Action RPG with roguelike elements" →
 *   { primary: "action", subgenres: ["rpg", "roguelike"] }
 *
 * Алгоритм:
 *   1. Считаем keyword-совпадения для каждого жанра.
 *   2. Primary = жанр с макс. совпадениями.
 *   3. Subgenres = остальные жанры с совпадениями (отсортированы по убыванию score).
 *   4. Если ничего не совпало — primary="action", subgenres=[].
 *
 * Limit: максимум 3 subgenres (чтобы не раздувать набор механик).
 */
function inferGenres(idea: string): { primary: string; subgenres: string[] } {
  const lower = idea.toLowerCase();
  const scores = new Map<string, number>();

  for (const entry of GENRE_KEYWORDS) {
    const matches = entry.keywords.filter((kw) => lower.includes(kw)).length;
    if (matches > 0) {
      scores.set(entry.genre, (scores.get(entry.genre) || 0) + matches);
    }
  }

  if (scores.size === 0) {
    return { primary: "action", subgenres: [] };
  }

  // Сортируем по убыванию score.
  const sorted = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
  const primary = sorted[0][0];
  // Максимум 3 subgenres, чтобы не раздувать набор механик.
  const subgenres = sorted.slice(1, 4).map(([g]) => g);

  return { primary, subgenres };
}

/** Backward compatibility wrapper — возвращает только primary жанр. */
function inferGenre(idea: string): string {
  return inferGenres(idea).primary;
}

function pickAesthetics(genre: string, idea: string) {
  const base = GENRE_AESTHETICS[genre] || GENRE_AESTHETICS.default;
  // Slight customization based on idea keywords
  const lower = idea.toLowerCase();
  let primary = base.primary;
  if (lower.includes("story") || lower.includes("narrative")) primary = "narrative";
  if (lower.includes("explore") || lower.includes("discover")) primary = "discovery";
  if (lower.includes("build") || lower.includes("create")) primary = "expression";
  if (lower.includes("team") || lower.includes("friends")) primary = "fellowship";

  return {
    primary,
    secondary: base.secondary,
    tertiary: base.tertiary,
  };
}

function deriveDynamics(aestheticProfile: {
  primary: string;
  secondary: string;
  tertiary: string;
}) {
  const core = AESTHETIC_TO_DYNAMICS[aestheticProfile.primary] || ["feedback_loops"];
  const sec = AESTHETIC_TO_DYNAMICS[aestheticProfile.secondary] || ["exploration"];
  const tert = AESTHETIC_TO_DYNAMICS[aestheticProfile.tertiary] || ["habit_loops"];

  // Supporting dynamics = secondary + tertiary dynamics (deduplicated)
  const supporting = Array.from(new Set([...sec, ...tert]));

  // Emergence potential — depends on number of distinct dynamics
  const totalDynamics = core.length + supporting.length;
  let emergence: string = "moderate";
  if (totalDynamics >= 7) emergence = "strong";
  else if (totalDynamics >= 5) emergence = "moderate";
  else if (totalDynamics >= 3) emergence = "weak";
  else emergence = "none";

  return {
    core_dynamics: core,
    supporting_dynamics: supporting,
    emergence_potential: emergence,
    rationale: `Core dynamics derive from primary aesthetic "${aestheticProfile.primary}" (${core.join(", ")}). Supporting dynamics come from secondary "${aestheticProfile.secondary}" and tertiary "${aestheticProfile.tertiary}" aesthetics.`,
  };
}

/**
 * TASK-1.17/1.18: buildMechanicSet теперь принимает primary + subgenres.
 *
 * - Использует buildMechanicSetForGenres() для multi-genre поиска.
 * - Cross-genre механики помечаются в результате (cross_genre: true).
 * - Каждая механика в категориях получает флаг `cross_genre` для UI.
 */
function buildMechanicSet(
  primaryGenre: string,
  subgenres: string[],
  forbiddenMechanics: string[]
) {
  // Используем MechanicsDB с поддержкой multi-genre + cross-genre mechanics.
  const allGenres = [primaryGenre, ...subgenres];
  const dbResult = buildMechanicSetForGenres(allGenres, forbiddenMechanics, {
    crossGenreRatio: 0.18, // 18% механик из других жанров
    targetTotal: 12,
    perGroup: 2,
  });

  // Set cross-genre mechanic names для пометки в категориях.
  const crossGenreNames = new Set(dbResult.cross_genre_mechanics.map((m) => m.name));

  // Маппим группы MechanicsDB на 5 категорий концепции
  const groupMap: Record<string, string> = {
    "Базовые": "base",
    "Боевые": "combat",
    "Прогрессия": "progression",
    "Пространство": "spatial",
    "Экономика": "social",
    "Движение": "spatial",
    "Социальные": "social",
    "Выживание": "base",
    "Стелс": "combat",
    "Навыки": "progression",
    "Время": "base",
    "Территория": "spatial",
    "Сюжет": "social",
    "Информация": "base",
    "Мета": "progression",
  };

  const categories: Record<string, Array<{ name: string; group: string; desc?: string; cross_genre?: boolean; matched_genres?: string[] }>> = {
    base: [],
    combat: [],
    progression: [],
    spatial: [],
    social: [],
  };

  for (const [groupName, mechanics] of Object.entries(dbResult.groups)) {
    const category = groupMap[groupName] || "base";
    for (const m of mechanics) {
      const isCrossGenre = crossGenreNames.has(m.name);
      // Какие из переданных жанров релевантны этой механике.
      const matchedGenres = allGenres.filter((g) =>
        m.genres.includes(g.toLowerCase().replace(/\s+/g, "_"))
      );
      categories[category].push({
        name: m.name,
        group: groupName,
        desc: m.desc,
        cross_genre: isCrossGenre || undefined,
        matched_genres: matchedGenres.length > 0 ? matchedGenres : undefined,
      });
    }
  }

  // Fallback: если категория пуста, берём из default
  for (const [cat, list] of Object.entries(categories)) {
    if (list.length === 0) {
      const templates = GENRE_MECHANICS.default;
      const key = cat as keyof typeof templates;
      categories[cat] = templates[key].map((name: string) => ({ name, group: cat }));
    }
  }

  const total = Object.values(categories).reduce((sum, arr) => sum + arr.length, 0);

  // Synergies (from MechanicsDB data) — включаем cross-genre synergie.
  const crossGenreSynergy = dbResult.cross_genre_mechanics.length > 0
    ? dbResult.cross_genre_mechanics.map((m) => ({
        name: `${m.name} (cross-genre: ${m.genres.slice(0, 2).join(", ")}) ↔ primary aesthetic`,
        score: 0.65,
      }))
    : [];

  const synergies = [
    { name: `${categories.progression[0]?.name || "progression"} ↔ ${categories.combat[0]?.name || "combat"}`, score: 0.85 },
    { name: `${categories.base[0]?.name || "base"} ↔ ${categories.spatial[0]?.name || "spatial"}`, score: 0.72 },
    ...crossGenreSynergy,
  ];

  const conflicts = forbiddenMechanics.length > 0
    ? [`Removed ${forbiddenMechanics.length} forbidden mechanic(s): ${forbiddenMechanics.join(", ")}`]
    : [];

  return {
    base: categories.base,
    combat: categories.combat,
    progression: categories.progression,
    spatial: categories.spatial,
    social: categories.social,
    total_count: total,
    conflicts_resolved: conflicts,
    synergies_detected: synergies,
    compatibility_score: dbResult.compatibility_score,
    mechanics_db_source: dbResult.source,
    cross_genre_mechanics: dbResult.cross_genre_mechanics.map((m) => ({
      name: m.name,
      group: m.group,
      desc: m.desc,
      original_genres: m.genres,
      matched_aesthetics: m.aesthetics,
    })),
    genres_searched: allGenres,
  };
}

function buildCoreLoopCandidates(genre: string, mechanicSet: {
  base: Array<{ name: string }>;
  combat: Array<{ name: string }>;
  progression: Array<{ name: string }>;
}) {
  const baseName = mechanicSet.base[0]?.name || "explore";
  const combatName = mechanicSet.combat[0]?.name || "engage";
  const progName = mechanicSet.progression[0]?.name || "upgrade";

  // Loop type by genre
  const loopTypeByGenre: Record<string, string> = {
    action: "engine",
    shooter: "engine",
    platformer: "engine",
    rpg: "economy",
    strategy: "economy",
    mmorpg: "economy",
    horror: "ecology",
    survival_horror: "ecology",
    roguelike: "hybrid",
    adventure: "hybrid",
    sandbox: "ecology",
  };
  const loopType = loopTypeByGenre[genre] || "hybrid";

  return [
    {
      name: `${genre.charAt(0).toUpperCase() + genre.slice(1)} Core Loop`,
      steps: [
        `Explore the world`,
        `Encounter enemies`,
        `Engage in ${combatName}`,
        `Collect rewards`,
        `Upgrade via ${progName}`,
      ],
      loop_type: loopType,
      fun_check_reasoning:
        "30-second fun test: each step has immediate feedback and visible progress",
      estimated_duration_seconds: 45,
    },
    {
      name: "Combat-Focused Loop",
      steps: [
        `Find target`,
        `Plan approach (${baseName})`,
        `Execute ${combatName}`,
        `Loot drops`,
        `Return to base`,
      ],
      loop_type: loopType === "ecology" ? "hybrid" : "engine",
      fun_check_reasoning:
        "Combat-centric loop rewards aggressive play with immediate loot feedback",
      estimated_duration_seconds: 30,
    },
    {
      name: "Progression-First Loop",
      steps: [
        `Set a goal (${progName})`,
        `Gather resources (${baseName})`,
        `Engage threats (${combatName})`,
        `Bank progress`,
        `Unlock next tier`,
      ],
      loop_type: loopType === "engine" ? "hybrid" : loopType,
      fun_check_reasoning:
        "Progression-first loop emphasizes long-term goals with short-term engagement",
      estimated_duration_seconds: 60,
    },
  ];
}

function buildUSPCandidates(genre: string, idea: string) {
  // TASK-1.10 FIXED: slice boundaries now use safe fallbacks for short ideas.
  // Original bug: idea.slice(0, 100/200/300) produced empty/duplicate USPs when idea was short.
  // Now: each USP derives a distinct aspect from idea (origin, mechanic, theme) with min-length guards.

  // Extract first 2-3 "core verbs" from the idea (lowercased) — used for USP #3.
  const lower = idea.toLowerCase();
  const coreVerbs = lower
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !["the", "and", "for", "with", "that", "this"].includes(w))
    .slice(0, 2)
    .join(" ");
  const verbPhrase = coreVerbs.length >= 3 ? coreVerbs : "explore and survive";

  // Safe idea excerpt: never empty, always meaningful (min 20 chars).
  const ideaExcerpt = (maxLen: number, offset = 0) => {
    const slice = idea.slice(offset, offset + maxLen).trim();
    if (slice.length < 20) {
      // Idea too short for a meaningful slice — use full idea with ellipsis style.
      return idea.trim().length > 0 ? idea.trim() : "an unexplored concept";
    }
    return slice + (idea.length > offset + maxLen ? "…" : "");
  };

  // Detect theme keywords for thematic USP
  const themeKeywords = ["dark", "light", "future", "past", "dream", "war", "peace", "magic", "tech", "nature"];
  const detectedTheme = themeKeywords.find((k) => lower.includes(k));
  const themePhrase = detectedTheme
    ? `the "${detectedTheme}" theme`
    : "an unconventional aesthetic direction";

  const candidates = [
    {
      usp: `A ${genre} game where every decision reshapes the world — combining "${ideaExcerpt(60)}" with emergent narrative consequences.`,
      triangle_of_weirdness_check: "pass" as const,
      competitive_differentiation:
        "No competitor merges player agency with persistent world mutation at this scale.",
    },
    {
      usp: `Hybrid ${genre} experience blending traditional mechanics with novel systems derived from "${ideaExcerpt(50)}".`,
      triangle_of_weirdness_check: "warn" as const,
      competitive_differentiation:
        "Differentiator is mechanical fusion; similar genre games lack this hybrid layer.",
    },
    {
      usp: `Narrative-driven ${genre} where the core verb is "${verbPhrase}" and the experience leans on ${themePhrase} — players experience story through gameplay, not cutscenes.`,
      triangle_of_weirdness_check: "pass" as const,
      competitive_differentiation:
        "Ludonarrative harmony creates a distinct identity vs. story-light competitors.",
    },
  ];
  return candidates;
}

function buildValidationReport(
  aestheticProfile: { primary: string; secondary: string; tertiary: string },
  mechanicSet: { total_count: number; compatibility_score: number },
  uspCandidates: Array<{ triangle_of_weirdness_check: string }>
) {
  // TASK-1.2 FIXED: cascade now works correctly after TASK-1.1 (genres filled).
  // - `credible` was always false because compatibility_score was always 0.
  // - Now compatibility_score reflects real genre match (0-100), so:
  //     * credible = true when ≥60% mechanics match the genre
  //     * five_questions["Why would a player return tomorrow?"] reflects real sustainability
  //     * eight_filters.feasibility.score varies 0.5-0.8 based on real compatibility
  //     * warnings["Mechanic compatibility below 60%"] only fires when truly low
  //
  // NOTE: TASK-1.3 (8 idea filters with real logic) and TASK-1.4 (5 core questions
  // with real logic) are still TODO — some scores remain hardcoded (clarity=0.8,
  // market_fit=0.6, emotional_impact=0.7, sustainability=0.65). Will be addressed
  // in subsequent refactoring sprints.

  // --- Triangle of Weirdness ---
  const weird = uspCandidates.some((c) => c.triangle_of_weirdness_check === "pass");
  const appealing = aestheticProfile.primary !== "submission";
  const credible = mechanicSet.compatibility_score >= 60;
  const triangleScore = Number(
    ((weird ? 0.4 : 0.2) + (appealing ? 0.3 : 0.1) + (credible ? 0.3 : 0.1)).toFixed(2)
  );
  const trianglePassed = triangleScore >= 0.6;

  // --- 5 core questions ---
  // TASK-1.4 TODO: questions 1, 2 are hardcoded true — should derive from idea analysis.
  const fiveQuestions: Record<string, boolean> = {
    "What is the core verb?": true,
    "What does the player do moment-to-moment?": true,
    "What long-term goal drives the player?": mechanicSet.total_count >= 5,
    "Where does the fun come from?": appealing,
    "Why would a player return tomorrow?": credible,
  };

  // --- 8 idea filters ---
  const eightFilters: Record<string, { score: number; reason: string; improvement: string }> = {
    clarity: {
      score: 0.8,
      reason: "Core idea is expressible in one sentence",
      improvement: "Sharpen the verb-noun form of the pitch",
    },
    novelty: {
      score: weird ? 0.85 : 0.55,
      reason: weird ? "Multiple novel angles detected" : "Familiar genre conventions dominate",
      improvement: "Add one truly weird angle (per Triangle of Weirdness)",
    },
    feasibility: {
      score: credible ? 0.8 : 0.5,
      reason: credible ? "Mechanic set is implementable with given scope" : "Mechanic count too low or incompatible",
      improvement: "Reduce scope or add a clear MVP slice",
    },
    audience_fit: {
      score: appealing ? 0.85 : 0.5,
      reason: appealing ? "Aesthetic aligns with target motivations" : "Primary aesthetic may not pull target audience",
      improvement: "Re-pick primary aesthetic to match audience",
    },
    market_fit: {
      score: 0.6,
      reason: "Genre has competition but viable niche",
      improvement: "Identify 2-3 direct competitors and define differentiation",
    },
    differentiation: {
      score: weird ? 0.8 : 0.5,
      reason: weird ? "USP candidates propose clear differentiation" : "USP candidates need a stronger weird angle",
      improvement: "Push the USP triangle further toward 'weird'",
    },
    emotional_impact: {
      score: 0.7,
      reason: "Aesthetic profile promises an emotional journey",
      improvement: "Map aesthetic to specific emotion beats in the campaign",
    },
    sustainability: {
      score: 0.65,
      reason: "Core loop has replay potential via progression mechanics",
      improvement: "Add meta-loop or live-ops hook",
    },
  };

  const overallScore = Number(
    (
      triangleScore * 0.3 +
      (Object.values(fiveQuestions).filter(Boolean).length / 5) * 0.3 +
      (Object.values(eightFilters).reduce((s, f) => s + f.score, 0) /
        Object.keys(eightFilters).length) *
        0.4
    ).toFixed(3)
  );

  const warnings: string[] = [];
  if (!credible) warnings.push("Mechanic compatibility below 60% — review synergies");
  if (!appealing) warnings.push("Primary aesthetic is 'submission' — may not pull casual audience");
  if (!weird) warnings.push("No USP passed the Triangle of Weirdness — push for a stranger angle");

  const suggestions: string[] = [
    "Run a 5-minute paper prototype to validate the core verb",
    "Define 3 direct competitors and articulate one concrete differentiator",
    "Map aesthetic profile to specific moments in the player journey",
  ];

  return {
    triangle_check: {
      passed: trianglePassed,
      score: triangleScore,
      details: `Weird=${weird}, Appealing=${appealing}, Credible=${credible}`,
      weird,
      appealing,
      credible,
    },
    five_questions: fiveQuestions,
    eight_filters: eightFilters,
    overall_score: overallScore,
    warnings,
    suggestions,
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
    const idea = (body?.idea as string | undefined)?.trim() || "";
    const explicitGenre =
      body?.genre && typeof body.genre === "string" && body.genre.trim()
        ? body.genre.trim()
        : null;

    if (!idea || idea.length < 10) {
      return VALIDATION_ERROR(
        "Поле 'idea' обязательно и должно быть не менее 10 символов"
      );
    }

    const targetAudience = body?.target_audience as
      | { primary?: string[]; experience?: string }
      | null;
    const platforms = Array.isArray(body?.platform) ? body.platform : null;
    const constraints = body?.constraints as
      | { team_size?: number; budget?: string }
      | null;
    const referenceGames = Array.isArray(body?.reference_games)
      ? body.reference_games
      : null;
    const forbiddenMechanics = Array.isArray(body?.forbidden_mechanics)
      ? body.forbidden_mechanics
      : [];
    const useAi = body?.use_ai === true || body?.use_ai === "true";

    // TASK-1.17: Поддержка явных subgenres в body.
    // Body может содержать `subgenres: string[]` для явного указания поджанров.
    // Если не указано — subgenres выводятся из idea keywords (inferGenres).
    const explicitSubgenres = Array.isArray(body?.subgenres)
      ? body.subgenres
          .filter((g: unknown) => typeof g === "string" && g.trim().length > 0)
          .map((g: string) => g.trim())
          .slice(0, 3) // максимум 3 subgenres
      : null;

    // --- Stage 1: Genre inference (primary + subgenres) ---
    // TASK-1.17: inferGenres возвращает { primary, subgenres }.
    // Если explicitGenre указан — используем его как primary, subgenres из explicit или inferred.
    let primaryGenre: string;
    let subgenres: string[];
    if (explicitGenre) {
      primaryGenre = explicitGenre;
      subgenres = explicitSubgenres ?? inferGenres(idea).subgenres;
    } else {
      const inferred = inferGenres(idea);
      primaryGenre = inferred.primary;
      subgenres = explicitSubgenres ?? inferred.subgenres;
    }
    // Backward compat: `genre` используется в后续 stages.
    const genre = primaryGenre;

    // --- Resolve project (auto-select most recent) ---
    const owned = await getOwnedProject(user, projectId);
    if (owned instanceof NextResponse) return owned;
    const proj = owned.project as {
      id: string;
      name: string;
      description: string | null;
      genre: string | null;
    };

    // --- Stage 2: Aesthetic profile ---
    const aestheticSelection = pickAesthetics(genre, idea);
    const aestheticProfile = {
      primary: aestheticSelection.primary,
      secondary: aestheticSelection.secondary,
      tertiary: aestheticSelection.tertiary,
      rationale: `Primary aesthetic "${aestheticSelection.primary}" matches genre "${genre}"${subgenres.length > 0 ? ` with subgenres [${subgenres.join(", ")}]` : ""} and idea emphasis. Secondary/tertiary chosen to broaden the player experience.`,
    };

    // --- Stage 3: Dynamics profile ---
    const dynamicsProfile = deriveDynamics(aestheticProfile);

    // --- Stage 4: Mechanic set (TASK-1.17/1.18: primary + subgenres + cross-genre) ---
    const mechanicSet = buildMechanicSet(primaryGenre, subgenres, forbiddenMechanics);

    // --- Stage 5: Core loop + USP candidates ---
    const coreLoopCandidates = buildCoreLoopCandidates(genre, mechanicSet);
    const uspCandidates = buildUSPCandidates(genre, idea);

    // --- Stage 6: Validation report ---
    const validationReport = buildValidationReport(
      aestheticProfile,
      mechanicSet,
      uspCandidates
    );

    // --- Stage 7: One-pager assembly ---
    const experience = targetAudience?.experience || "midcore";
    const motivations = targetAudience?.primary?.length
      ? targetAudience.primary.join(", ")
      : "challenge, discovery, fantasy";
    const targetAudienceStr = `${experience}; motivations: ${motivations}`;
    const platformsStr = platforms?.length ? platforms.join(", ") : "PC";

    let storySynopsis = `In "${proj.name || "Untitled Project"}", the player steps into a ${genre} world inspired by: ${idea}. The core conflict revolves around the player's ${aestheticSelection.primary} drive, set against a backdrop where ${dynamicsProfile.core_dynamics.join(", ")} shape every encounter. As the player progresses, ${dynamicsProfile.supporting_dynamics.join(", ")} emerge, creating a layered experience that rewards both short-term mastery and long-term investment.`;

    let gameplayDescription = `Core gameplay revolves around a ${coreLoopCandidates[0].loop_type} loop of ${coreLoopCandidates[0].steps.length} steps: ${coreLoopCandidates[0].steps.join(" → ")}. The mechanic set spans ${mechanicSet.total_count} mechanics across 5 groups (base, combat, progression, spatial, social) with a compatibility score of ${mechanicSet.compatibility_score}%. Players target the ${experience} audience segment on ${platformsStr}.`;

    let uniqueFeatures = uspCandidates.map(
      (c, i) => `USP #${i + 1}: ${c.usp}`
    );

    const competitors = GENRE_COMPETITORS[genre] || GENRE_COMPETITORS.default;

    // Rating from aesthetic (submission/horror → M; challenge/fantasy → T; etc.)
    const ratingByAesthetic: Record<string, string> = {
      submission: "M",
      sensation: "T",
      challenge: "T",
      fantasy: "T",
      narrative: "T",
      fellowship: "E10+",
      discovery: "E10+",
      expression: "E",
    };
    const rating = ratingByAesthetic[aestheticProfile.primary] || "T";

    const latencyMs = Date.now() - startedAt;
    const stagesCompleted = [1, 2, 3, 4, 5, 6, 7];

    // --- Optional AI enrichment (use_ai flag) ---
    let aiEnrichment: { insights?: string; enriched: boolean } = { enriched: false };
    if (useAi) {
      const enrichment = await enrichConcept({
        idea,
        genre,
        projectName: proj.name || "Untitled",
        aesthetics: [aestheticProfile.primary, aestheticProfile.secondary, aestheticProfile.tertiary].filter(Boolean) as string[],
      });
      if (enrichment) {
        storySynopsis = enrichment.story_synopsis;
        gameplayDescription = enrichment.gameplay_description;
        if (enrichment.unique_features.length > 0) {
          uniqueFeatures = enrichment.unique_features;
        }
        aiEnrichment = { insights: enrichment.ai_insights, enriched: true };
      }
    }

    const result = {
      id: proj.id,
      title: `${proj.name || "Untitled"} — ${genre.toUpperCase()}${subgenres.length > 0 ? `+${subgenres.join("+")}` : ""} Concept`,
      genre,
      // TASK-1.17: primary + subgenres в response.
      primary_genre: primaryGenre,
      subgenres,
      target_audience: targetAudienceStr,
      story_synopsis: storySynopsis,
      gameplay_description: gameplayDescription,
      unique_features: uniqueFeatures,
      competitors,
      rating,
      aesthetic_profile: aestheticProfile,
      dynamics_profile: dynamicsProfile,
      mechanic_set: mechanicSet,
      core_loop_candidates: coreLoopCandidates,
      usp_candidates: uspCandidates,
      validation_report: validationReport,
      status: "completed",
      generation_metadata: {
        stages_completed: stagesCompleted,
        latency_ms: latencyMs,
        models_used: useAi && aiEnrichment.enriched
          ? ["deterministic-concept-v1", "rule-based-mda", "shell-lens-lite", "glm-4.6 (ai-enrichment)"]
          : ["deterministic-concept-v1", "rule-based-mda", "shell-lens-lite"],
        ai_enriched: aiEnrichment.enriched,
        ai_insights: aiEnrichment.insights || undefined,
      },
    };

    // --- Persist ---
    const inputData = JSON.stringify({
      idea,
      genre: explicitGenre,
      // TASK-1.17: сохраняем subgenres для последующей загрузки.
      primary_genre: primaryGenre,
      subgenres,
      target_audience: targetAudience,
      platform: platforms,
      constraints,
      reference_games: referenceGames,
      forbidden_mechanics: forbiddenMechanics,
    });

    const onePagerData = JSON.stringify({
      title: result.title,
      genre,
      target_audience: targetAudienceStr,
      rating,
      story_synopsis: storySynopsis,
      gameplay_description: gameplayDescription,
      unique_features: uniqueFeatures,
      competitors,
    });

    await db.projectConcept.upsert({
      where: { projectId: proj.id },
      create: {
        projectId: proj.id,
        genre,
        primaryAesthetic: aestheticProfile.primary,
        usp: uspCandidates[0]?.usp || null,
        inputData,
        onePagerData,
        aestheticProfile: JSON.stringify(aestheticProfile),
        dynamicsProfile: JSON.stringify(dynamicsProfile),
        mechanicSet: JSON.stringify(mechanicSet),
        validationReport: JSON.stringify(validationReport),
        uspCandidates: JSON.stringify(uspCandidates),
        coreLoopCandidates: JSON.stringify(coreLoopCandidates),
      },
      update: {
        genre,
        primaryAesthetic: aestheticProfile.primary,
        usp: uspCandidates[0]?.usp || null,
        inputData,
        onePagerData,
        aestheticProfile: JSON.stringify(aestheticProfile),
        dynamicsProfile: JSON.stringify(dynamicsProfile),
        mechanicSet: JSON.stringify(mechanicSet),
        validationReport: JSON.stringify(validationReport),
        uspCandidates: JSON.stringify(uspCandidates),
        coreLoopCandidates: JSON.stringify(coreLoopCandidates),
      },
    });

    await updateProjectStage(proj.id, "concept");

    return NextResponse.json(result);
  } catch (error) {
    console.error("[concept/generate] error:", error);
    return SERVER_ERROR();
  }
}
