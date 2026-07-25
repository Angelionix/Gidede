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
import { enrichConcept, generateAestheticProfileViaAI, generateCoreLoopCandidatesViaAI } from "@/lib/ai-service";
import { buildMechanicSetForGenre, MECHANICS_DB, type Mechanic } from "@/lib/mechanics-db";

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
  fighting: { primary: "challenge", secondary: "competition" as unknown as string, tertiary: "expression" },
  stealth: { primary: "challenge", secondary: "discovery", tertiary: "submission" },
  survival_horror: { primary: "challenge", secondary: "narrative", tertiary: "submission" },
  rhythm: { primary: "sensation", secondary: "submission", tertiary: "expression" },
  adventure: { primary: "discovery", secondary: "narrative", tertiary: "fantasy" },
  rpg: { primary: "fantasy", secondary: "narrative", tertiary: "challenge" },
  action_rpg: { primary: "challenge", secondary: "fantasy", tertiary: "narrative" },
  jrpg: { primary: "narrative", secondary: "fantasy", tertiary: "challenge" },
  tactical_rpg: { primary: "challenge", secondary: "strategy" as unknown as string, tertiary: "narrative" },
  mmorpg: { primary: "fellowship", secondary: "challenge", tertiary: "fantasy" },
  roguelike: { primary: "challenge", secondary: "discovery", tertiary: "sensation" },
  simulation: { primary: "submission", secondary: "expression", tertiary: "discovery" },
  strategy: { primary: "challenge", secondary: "discovery", tertiary: "expression" },
  rts: { primary: "challenge", secondary: "fellowship", tertiary: "discovery" },
  tbs: { primary: "challenge", secondary: "discovery", tertiary: "submission" },
  tower_defense: { primary: "challenge", secondary: "strategy" as unknown as string, tertiary: "submission" },
  puzzle: { primary: "challenge", secondary: "discovery", tertiary: "submission" },
  party: { primary: "fellowship", secondary: "sensation", tertiary: "expression" },
  educational: { primary: "discovery", secondary: "challenge", tertiary: "narrative" },
  racing: { primary: "sensation", secondary: "challenge", tertiary: "competition" as unknown as string },
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

function inferGenre(idea: string): string {
  const lower = idea.toLowerCase();
  for (const entry of GENRE_KEYWORDS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.genre;
    }
  }
  return "action";
}

