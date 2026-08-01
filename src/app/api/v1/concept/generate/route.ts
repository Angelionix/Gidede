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
import { buildValidationReport } from "@/lib/concept/validation";
import { validateConceptInput } from "@/lib/concept/validation-input";
import {
  inferGenresFromText,
  rankAestheticsFromText,
} from "@/lib/concept/text-analysis";
import { getStageAlgorithmMetadata } from "@/lib/algorithm-metadata";
import { assertStageOutput, STAGE_CONTRACT_VERSION, validateStageInput } from "@/lib/contracts/stage-contracts";
import { createArtifactEnvelope } from "@/lib/contracts/artifact-envelope";
import type { FunHypothesis } from "../../../../../../shared/types/typescript/interfaces";

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
  return inferGenresFromText(idea);
}

/**
 * TASK-1.7 + R4-01: pickAesthetics с Unicode word boundaries и dedup.
 *
 * Оригинальные баги:
 *   1. `lower.includes("build")` матчит "deck-building", "building", "rebuild".
 *   2. `lower.includes("team")` матчит "steam".
 *   3. Не проверяет дубликаты с secondary/tertiary (например, "deck-building card battler"
 *      давал primary=expression, secondary=discovery, tertiary=expression — дубликат).
 *
 * Новая реализация:
 *   - Word/phrase matching через общий `Intl.Segmenter`-based tokenizer.
 *   - Dedup: primary не может совпадать с secondary или tertiary.
 *   - Если primary совпадает с secondary/tertiary, fallback к base.primary.
 *   - Поддержка русских и английских keywords без ASCII-only `\b`.
 */
