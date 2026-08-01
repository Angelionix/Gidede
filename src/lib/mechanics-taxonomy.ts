/**
 * Gidede — MechanicsDB Taxonomy Levels 0-2 (TASK-1.14).
 *
 * Стратегическое расширение MechanicsDB. Раньше MechanicsDB содержала только
 * Level 3 (128 дискретных механик SW.BAND). Теперь добавлены:
 *
 *   Level 0 — 7 фундаментальных типов Шелла (The Art of Game Design, ch. 5)
 *     Movement, Shooting, Combat, Collection, Building, Talking, Trading
 *
 *   Level 1 — 5 структурных типов Адамса/Дорманс (Game Mechanics, ch. 2)
 *     Space, Objects, Actions, Rules, Skill
 *
 *   Level 2 — 16 паттернов (Bible 2.2.4)
 *     Каждый паттерн связан с фундаментальным типом (Level 0) и
 *     группирует несколько механик Level 3.
 *
 * Level 3 (MechanicsDB) уже существует в mechanics-db.ts (128 механик).
 * Level 4 (жанровые шаблоны) — будущая работа.
 *
 * Использование:
 *   - getLevel0Types() — 7 фундаментальных типов
 *   - getLevel1Types() — 5 структурных типов
 *   - getLevel2Patterns() — 16 паттернов
 *   - getMechanicLevel3ForPattern(patternId) — механики Level 3 для паттерна
 *   - getMechanicHierarchy(mechanicName) — полный путь: L0 → L1 → L2 → L3
 */

// ============================================================
// Level 0: 7 фундаментальных типов Шелла
// ============================================================

export interface Level0Type {
  id: string;
  name: string;
  nameEn: string;
  desc: string;
  // Связанные структурные типы Level 1
  level1Ids: string[];
}

export const LEVEL_0_TYPES: Level0Type[] = [
  {
    id: "movement",
    name: "Движение",
    nameEn: "Movement",
    desc: "Перемещение игрока или объектов в игровом пространстве. Фундамент для исследования, уклонения, позиционирования.",
    level1Ids: ["space", "actions"],
  },
  {
    id: "shooting",
    name: "Стрельба",
    nameEn: "Shooting",
    desc: "Метательное поражение целей на расстоянии. Основа шутеров, twin-stick, bullet hell.",
    level1Ids: ["actions", "skill"],
  },
  {
    id: "combat",
    name: "Бой",
    nameEn: "Combat",
    desc: "Ближний контактный бой: удары, блоки, парирования. Основа файтингов, action RPG, soulslike.",
    level1Ids: ["actions", "skill"],
  },
  {
    id: "collection",
    name: "Сбор",
    nameEn: "Collection",
    desc: "Накопление ресурсов, предметов, очков. Основа puzzle, idle, коллекционных игр.",
    level1Ids: ["objects", "rules"],
  },
  {
    id: "building",
    name: "Строительство",
    nameEn: "Building",
    desc: "Создание структур, систем, баз. Основа sandbox, RTS, симуляторов.",
    level1Ids: ["objects", "rules"],
  },
  {
    id: "talking",
    name: "Разговор",
    nameEn: "Talking",
    desc: "Социальное взаимодействие: диалоги, переговоры, репутация. Основа RPG, visual novels, social sims.",
    level1Ids: ["actions", "rules"],
  },
  {
    id: "trading",
    name: "Торговля",
    nameEn: "Trading",
    desc: "Обмен ресурсами между игроком и системой или между игроками. Основа экономических игр, MMORPG, tycoon.",
    level1Ids: ["objects", "rules"],
  },
];

// ============================================================
// Level 1: 5 структурных типов Адамса/Дорманс
// ============================================================

export interface Level1Type {
  id: string;
  name: string;
  nameEn: string;
  desc: string;
  level0Ids: string[]; // обратная связь с Level 0
}

export const LEVEL_1_TYPES: Level1Type[] = [
  {
    id: "space",
    name: "Пространство",
    nameEn: "Space",
    desc: "Игровое пространство: discrete/continuous grid, topology, boundaries. Где происходит игра.",
    level0Ids: ["movement"],
  },
  {
    id: "objects",
    name: "Объекты",
    nameEn: "Objects",
    desc: "Сущности в пространстве: player avatar, enemies, resources, props. Имеют attributes и states.",
    level0Ids: ["collection", "building", "trading"],
  },
  {
    id: "actions",
    name: "Действия",
    nameEn: "Actions",
    desc: "Что игрок может делать: move, attack, collect, build, talk. Привязаны к verbs и verbs к mechanics.",
    level0Ids: ["movement", "shooting", "combat", "talking"],
  },
  {
    id: "rules",
    name: "Правила",
    nameEn: "Rules",
    desc: "Законы игры: что можно/нельзя, как считаются очки, win/lose conditions. Определяют meaning of actions.",
    level0Ids: ["collection", "building", "talking", "trading"],
  },
  {
    id: "skill",
    name: "Навык",
    nameEn: "Skill",
    desc: "Требуемый от игрока навык: физическая координация, стратегическое мышление, тактическая адаптация.",
    level0Ids: ["shooting", "combat"],
  },
];