function pickAesthetics(genre: string, idea: string) {
  const base = GENRE_AESTHETICS[genre] || GENRE_AESTHETICS.default;
  const lower = idea.toLowerCase();

  // Analyze the idea text for aesthetic cues. Each aesthetic has EN + RU
  // keywords. Score each aesthetic; the highest scorer becomes primary.
  const aestheticKeywords: Record<string, string[]> = {
    challenge: ["challenge", "difficult", "hard", "skill", "competitive", "mastery", "boss", "elite",
      "вызов", "сложн", "мастер", "навык", "конкурент", "босс", "элит", "хардкор", "скилл"],
    sensation: ["action", "fast", "speed", "visual", "sound", "music", "rhythm", "visceral",
      "экшн", "действие", "быстр", "скорост", "визуал", "звук", "музык", "ритм"],
    fantasy: ["role", "character", "hero", "epic", "adventure", "quest", "power",
      "роль", "персонаж", "герой", "эп", "приключ", "квест", "сила", "фэнтези"],
    narrative: ["story", "narrative", "plot", "character arc", "lore", "dialogue", "cinematic",
      "истори", "сюжет", "наррати", "диалог", "лор", "кино"],
    fellowship: ["team", "friends", "multiplayer", "coop", "co-op", "social", "guild", "raid",
      "команд", "друзь", "кооп", "социальн", "гильд", "рейд", "совмест"],
    discovery: ["explore", "discover", "world", "map", "secret", "mystery", "open world",
      "исслед", "открыв", "мир", "карта", "секрет", "тайн", "открыт"],
    expression: ["build", "create", "craft", "customize", "design", "sandbox", "construct",
      "строй", "создав", "крафт", "кастомиз", "дизайн", "конструир"],
    submission: ["relax", "calm", "zen", "idle", "routine", "flow", "meditative",
      "релакс", "спокой", "дзен", "айдл", "рутина", "поток", "медитат"],
  };

  const scores: Record<string, number> = {};
  for (const [aesthetic, keywords] of Object.entries(aestheticKeywords)) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score += 1;
    }
    if (score > 0) scores[aesthetic] = score;
  }

  // Start from the genre-based defaults
  let primary = base.primary;
  let secondary = base.secondary;
  let tertiary = base.tertiary;

  // If idea-text analysis found a stronger aesthetic than the genre default,
  // promote it to primary and push the old primary down.
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (sorted.length > 0 && sorted[0][1] >= 1) {
    const topAesthetic = sorted[0][0];
    if (topAesthetic !== primary) {
      // Demote: old primary → secondary, old secondary → tertiary
      tertiary = secondary;
      secondary = primary;
      primary = topAesthetic;
    }
    // If there's a second-strongest, use it as secondary (if different)
    if (sorted.length > 1 && sorted[1][1] >= 1 && sorted[1][0] !== primary && sorted[1][0] !== secondary) {
      tertiary = secondary;
      secondary = sorted[1][0];
    }
  }

  return {
    primary,
    secondary,
    tertiary,
    // Include scores for debugging / transparency
    detected_signals: sorted.map(([a, s]) => `${a}(${s})`).join(", ") || "none — using genre defaults",
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

function buildMechanicSet(
  genre: string,
  forbiddenMechanics: string[]
) {
  // Используем MechanicsDB (128 механик из SW.BAND карт) вместо упрощённой таблицы
  const dbResult = buildMechanicSetForGenre(genre, forbiddenMechanics);

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

  const categories: Record<string, Array<{ name: string; group: string; desc?: string }>> = {
    base: [],
    combat: [],
    progression: [],
    spatial: [],
    social: [],
  };

  for (const [groupName, mechanics] of Object.entries(dbResult.groups)) {
    const category = groupMap[groupName] || "base";
    for (const m of mechanics) {
      categories[category].push({ name: m.name, group: groupName, desc: m.desc });
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

  // Synergies (from MechanicsDB data)
  const synergies = [
    { name: `${categories.progression[0]?.name || "progression"} ↔ ${categories.combat[0]?.name || "combat"}`, score: 0.85 },
    { name: `${categories.base[0]?.name || "base"} ↔ ${categories.spatial[0]?.name || "spatial"}`, score: 0.72 },
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
  };
}

/**
 * Build a mechanic set from user-selected mechanic names.
 * Looks up each name in the MechanicsDB to get its group + description,
 * then categorizes into the 5 concept categories using the same group→category
 * mapping as buildMechanicSet. Filters out forbidden mechanics.
 */
function buildMechanicSetFromSelection(
  selected: string[],
  forbiddenMechanics: string[]
) {
  const forbidden = new Set(
    forbiddenMechanics.map((m) => m.toLowerCase())
  );
  const selectedLower = new Set(selected.map((m) => m.toLowerCase()));

  // Find each selected mechanic in the DB
  const found = MECHANICS_DB.filter((m) =>
    selectedLower.has(m.name.toLowerCase())
  ).filter((m) => !forbidden.has(m.name.toLowerCase()));

  const groupMap: Record<string, string> = {
    Базовые: "base",
    Боевые: "combat",
    Прогрессия: "progression",
    Пространство: "spatial",
    Экономика: "social",
    Движение: "spatial",
    Социальные: "social",
    Выживание: "base",
    Стелс: "combat",
    Навыки: "progression",
    Время: "base",
    Территория: "spatial",
    Сюжет: "social",
    Информация: "base",
    Мета: "progression",
  };

  const categories: Record<string, Array<{ name: string; group: string; desc?: string }>> = {
    base: [],
    combat: [],
    progression: [],
    spatial: [],
    social: [],
  };

  for (const m of found) {
    const category = groupMap[m.group] || "base";
    categories[category].push({ name: m.name, group: m.group, desc: m.desc });
  }

  // If a category is empty, leave it empty (user chose not to include any).
  const total = Object.values(categories).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

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
    synergies_detected: [],
    compatibility_score: 1.0,
    mechanics_db_source: "user-selection",
  };
}

// ============================================================
// Idea-text parsing — extract action verbs + key nouns (RU+EN)
// ============================================================

type ActionCategory =
  | "combat"
  | "explore"
  | "gather"
  | "craft"
  | "progress"
  | "trade"
  | "defend"
  | "stealth"
  | "survive"
  | "move";

interface DetectedAction {
  category: ActionCategory;
  verbRu: string;
}

interface DetectedNoun {
  nounRu: string;
  class_: "enemies" | "resources" | "items" | "location" | "rewards" | "skills";
}

const IDEA_VERB_MAP: Array<{ match: string[]; category: ActionCategory; verbRu: string }> = [
  { match: ["сража", "атаков", "бить", "рубить", "крошить", "стреля", "воевать", "убива", "бой ", " бои", "битв"], category: "combat", verbRu: "сражаться" },
  { match: ["fight", "attack", "kill", "shoot", "slash", "smash", "battle", "combat", "warrior"], category: "combat", verbRu: "сражаться" },
  { match: ["исследов", "изуч", "открыв", "искать", "найти", "бродить", "ходить", "развед"], category: "explore", verbRu: "исследовать" },
  { match: ["explore", "discover", "search", "investigate", "navigate"], category: "explore", verbRu: "исследовать" },
  { match: ["собирать", "добыва", "собрать", "собират", "копать", "соберит", "собира"], category: "gather", verbRu: "собирать" },
  { match: ["gather", "collect", "mine", "harvest", "forage", "scavenge"], category: "gather", verbRu: "собирать" },
  { match: ["варить", "крафтить", "создава", "делать", "строить", "конструир", "кузнить", "варит", "производ", "скрафт", "созда"], category: "craft", verbRu: "создавать" },
  { match: ["craft", "build", "make", "forge", "create", "construct", "brew", "cook"], category: "craft", verbRu: "создавать" },
  { match: ["прокачив", "прокачать", "развива", "улучшать", "апгрейд", "повышать", "открыва", "развив"], category: "progress", verbRu: "прокачивать" },
  { match: ["upgrade", "level up", "level", "progress", "grow", "evolve", "improve", "ascend"], category: "progress", verbRu: "прокачивать" },
  { match: ["торговать", "покупать", "продавать", "обменивать", "торговл", "обмен"], category: "trade", verbRu: "торговать" },
  { match: ["trade", "buy", "sell", "barter", "merchant"], category: "trade", verbRu: "торговать" },
  { match: ["защищать", "оборонять", "охранять", "удерживать", "защит", "оборон", "защища"], category: "defend", verbRu: "защищать" },
  { match: ["defend", "protect", "guard", "hold", "fortify"], category: "defend", verbRu: "защищать" },
  { match: ["прятаться", "скрываться", "красться", "убегать", "избегать", "прячь", "скрывай", "крадись"], category: "stealth", verbRu: "скрываться" },
  { match: ["hide", "sneak", "escape", "avoid", "stealth", "lurk"], category: "stealth", verbRu: "скрываться" },
  { match: ["выживать", "переживать", "не умереть", "выжить", "выживан"], category: "survive", verbRu: "выживать" },
  { match: ["survive", "endure", "outlast"], category: "survive", verbRu: "выживать" },
  { match: ["прыгать", "бегать", "лететь", "мчаться", "скользить", "беги"], category: "move", verbRu: "перемещаться" },
  { match: ["jump", "run", "fly", "dash", "race", "slide"], category: "move", verbRu: "перемещаться" },
];

const IDEA_NOUN_MAP: Array<{ match: string[]; nounRu: string; class_: DetectedNoun["class_"] }> = [
  { match: ["монстр", "враг", "босс", "противник", "нежить", "дракон", "орк", "зомби", "скелет", "демон", "призрак", "рас"], nounRu: "монстры", class_: "enemies" },
  { match: ["monster", "enemy", "boss", "foe", "dragon", "orc", "zombie", "skeleton", "demon", "ghost", "creature"], nounRu: "монстры", class_: "enemies" },
  { match: ["ингредиент", "ресурс", "материал", "трав", "руд", "минерал", "цвет", "гриб", "кристалл", "патрон", "лут"], nounRu: "ингредиенты", class_: "resources" },
  { match: ["ingredient", "resource", "material", "herb", "ore", "mineral", "flower", "mushroom", "crystal"], nounRu: "ингредиенты", class_: "resources" },
  { match: ["зель", "оружи", "брон", "артефакт", "посох", "меч", "лук", "щит", "шлем", "патрон"], nounRu: "предметы", class_: "items" },
  { match: ["potion", "weapon", "armor", "artifact", "staff", "sword", "bow", "shield"], nounRu: "предметы", class_: "items" },
  { match: ["подземель", "лабиринт", "мир", "карт", "замок", "пещер", "башн", "город", "лес", "пустын", "остров", "пространств", "галактик", "космос"], nounRu: "мир", class_: "location" },
  { match: ["dungeon", "labyrinth", "world", "map", "castle", "cave", "tower", "city", "forest", "desert", "island"], nounRu: "мир", class_: "location" },
  { match: ["опыт", "золот", "очков", "наград", "лут", "сокровищ"], nounRu: "награды", class_: "rewards" },
  { match: ["xp", "gold", "points", "reward", "loot", "treasure"], nounRu: "награды", class_: "rewards" },
  { match: ["навык", "умени", "способност", "класс", "персонаж", "геро", "алхим", "маги", "меч", "стрел", "фракци", "рас", "колдун", "рыцар", "воин", "маг "], nounRu: "навыки", class_: "skills" },
  { match: ["skill", "ability", "class", "character", "hero", "alchemy", "magic", "archer"], nounRu: "навыки", class_: "skills" },
];

// Default noun forms (Russian accusative / dative / genitive by class)
const NOUN_DEFAULTS: Record<DetectedNoun["class_"], { nom: string; acc: string; dat: string; gen: string }> = {
  enemies: { nom: "враги", acc: "врагов", dat: "врагам", gen: "врагов" },
  resources: { nom: "ресурсы", acc: "ресурсы", dat: "ресурсам", gen: "ресурсов" },
  items: { nom: "предметы", acc: "предметы", dat: "предметам", gen: "предметов" },
  location: { nom: "мир", acc: "мир", dat: "миру", gen: "мира" },
  rewards: { nom: "награды", acc: "награды", dat: "наградам", gen: "наград" },
  skills: { nom: "навыки", acc: "навыки", dat: "навыкам", gen: "навыков" },
};

function parseIdeaForActions(idea: string): {
  actions: DetectedAction[];
  nouns: DetectedNoun[];
} {
  const lower = " " + idea.toLowerCase() + " ";

  // Match a stem ONLY when it appears at the start of a word (preceded by a
  // non-letter character). This prevents false-positives like "орк" matching
  // inside "морковки". Uses Unicode-aware \p{L} (any letter).
  const startsWord = (stem: string): boolean => {
    try {
      const re = new RegExp(`(?:^|[^\\p{L}])${escapeRegex(stem)}`, "u");
      return re.test(lower);
    } catch {
      // Fallback for environments without /u flag support
      return lower.includes(stem);
    }
  };

  const actions: DetectedAction[] = [];
  const seenCat = new Set<ActionCategory>();
  for (const entry of IDEA_VERB_MAP) {
    const matchedStem = entry.match.find((m) => startsWord(m));
    if (matchedStem) {
      if (!seenCat.has(entry.category)) {
        actions.push({ category: entry.category, verbRu: entry.verbRu });
        seenCat.add(entry.category);
      }
    }
  }

  const nouns: DetectedNoun[] = [];
  const seenClass = new Set<DetectedNoun["class_"]>();
  for (const entry of IDEA_NOUN_MAP) {
    const matchedStem = entry.match.find((m) => startsWord(m));
    if (matchedStem) {
      if (!seenClass.has(entry.class_)) {
        // Extract the actual noun word containing this stem from the idea
        // text — keeps the user's exact terminology («зелья», «монстрами»,
        // «подземелье») instead of generic class labels.
        let wordMatch: string | null = null;
        try {
          const re = new RegExp(`(?:^|[^\\p{L}])\\p{L}*${escapeRegex(matchedStem)}\\p{L}*`, "u");
          const m = idea.match(re);
          if (m && m[0]) {
            // Strip leading non-letter (space or punctuation) if present
            wordMatch = m[0].replace(/^[^\p{L}]+/u, "");
          }
        } catch {
          wordMatch = matchedStem;
        }
        const nounRu = wordMatch || entry.nounRu;
        nouns.push({ nounRu, class_: entry.class_ });
        seenClass.add(entry.class_);
      }
    }
  }

  return { actions, nouns };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nounForm(
  nouns: DetectedNoun[],
  class_: DetectedNoun["class_"],
  case_: "nom" | "acc" | "dat" | "gen"
): string {
  const found = nouns.find((n) => n.class_ === class_);
  if (found && found.nounRu) {
    // Prefer the user's actual word from the idea text. The detected word
    // may already be in a context-appropriate grammatical case (since users
    // write phrases like «сражаться с монстрами» where «монстрами» is
    // already dative). To handle this gracefully, we return the word as-is.
    return found.nounRu;
  }
  return NOUN_DEFAULTS[class_][case_];
}

function buildStepFromAction(
  action: DetectedAction,
  nouns: DetectedNoun[]
): string {
  switch (action.category) {
    case "combat":
      return `Сразиться с ${nounForm(nouns, "enemies", "dat")}`;
    case "explore":
      return `Исследовать ${nounForm(nouns, "location", "acc")}`;
    case "gather":
      return `Собрать ${nounForm(nouns, "resources", "acc")}`;
    case "craft":
      return `Создать ${nounForm(nouns, "items", "acc")}`;
    case "progress":
      return `Прокачать ${nounForm(nouns, "skills", "acc")}`;
    case "trade":
      return `Обменять ${nounForm(nouns, "items", "acc")}`;
    case "defend":
      return `Защитить ${nounForm(nouns, "location", "acc")}`;
    case "stealth":
      return `Скрыться от ${nounForm(nouns, "enemies", "gen")}`;
    case "survive":
      return `Пережить столкновение с ${nounForm(nouns, "enemies", "dat")}`;
    case "move":
      return `Перемещаться по ${nounForm(nouns, "location", "dat")}`;
    default:
      return action.verbRu;
  }
}

// Genre → fallback actions when idea doesn't yield enough verbs
const GENRE_FALLBACK_ACTIONS: Record<string, DetectedAction[]> = {
  action: [
    { category: "combat", verbRu: "сражаться" },
    { category: "move", verbRu: "перемещаться" },
    { category: "progress", verbRu: "прокачивать" },
  ],
  shooter: [
    { category: "combat", verbRu: "сражаться" },
    { category: "move", verbRu: "перемещаться" },
    { category: "progress", verbRu: "прокачивать" },
  ],
  rpg: [
    { category: "explore", verbRu: "исследовать" },
    { category: "combat", verbRu: "сражаться" },
    { category: "progress", verbRu: "прокачивать" },
    { category: "trade", verbRu: "торговать" },
  ],
  strategy: [
    { category: "gather", verbRu: "собирать" },
    { category: "defend", verbRu: "защищать" },
    { category: "combat", verbRu: "сражаться" },
    { category: "progress", verbRu: "прокачивать" },
  ],
  roguelike: [
    { category: "explore", verbRu: "исследовать" },
    { category: "combat", verbRu: "сражаться" },
    { category: "gather", verbRu: "собирать" },
    { category: "progress", verbRu: "прокачивать" },
  ],
  horror: [
    { category: "explore", verbRu: "исследовать" },
    { category: "stealth", verbRu: "скрываться" },
    { category: "survive", verbRu: "выживать" },
  ],
  survival_horror: [
    { category: "explore", verbRu: "исследовать" },
    { category: "stealth", verbRu: "скрываться" },
    { category: "survive", verbRu: "выживать" },
  ],
  sandbox: [
    { category: "gather", verbRu: "собирать" },
    { category: "craft", verbRu: "создавать" },
    { category: "explore", verbRu: "исследовать" },
  ],
  puzzle: [
    { category: "explore", verbRu: "исследовать" },
    { category: "craft", verbRu: "создавать" },
    { category: "progress", verbRu: "прокачивать" },
  ],
};

function getEffectiveActions(
  idea: string,
  genre: string
): { actions: DetectedAction[]; nouns: DetectedNoun[] } {
  const { actions, nouns } = parseIdeaForActions(idea);

  // Need at least 3 distinct action categories to build varied loops.
  // Supplement from genre defaults when the idea is too sparse.
  if (actions.length < 3) {
    const fallback = GENRE_FALLBACK_ACTIONS[genre] || GENRE_FALLBACK_ACTIONS.action;
    const seen = new Set(actions.map((a) => a.category));
    for (const a of fallback) {
      if (!seen.has(a.category)) {
        actions.push(a);
        seen.add(a.category);
      }
      if (actions.length >= 4) break;
    }
  }

  return { actions, nouns };
}

function buildCoreLoopCandidates(
  idea: string,
  genre: string,
  mechanicSet: {
    base: Array<{ name: string }>;
    combat: Array<{ name: string }>;
    progression: Array<{ name: string }>;
  }
) {
  const { actions, nouns } = getEffectiveActions(idea, genre);
  const baseName = mechanicSet.base[0]?.name || "explore";
  const combatName = mechanicSet.combat[0]?.name || "combat";
  const progName = mechanicSet.progression[0]?.name || "progression";
  void baseName;
  void combatName;
  void progName;

  // Build a step lookup by category so we can compose different loops
  const stepByCat = (cat: ActionCategory): string => {
    const a = actions.find((x) => x.category === cat);
    return a ? buildStepFromAction(a, nouns) : buildStepFromAction({ category: cat, verbRu: cat }, nouns);
  };

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

  // Loop 1 — aggressive / combat-focused
  // Tight 4-step loop centred on the core verb of conflict
  const aggressiveSteps: string[] = [];
  const aggressiveCats: ActionCategory[] = ["combat", "gather", "progress"];
  for (const cat of aggressiveCats) aggressiveSteps.push(stepByCat(cat));
  aggressiveSteps.push(`Получить ${nounForm(nouns, "rewards", "acc")}`);

  // Loop 2 — methodical / progression-focused
  // 5-step loop emphasising preparation and growth
  const methodicalSteps: string[] = [];
  const methodicalCats: ActionCategory[] = ["explore", "gather", "craft", "progress"];
  for (const cat of methodicalCats) methodicalSteps.push(stepByCat(cat));
  methodicalSteps.push(`Получить ${nounForm(nouns, "rewards", "acc")}`);

  // Loop 3 — hybrid / creative
  // 6-step emergent loop mixing all key actions of the idea
  const hybridSteps: string[] = [];
  const hybridCats: ActionCategory[] = ["explore", "gather", "craft", "combat", "progress"];
  for (const cat of hybridCats) {
    if (actions.some((a) => a.category === cat) || hybridCats.indexOf(cat) < 3) {
      hybridSteps.push(stepByCat(cat));
    }
  }
  // Ensure at least 4 steps
  if (hybridSteps.length < 4) hybridSteps.push(stepByCat("progress"));
  hybridSteps.push(`Получить ${nounForm(nouns, "rewards", "acc")}`);

  return [
    {
      name: `Боевой цикл (${loopType})`,
      steps: aggressiveSteps,
      loop_type: loopType,
      fun_check_reasoning:
        "Каждый шаг даёт немедленную обратную связь: столкновение → добыча → рост — 30 секунд веселья держатся на адреналине боя.",
      estimated_duration_seconds: 35,
    },
    {
      name: `Методичный цикл (${loopType === "ecology" ? "hybrid" : loopType})`,
      steps: methodicalSteps,
      loop_type: loopType === "ecology" ? "hybrid" : loopType,
      fun_check_reasoning:
        "Цикл вознаграждает планирование: разведка → заготовка → создание → прокачка — fun держится на чувстве роста и контроля.",
      estimated_duration_seconds: 50,
    },
    {
      name: `Гибридный цикл (${loopType === "engine" ? "hybrid" : loopType})`,
      steps: hybridSteps,
      loop_type: loopType === "engine" ? "hybrid" : loopType,
      fun_check_reasoning:
        "Эмерджентный цикл смешивает все ключевые действия идеи — игрок выбирает порядок, что создаёт разнообразие и приятную непредсказуемость.",
      estimated_duration_seconds: 60,
    },
  ];
}

function buildUSPCandidates(idea: string, genre: string) {
  // Generate 3 USP candidates derived from idea's unique content.
  // We extract "signature phrases" (2-4 word chunks) from the idea that are
  // most likely to be the differentiating mechanic/setting. Each USP uses a
  // different angle (mechanical / narrative / experience) but all are anchored
  // in the actual idea text — not a template.

  const trimmed = idea.trim();
  // Split the idea into clause-fragments on common separators
  const fragments = trimmed
    .split(/[,;:.()\-—]+|\bи\b|\bгде\b|\bчтобы\b|\bно\b|\band\b|\bwhere\b|\bto\b|\bbut\b/i)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4 && s.length <= 80);

  // Pick the 3 most "specific" fragments — prefer ones that mention
  // uncommon verbs/nouns (longer Russian words = more specific).
  const scored = fragments.map((f) => {
    const words = f.split(/\s+/).filter((w) => w.length >= 4);
    // Score = average word length (longer = more specific)
    const avgLen = words.length === 0 ? 0 : words.reduce((s, w) => s + w.length, 0) / words.length;
    return { frag: f, score: avgLen };
  });
  scored.sort((a, b) => b.score - a.score);
  const signature = scored.slice(0, 3).map((s) => s.frag);

  // Fallbacks if idea parsing yielded too few fragments
  const ideaSnippet = (n: number) =>
    trimmed.length > n ? trimmed.slice(0, n).trim() + "…" : trimmed;

  const sig1 = signature[0] || ideaSnippet(50);
  const sig2 = signature[1] || ideaSnippet(40);
  const sig3 = signature[2] || ideaSnippet(60);

  const candidates = [
    {
      usp: `«${genre}»-игра, где ключевой механикой становится «${sig1}» — игрок постоянно делает осмысленный выбор между риском и безопасностью, что проходит Triangle of Weirdness.`,
      triangle_of_weirdness_check: "pass" as const,
      competitive_differentiation:
        `В отличие от других ${genre}-игр, здесь «${sig1}» встроено в кор-луп, а не добавлено как побочная активность — это формирует уникальную идентичность продукта.`,
    },
    {
      usp: `Гибридный ${genre}-опыт, в котором «${sig2}» сплетается с эмерджентной динамикой — каждый заход в игру рождает новую игровую ситуацию.`,
      triangle_of_weirdness_check: "warn" as const,
      competitive_differentiation:
        `Конкуренты в жанре используют «${sig2}» линейно (скриптованно), тогда как здесь механика становится источником системной непредсказуемости.`,
    },
    {
      usp: `История через геймплей: игрок проживает «${sig3}» не через кат-сцены, а через действия — лудонарративная гармония становится УТП проекта.`,
      triangle_of_weirdness_check: "pass" as const,
      competitive_differentiation:
        `Большинство ${genre}-игр рассказывают сюжет отдельно от механик; здесь «${sig3}» является одновременно и нарративом, и геймплеем — это создаёт эмоциональную глубину, недоступную конкурентам.`,
    },
  ];
  return candidates;
}

function buildValidationReport(
  aestheticProfile: { primary: string; secondary: string; tertiary: string },
  mechanicSet: { total_count: number; compatibility_score: number },
  uspCandidates: Array<{ triangle_of_weirdness_check: string }>
) {
  // --- Triangle of Weirdness ---
  const weird = uspCandidates.some((c) => c.triangle_of_weirdness_check === "pass");
  const appealing = aestheticProfile.primary !== "submission";
  const credible = mechanicSet.compatibility_score >= 60;
  const triangleScore = Number(
    ((weird ? 0.4 : 0.2) + (appealing ? 0.3 : 0.1) + (credible ? 0.3 : 0.1)).toFixed(2)
  );
  const trianglePassed = triangleScore >= 0.6;

  // --- 5 core questions ---
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
    const selectedMechanics = Array.isArray(body?.selected_mechanics)
      ? body.selected_mechanics.filter((m: unknown) => typeof m === "string").map((m: string) => m.trim()).filter(Boolean)
      : [];
    const useAi = body?.use_ai === true || body?.use_ai === "true";

    // --- Stage 1: Genre inference ---
    const genre = explicitGenre || inferGenre(idea);

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
    // Deterministic baseline from genre + idea keyword analysis.
    const aestheticSelection = pickAesthetics(genre, idea);
    let aestheticProfile = {
      primary: aestheticSelection.primary,
      secondary: aestheticSelection.secondary,
      tertiary: aestheticSelection.tertiary,
      rationale: `Primary aesthetic "${aestheticSelection.primary}" derived from idea-text analysis (signals: ${aestheticSelection.detected_signals}). Genre "${genre}" provides the baseline; idea keywords override when they indicate a stronger aesthetic direction.`,
    };

    // When use_ai is enabled, ask the LLM to produce a richer aesthetic
    // profile based on the actual content of the idea. Falls back to the
    // deterministic version if AI is unavailable or returns invalid data.
    if (useAi) {
      const aiProfile = await generateAestheticProfileViaAI(idea, genre);
      if (aiProfile) {
        aestheticProfile = aiProfile;
      }
    }

    // --- Stage 3: Dynamics profile ---
    const dynamicsProfile = deriveDynamics(aestheticProfile);

    // --- Stage 4: Mechanic set ---
    // If the user hand-picked mechanics, use those; otherwise auto-select
    // from the 128-mechanic MechanicsDB based on genre.
    const mechanicSet =
      selectedMechanics.length > 0
        ? buildMechanicSetFromSelection(selectedMechanics, forbiddenMechanics)
        : buildMechanicSet(genre, forbiddenMechanics);

    // --- Stage 5: Core loop + USP candidates ---
    // Deterministic baseline — parses idea text for action verbs + nouns and
    // builds Russian, idea-specific loop steps (NOT a hardcoded template).
    let coreLoopCandidates = buildCoreLoopCandidates(
      idea,
      genre,
      mechanicSet
    );

    // When use_ai is enabled, ask the LLM to shape the loop candidates
    // from the actual idea content. Falls back to deterministic if AI fails.
    if (useAi) {
      const mechanicNames = [
        ...mechanicSet.base,
        ...mechanicSet.combat,
        ...mechanicSet.progression,
        ...mechanicSet.spatial,
        ...mechanicSet.social,
      ]
        .map((m: { name?: string }) => m.name)
        .filter((n: string | undefined): n is string => Boolean(n))
        .slice(0, 12);

      const aiLoops = await generateCoreLoopCandidatesViaAI(idea, genre, mechanicNames);
      if (aiLoops && aiLoops.length > 0) {
        coreLoopCandidates = aiLoops;
      }
    }

    const uspCandidates = buildUSPCandidates(idea, genre);

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

    // Deterministic baseline for story_synopsis + gameplay_description:
    // Russian text that incorporates the actual idea and the chosen loop
    // steps. AI enrichment (use_ai) replaces these when available.
    const ideaExcerpt = idea.length > 180 ? idea.slice(0, 180).trim() + "…" : idea;
    const coreDynamicsRu = dynamicsProfile.core_dynamics.length > 0
      ? dynamicsProfile.core_dynamics.join(", ")
      : "динамика обратной связи";
    const supportingDynamicsRu = dynamicsProfile.supporting_dynamics.length > 0
      ? dynamicsProfile.supporting_dynamics.join(", ")
      : "эмерджентные взаимодействия";
    const firstLoopSteps = coreLoopCandidates[0]?.steps?.length
      ? coreLoopCandidates[0].steps.join(" → ")
      : "действие → обратная связь → рост";
    const firstLoopType = coreLoopCandidates[0]?.loop_type || "hybrid";

    let storySynopsis = `В «${proj.name || "Безымянный проект"}» (${genre}) игрок попадает в мир, рождённый идеей: ${ideaExcerpt}. Главный конфликт строится вокруг эстетики «${aestheticProfile.primary}»: ${coreDynamicsRu} формируют каждое столкновение. По мере развития появляются ${supportingDynamicsRu}, создавая многослойный опыт, который вознаграждает и краткосрочное мастерство, и долгосрочное вложение.`;

    let gameplayDescription = `Ключевой геймплей — это цикл типа «${firstLoopType}» из ${coreLoopCandidates[0]?.steps?.length || 5} шагов: ${firstLoopSteps}. Механический набор охватывает ${mechanicSet.total_count} механик в 5 группах (base, combat, progression, spatial, social) с совместимостью ${mechanicSet.compatibility_score}%. Целевая аудитория — ${experience} на платформах: ${platformsStr}.`;

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

    // Track whether AI shaped the core loops (separate from AI enrichment text).
    const aiShapedLoops = useAi && coreLoopCandidates.some(
      (c) => typeof c === "object" && c !== null && "fun_check_reasoning" in c
        // AI-generated loops have richer, longer reasoning (heuristic)
        ? (c as { fun_check_reasoning: string }).fun_check_reasoning.length > 80
        : false
    );

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

    const modelsUsed: string[] = ["deterministic-concept-v1", "rule-based-mda", "shell-lens-lite"];
    if (aiShapedLoops) modelsUsed.push("glm-4.6 (core-loop-shaper)");
    if (aiEnrichment.enriched) modelsUsed.push("glm-4.6 (ai-enrichment)");

    const result = {
      id: proj.id,
      title: `${proj.name || "Untitled"} — ${genre.toUpperCase()} Concept`,
      genre,
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
        models_used: modelsUsed,
        ai_enriched: aiEnrichment.enriched || aiShapedLoops,
        ai_insights: aiEnrichment.insights || undefined,
      },
    };

    // --- Persist ---
    const inputData = JSON.stringify({
      idea,
      genre: explicitGenre,
      target_audience: targetAudience,
      platform: platforms,
      constraints,
      reference_games: referenceGames,
      forbidden_mechanics: forbiddenMechanics,
      selected_mechanics: selectedMechanics,
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