function pickAesthetics(genre: string, idea: string) {
  const base = GENRE_AESTHETICS[genre] || GENRE_AESTHETICS.action;

  const rankedAesthetics = rankAestheticsFromText(idea);

  // Primary = aesthetic с макс. совпадениями (если есть).
  let primary = base.primary;
  if (rankedAesthetics.length > 0) {
    const topAesthetic = rankedAesthetics[0];

    // TASK-1.7: dedup — primary не должен совпадать с secondary или tertiary.
    // Если совпадает, fallback к base.primary (genre-based).
    if (topAesthetic !== base.secondary && topAesthetic !== base.tertiary) {
      primary = topAesthetic;
    }
  }

  // TASK-1.7: если primary после override совпадает с secondary, меняем secondary с primary.
  // Это сохраняет разнообразие aesthetic profile.
  let secondary = base.secondary;
  let tertiary = base.tertiary;
  if (primary === secondary) {
    secondary = base.primary; // меняем местами
  }
  if (primary === tertiary) {
    tertiary = base.primary;
  }
  // Финальная проверка: secondary != tertiary (на всякий случай).
  if (secondary === tertiary) {
    tertiary = "submission"; // безопасный fallback
  }

  return {
    primary,
    secondary,
    tertiary,
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

/**
 * TASK-1.9 FIXED: bilingual core loop candidates.
 *
 * Оригинальный баг: русские имена механик подставлялись в английские глагольные
 * фразы: "Engage in Броня", "Upgrade via Очки опыта" — nonsensical mix.
 *
 * Решение: все шаги core loop на русском, так как:
 *   1. MechanicsDB хранит имена на русском ("Броня", "Очки опыта").
 *   2. System prompt AI на русском.
 *   3. Пользователь — русскоязычный геймдизайнер.
 *
 * Если у механики нет русского имени (legacy fallback), используем английский
 * глагол-заглушку ("исследование", "сражение", "прокачка").
 */
function buildUnverifiedFunHypothesis(statement: string): FunHypothesis {
  return {
    status: "unverified",
    statement,
    test_protocol: {
      duration_seconds: 30,
      minimum_participants: 5,
      task: "Без подсказок выполнить один полный цикл и затем выбрать — повторить его или остановиться.",
      metrics: [
        { id: "loop_completion_rate", description: "Цикл завершён без подсказки.", comparator: ">=", target: 0.8 },
        { id: "voluntary_replay_rate", description: "Участник добровольно начал второй цикл.", comparator: ">=", target: 0.6 },
        { id: "critical_confusion_rate", description: "Участник не понимал следующее действие более 5 секунд.", comparator: "<=", target: 0.2 },
      ],
      decision_rule: "Гипотеза поддержана только если достигнуты пороги всех метрик; иначе она отклонена.",
    },
    evidence: [],
  };
}

function buildCoreLoopCandidates(genre: string, mechanicSet: {
  base: Array<{ name: string }>;
  combat: Array<{ name: string }>;
  progression: Array<{ name: string }>;
}) {
  // Извлекаем имена механик с fallback на русские глаголы.
  const baseName = mechanicSet.base[0]?.name || "исследование";
  const combatName = mechanicSet.combat[0]?.name || "сражение";
  const progName = mechanicSet.progression[0]?.name || "прокачка";

  // Loop type by genre (Bible 4.11.1)
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

  // Локализованное название жанра для имени кандидата.
  const genreLabels: Record<string, string> = {
    action: "Экшен",
    shooter: "Шутер",
    platformer: "Платформер",
    rpg: "RPG",
    strategy: "Стратегия",
    mmorpg: "MMORPG",
    horror: "Хоррор",
    survival_horror: "Survival Horror",
    roguelike: "Roguelike",
    adventure: "Приключение",
    sandbox: "Песочница",
    puzzle: "Головоломка",
    racing: "Гонки",
    fighting: "Файтинг",
    stealth: "Стелс",
    tower_defense: "Tower Defense",
    rhythm: "Ритм",
    metroidvania: "Метроидвания",
    visual_novel: "Визуальная новелла",
    idle: "Idle",
  };
  const genreLabel = genreLabels[genre] || genre.charAt(0).toUpperCase() + genre.slice(1);

  return [
    {
      name: `${genreLabel} — основной цикл`,
      steps: [
        `Исследовать мир`,
        `Встретить противников`,
        `Применить «${combatName}»`,
        `Собрать награды`,
        `Улучшить через «${progName}»`,
      ],
      loop_type: loopType,
      fun_hypothesis: buildUnverifiedFunHypothesis(
        "Игрок поймёт связь исследования, столкновения, награды и улучшения за 30 секунд и захочет повторить цикл.",
      ),
      estimated_duration_seconds: 45,
    },
    {
      name: "Боевой цикл",
      steps: [
        `Найти цель`,
        `Подготовить подход («${baseName}»)`,
        `Атаковать («${combatName}»)`,
        `Собрать добычу`,
        `Вернуться на базу`,
      ],
      loop_type: loopType === "ecology" ? "hybrid" : "engine",
      fun_hypothesis: buildUnverifiedFunHypothesis(
        "Немедленная добыча после боевого действия побудит игрока добровольно выбрать следующую цель.",
      ),
      estimated_duration_seconds: 30,
    },
    {
      name: "Цикл прогрессии",
      steps: [
        `Поставить цель («${progName}»)`,
        `Собрать ресурсы («${baseName}»)`,
        `Отразить угрозы («${combatName}»)`,
        `Сохранить прогресс`,
        `Открыть следующий уровень`,
      ],
      loop_type: loopType === "engine" ? "hybrid" : loopType,
      fun_hypothesis: buildUnverifiedFunHypothesis(
        "Видимый прирост прогресса после короткой задачи побудит игрока начать следующий цикл.",
      ),
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


// ============================================================
// Route handler
// ============================================================

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const body = await request.json().catch(() => ({}));
    const contractInput = validateStageInput("concept", body);
    if (!contractInput.success) return VALIDATION_ERROR(contractInput.error);

    // TASK-1.15: централизованная валидация входных данных.
    // Проверяет: idea (10-2000 символов), genre (known list + aliases),
    // subgenres (known list + aliases + dedup), forbidden_mechanics (max 20).
    const input = validateConceptInput(body);
    if (!input.valid) {
      return VALIDATION_ERROR(input.error || "Невалидные входные данные");
    }

    const projectId = input.project_id;
    const idea = input.idea!;
    const explicitGenre = input.genre;
    const targetAudience = input.target_audience;
    const platforms = input.platform;
    const constraints = input.constraints;
    const referenceGames = input.reference_games;
    const forbiddenMechanics = input.forbiddenMechanics!;
    const useAi = input.use_ai || false;
    const explicitSubgenres = input.subgenres!.length > 0 ? input.subgenres : null;

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
    // TASK-1.3 + TASK-1.4: передаём idea и subgenres для реального анализа.
    const validationReport = buildValidationReport(
      aestheticProfile,
      mechanicSet,
      uspCandidates,
      idea,
      subgenres
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

    const algorithmMetadata = getStageAlgorithmMetadata("concept");
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
      contract_version: STAGE_CONTRACT_VERSION,
      artifact: createArtifactEnvelope("concept", body),
      algorithm_metadata: algorithmMetadata,
      generation_metadata: {
        contract_version: STAGE_CONTRACT_VERSION,
        stages_completed: stagesCompleted,
        latency_ms: latencyMs,
        models_used: useAi && aiEnrichment.enriched
          ? ["deterministic-concept-v1", "rule-based-mda", "shell-lens-lite", "glm-4.6 (ai-enrichment)"]
          : ["deterministic-concept-v1", "rule-based-mda", "shell-lens-lite"],
        ai_enriched: aiEnrichment.enriched,
        ai_insights: aiEnrichment.insights || undefined,
      },
    };

    assertStageOutput("concept", result);

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

    // TASK-1.11: сохраняем generation_metadata и ai_insights в БД.
    // Раньше эти данные возвращались в HTTP response, но НЕ сохранялись —
    // при перезагрузке проекта (GET /concept/[id]) они терялись.
    const generationMetadataJson = JSON.stringify({
      contract_version: STAGE_CONTRACT_VERSION,
      artifact: result.artifact,
      stages_completed: stagesCompleted,
      latency_ms: latencyMs,
      models_used: useAi && aiEnrichment.enriched
        ? ["deterministic-concept-v1", "rule-based-mda", "shell-lens-lite", "glm-4.6 (ai-enrichment)"]
        : ["deterministic-concept-v1", "rule-based-mda", "shell-lens-lite"],
      ai_enriched: aiEnrichment.enriched,
      algorithm_metadata: algorithmMetadata,
    });

    await db.projectConcept.upsert({
      where: { projectId: proj.id },
      create: {
        projectId: proj.id,
        genre,
        // TASK-1.17: сохраняем primary_genre + subgenres.
        subgenre: subgenres.length > 0 ? JSON.stringify(subgenres) : null,
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
        // TASK-1.11: новые поля для persist.
        title: result.title,
        aiInsights: aiEnrichment.insights || null,
        generationMetadata: generationMetadataJson,
      },
      update: {
        genre,
        subgenre: subgenres.length > 0 ? JSON.stringify(subgenres) : null,
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
        // TASK-1.11: новые поля для persist.
        title: result.title,
        aiInsights: aiEnrichment.insights || null,
        generationMetadata: generationMetadataJson,
      },
    });

    await updateProjectStage(proj.id, "concept");

    return NextResponse.json(result);
  } catch (error) {
    console.error("[concept/generate] error:", error);
    return SERVER_ERROR();
  }
}