// ============================================================
// Level 2: 16 паттернов
// ============================================================

export interface Level2Pattern {
  id: string;
  name: string;
  nameEn: string;
  desc: string;
  level0Id: string; // родительский фундаментальный тип
  // MechanicsDB groups (Level 3) связанные с этим паттерном
  mechanicGroups: string[];
}

export const LEVEL_2_PATTERNS: Level2Pattern[] = [
  // --- Movement patterns ---
  {
    id: "free_roam",
    name: "Свободное перемещение",
    nameEn: "Free Roam",
    desc: "Игрок свободно исследует 2D/3D пространство без линейных ограничений. Open world, metroidvania.",
    level0Id: "movement",
    mechanicGroups: ["Движение", "Пространство"],
  },
  {
    id: "linear_progression",
    name: "Линейное прохождение",
    nameEn: "Linear Progression",
    desc: "Игрок движется по предопределённому пути от старта к финишу. Platformer, runner, on-rails shooter.",
    level0Id: "movement",
    mechanicGroups: ["Движение", "Пространство"],
  },
  {
    id: "tactical_positioning",
    name: "Тактическое позиционирование",
    nameEn: "Tactical Positioning",
    desc: "Позиция в пространстве определяет исход боя/конфликта. XCOM, tactics RPG, MOBA.",
    level0Id: "movement",
    mechanicGroups: ["Движение", "Территория", "Боевые"],
  },

  // --- Shooting patterns ---
  {
    id: "aim_and_shoot",
    name: "Прицеливание и стрельба",
    nameEn: "Aim & Shoot",
    desc: "Игрок прицеливается и стреляет по целям. FPS, TPS, light gun.",
    level0Id: "shooting",
    mechanicGroups: ["Боевые"],
  },
  {
    id: "bullet_hell",
    name: "Bullet Hell",
    nameEn: "Bullet Hell",
    desc: "Игрок уклоняется от плотных потоков снарядов. Touhou, danmaku, bullet heaven (Vampire Survivors).",
    level0Id: "shooting",
    mechanicGroups: ["Боевые", "Движение"],
  },

  // --- Combat patterns ---
  {
    id: "real_time_combat",
    name: "Бой в реальном времени",
    nameEn: "Real-time Combat",
    desc: "Бой без паузы: удары, блоки, уклонения в реальном времени. Action, soulslike, hack & slash.",
    level0Id: "combat",
    mechanicGroups: ["Боевые", "Движение"],
  },
  {
    id: "turn_based_combat",
    name: "Пошаговый бой",
    nameEn: "Turn-based Combat",
    desc: "Бой с пошаговой очередностью: ходы, инициатива, AP. JRPG, tactics, roguelike.",
    level0Id: "combat",
    mechanicGroups: ["Боевые", "Навыки"],
  },
  {
    id: "combo_chaining",
    name: "Цепочки комбо",
    nameEn: "Combo Chaining",
    desc: "Последовательности атак образуют комбо с bonus эффектами. Fighting, character action, rhythm.",
    level0Id: "combat",
    mechanicGroups: ["Боевые", "Время"],
  },

  // --- Collection patterns ---
  {
    id: "resource_gathering",
    name: "Сбор ресурсов",
    nameEn: "Resource Gathering",
    desc: "Игрок собирает ресурсы для крафта/торговли/прогрессии. Survival, farming, idle.",
    level0Id: "collection",
    mechanicGroups: ["Экономика", "Базовые"],
  },
  {
    id: "loot_collection",
    name: "Сбор лута",
    nameEn: "Loot Collection",
    desc: "Случайные награды из врагов/сундуков. ARPG, roguelike, looter shooter.",
    level0Id: "collection",
    mechanicGroups: ["Экономика", "Боевые"],
  },
  {
    id: "collection_completion",
    name: "Коллекционное завершение",
    nameEn: "Collection Completion",
    desc: "Игрок собирает набор предметов для completion. Pokemon, collectathon, achievement hunter.",
    level0Id: "collection",
    mechanicGroups: ["Базовые", "Сюжет"],
  },

  // --- Building patterns ---
  {
    id: "base_building",
    name: "Строительство базы",
    nameEn: "Base Building",
    desc: "Игрок строит и улучшает стационарную базу. RTS, survival, base defense.",
    level0Id: "building",
    mechanicGroups: ["Пространство", "Экономика"],
  },
  {
    id: "crafting_system",
    name: "Система крафта",
    nameEn: "Crafting System",
    desc: "Комбинирование ресурсов в новые предметы. Survival, RPG, sandbox.",
    level0Id: "building",
    mechanicGroups: ["Экономика", "Навыки"],
  },
  {
    id: "world_terraforming",
    name: "Терраформирование мира",
    nameEn: "World Terraforming",
    desc: "Игрок изменяет саму структуру мира. Minecraft, factorio, sandbox god games.",
    level0Id: "building",
    mechanicGroups: ["Пространство", "Прогрессия"],
  },

  // --- Talking patterns ---
  {
    id: "dialogue_trees",
    name: "Диалоговые деревья",
    nameEn: "Dialogue Trees",
    desc: "Выбор реплик в диалоге влияет на отношения/сюжет. RPG, adventure, visual novel.",
    level0Id: "talking",
    mechanicGroups: ["Сюжет", "Социальные"],
  },
  {
    id: "social_deduction",
    name: "Социальная дедукция",
    nameEn: "Social Deduction",
    desc: "Игроки пытаются определить роли/намерения друг друга. Werewolf, Among Us, social deduction.",
    level0Id: "talking",
    mechanicGroups: ["Социальные", "Информация"],
  },

  // --- Trading patterns ---
  {
    id: "market_trading",
    name: "Рыночная торговля",
    nameEn: "Market Trading",
    desc: "Покупка/продажа товаров по рыночным ценам. MMORPG, tycoon, economic sim.",
    level0Id: "trading",
    mechanicGroups: ["Экономика", "Социальные"],
  },
  {
    id: "auction_bidding",
    name: "Аукционная торговля",
    nameEn: "Auction Bidding",
    desc: "Игроки делают ставки на товары. MMORPG auction house, board games, NFT.",
    level0Id: "trading",
    mechanicGroups: ["Экономика", "Мета"],
  },
];

// ============================================================
// Lookup functions
// ============================================================

export function getLevel0Types(): Level0Type[] {
  return LEVEL_0_TYPES;
}

export function getLevel1Types(): Level1Type[] {
  return LEVEL_1_TYPES;
}

export function getLevel2Patterns(): Level2Pattern[] {
  return LEVEL_2_PATTERNS;
}

export function getLevel0Type(id: string): Level0Type | undefined {
  return LEVEL_0_TYPES.find((t) => t.id === id);
}

export function getLevel1Type(id: string): Level1Type | undefined {
  return LEVEL_1_TYPES.find((t) => t.id === id);
}

export function getLevel2Pattern(id: string): Level2Pattern | undefined {
  return LEVEL_2_PATTERNS.find((p) => p.id === id);
}

export function getLevel2PatternsForLevel0(level0Id: string): Level2Pattern[] {
  return LEVEL_2_PATTERNS.filter((p) => p.level0Id === level0Id);
}

export function getTaxonomyStats(): {
  level0Count: number;
  level1Count: number;
  level2Count: number;
} {
  return {
    level0Count: LEVEL_0_TYPES.length,
    level1Count: LEVEL_1_TYPES.length,
    level2Count: LEVEL_2_PATTERNS.length,
  };
}

/**
 * Построить полный путь иерархии для механики Level 3.
 * Возвращает массив { level, type } от Level 0 до Level 2.
 *
 * @param mechanicGroup — группа механики из MechanicsDB (например, "Боевые")
 * @returns массив уровней или пустой массив, если не найдено
 */
export function getMechanicHierarchy(mechanicGroup: string): Array<{
  level: 0 | 1 | 2;
  typeId: string;
  typeName: string;
}> {
  // Найти все Level 2 patterns, у которых mechanicGroups содержит переданную группу.
  const matchingPatterns = LEVEL_2_PATTERNS.filter((p) =>
    p.mechanicGroups.includes(mechanicGroup)
  );

  if (matchingPatterns.length === 0) return [];

  // Берём первый matching pattern (для детерминированности).
  const pattern = matchingPatterns[0];
  const level0 = getLevel0Type(pattern.level0Id);
  if (!level0) return [];

  // Level 1: берём первый из level1Ids паттерна.
  const level1Id = level0.level1Ids[0];
  const level1 = getLevel1Type(level1Id);

  const hierarchy: Array<{ level: 0 | 1 | 2; typeId: string; typeName: string }> = [
    { level: 0, typeId: level0.id, typeName: level0.name },
  ];
  if (level1) {
    hierarchy.push({ level: 1, typeId: level1.id, typeName: level1.name });
  }
  hierarchy.push({ level: 2, typeId: pattern.id, typeName: pattern.name });

  return hierarchy;
}
