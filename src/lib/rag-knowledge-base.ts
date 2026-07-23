/**
 * Gidede — Static RAG knowledge base for game-design concepts.
 *
 * ~15 entries on MDA, core loops, balance, economy, GDD, etc.
 * Simple keyword-overlap scoring (no embeddings).
 */

export interface KnowledgeEntry {
  id: string;
  title: string;
  snippet: string;
  source: string;
  keywords: string[];
}

export const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  {
    id: "mda",
    title: "MDA Framework",
    snippet:
      "MDA (Mechanics, Dynamics, Aesthetics) — формальный подход к анализу игр (Hunicke, LeBlanc, Zubek, 2004). Mechanics — правила, Dynamics — возникающее поведение, Aesthetics — желаемые эмоции игрока.",
    source: "Hunicke, R., LeBlanc, M., Zubek, R. (2004). MDA: A Formal Approach to Game Design and Game Research.",
    keywords: ["mda", "mechanics", "dynamics", "aesthetics", "framework", "framework", "хюник", "леблан", "зубек"],
  },
  {
    id: "core_loop",
    title: "Core Gameplay Loop",
    snippet:
      "Core Loop — центральный цикл действий игрока (например: explore → fight → loot → upgrade). Бывает трёх структурных типов: Engine, Economy, Ecology. Иерархия: inner → core → outer → meta.",
    source: "Adams, E. (2014). Fundamentals of Game Design, 3rd Edition.",
    keywords: ["core loop", "core-loop", "gameplay loop", "цикл", "engine", "economy", "ecology", "внутренний цикл", "outer loop", "meta loop"],
  },
  {
    id: "balance",
    title: "Game Balance",
    snippet:
      "Балансировка — процесс настройки параметров элементов игры (cost, power, utility) для достижения желаемого gameplay. Типы: transitive, intransitive (Rock-Paper-Scissors), mixed. Используются Monte-Carlo симуляции и Nash equilibrium.",
    source: "Schell, J. (2019). The Art of Game Design: A Book of Lenses, 3rd Edition.",
    keywords: ["balance", "баланс", "transitive", "intransitive", "nash", "monte carlo", "cost power", "payoff matrix"],
  },
  {
    id: "economy",
    title: "Game Economy Design",
    snippet:
      "Игровая экономика — модель потоков ресурсов (faucets, drains, conversion chains). Классификация: Engine (генерация), Economy (конвертация), Ecology (конкуренция). Инструмент моделирования — Machinations.",
    source: "Dormans, J. (2012). Engineering Emergence: Applied Theory for Game Design.",
    keywords: ["economy", "экономика", "faucet", "drain", "conversion", "machinations", "resource", "inflation", "ресурс"],
  },
  {
    id: "gdd",
    title: "Game Design Document (GDD)",
    snippet:
      "GDD — документ, описывающий дизайн игры. Форматы: one-sheet (1 стр.), ten-pager (10 стр.), full GDD (полный документ, 21+ секций). Содержит: концепцию, механики, динамику, эстетику, нарратив, баланс, прогрессию, экономику, монетизацию.",
    source: "Moore, M. E., Novak, J. (2010). Game Industry Guide.",
    keywords: ["gdd", "design document", "дизайн документ", "one sheet", "ten pager", "spec", "документация"],
  },
  {
    id: "progression",
    title: "Progression Design",
    snippet:
      "Прогрессия — кривые роста игрока: XP-to-level, level-to-power, level-to-cost, difficulty. Типы кривых: linear, exponential, diminishing, s_curve, intermittent, polynomial. Tier-модель: Onboarding → Foundation → Expansion → Mastery → Endgame.",
    source: "Sirlin, D. (2005). Playing to Win.",
    keywords: ["progression", "прогрессия", "xp", "level", "tier", "curve", "exponential", "linear", "diminishing", "s curve", "endgame", "mastery"],
  },
  {
    id: "ludonarrative",
    title: "Ludonarrative Dissonance",
    snippet:
      "Лудонарративный диссонанс — конфликт между narrativе (что игра рассказывает) и ludus (что игрок делает). Термин введён Clint Hocking (2007) в рецензии на Bioshock. MDA-анализ помогает обнаружить такие конфликты через bond validation.",
    source: "Hocking, C. (2007). Ludonarrative Dissonance in Bioshock.",
    keywords: ["ludonarrative", "лудонарратив", "dissonance", "диссонанс", "narrative", "ludus", "hocking", "bioshock", "bond"],
  },
  {
    id: "aesthetics_8",
    title: "8 Aesthetics (Hunicke)",
    snippet:
      "8 видов эстетического удовольствия: Sensation (сенсорика), Fantasy (фантазия), Narrative (нарратив), Challenge (вызов), Fellowship (товарищество), Discovery (открытие), Expression (выражение), Submission (подчинение / Abnegation).",
    source: "Hunicke, R., LeBlanc, M., Zubek, R. (2004). MDA: A Formal Approach to Game Design and Game Research.",
    keywords: ["aesthetics", "эстетика", "sensation", "fantasy", "narrative", "challenge", "fellowship", "discovery", "expression", "submission", "abnegation"],
  },
  {
    id: "nash",
    title: "Nash Equilibrium",
    snippet:
      "Равновесие Нэша — набор стратегий, при котором ни один игрок не может улучшить результат, изменив только свою стратегию. Используется при анализе intransitive баланса (Rock-Paper-Scissors и подобных).",
    source: "Nash, J. (1950). Equilibrium Points in n-Person Games.",
    keywords: ["nash", "equilibrium", "равновесие", "strategy", "intransitive", "rock paper scissors", "game theory", "теория игр"],
  },
  {
    id: "f2p",
    title: "F2P Monetization",
    snippet:
      "Free-to-Play модель: игра бесплатна, доход от микротранзакций. Ключевые концепции: soft/hard walls, whales/dolphins/minnows, ARPU, LTV, retention curves (D1/D7/D30). Конфликт с relaxed pacing — частая проблема.",
    source: "Luton, W. (2013). Free to Play: Making Money from Games You Give Away.",
    keywords: ["f2p", "free to play", "freemium", "monetization", "монетизация", "whales", "arpu", "ltv", "retention", "wall", "soft lock"],
  },
  {
    id: "pacing",
    title: "Game Pacing",
    snippet:
      "Pacing — темп игры. Три класса: relaxed (медленный, исследовательский), balanced (сбалансированный), intense (быстрый, стрессовый). Влияет на emergence ratio, retention и perceived difficulty.",
    source: "Adams, E. (2014). Fundamentals of Game Design, 3rd Edition.",
    keywords: ["pacing", "темп", "relaxed", "balanced", "intense", "rhythm", "ритм", "perceived difficulty"],
  },
  {
    id: "machinations",
    title: "Machinations Tool",
    snippet:
      "Machinations — визуальный язык и инструмент для моделирования игровой экономики (Joris Dormans). Узлы: pools, gates, converters, traders, end conditions. Связи: resource connections, state connections. Поддерживает стохастические симуляции.",
    source: "Dormans, J. (2012). Machinations: A Visual Language for Game Design.",
    keywords: ["machinations", "pool", "gate", "converter", "trader", "resource connection", "state connection", "feedback loop", "dormans"],
  },
  {
    id: "schell_lenses",
    title: "Schell's Lenses",
    snippet:
      "100+ линз Шелла для анализа игры: Lens of the Player, Lens of Pleasure, Lens of Flow, Lens of Goals, Lens of Skill, Lens of Imagination и т.д. Используется в финальной валидации проекта (алгоритм 3.8).",
    source: "Schell, J. (2019). The Art of Game Design: A Book of Lenses, 3rd Edition.",
    keywords: ["schell", "lens", "линза", "art of game design", "player", "pleasure", "flow", "goals", "skill"],
  },
  {
    id: "flow",
    title: "Flow Theory (Csikszentmihalyi)",
    snippet:
      "Состояние потока — баланс между сложностью задачи и навыком игрока. Слишком легко → скука, слишком сложно → тревога. Используется в дизайне perceived difficulty и pacing. Связано с Lens of Flow Шелла.",
    source: "Csikszentmihalyi, M. (1990). Flow: The Psychology of Optimal Experience.",
    keywords: ["flow", "поток", "csikszentmihalyi", "skill", "challenge", "anxiety", "boredom", "optimal experience"],
  },
  {
    id: "playtest",
    title: "Playtesting Methodology",
    snippet:
      "Плейтестирование — проверка игры на реальных игроках. Виды: blind playtest (без инструкций), heuristic (с чеклистом), telemetry-based (аналитика). Используется для проверки perceived difficulty, retention, monetization.",
    source: "Fullerton, T. (2014). Game Design Workshop, 4th Edition.",
    keywords: ["playtest", "плейтест", "playtesting", "user research", "telemetry", "analytics", "fullerton"],
  },
  {
    id: "usp",
    title: "Unique Selling Proposition (USP)",
    snippet:
      "USP — то, что отличает игру от конкурентов. Triangle check: USP ↔ жанр ↔ audience. Если хотя бы одна сторона не согласована — проект рискует провалиться. Алгоритм 3.1 генерирует несколько USP-кандидатов с differentiation score.",
    source: "Adams, E. (2014). Fundamentals of Game Design, 3rd Edition.",
    keywords: ["usp", "unique selling proposition", "differentiation", "triangle check", "уник", "конкурент"],
  },
];

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s,.;:!?()\-]+/)
    .filter((t) => t.length > 1);
}

/** Score a knowledge entry by keyword overlap with the query. */
function scoreEntry(entry: KnowledgeEntry, queryTokens: string[]): number {
  let score = 0;
  for (const kw of entry.keywords) {
    const kwLower = kw.toLowerCase();
    for (const tok of queryTokens) {
      if (kwLower.includes(tok) || tok.includes(kwLower)) {
        // Longer keyword match = higher score
        score += kwLower.length >= 4 ? 2 : 1;
      }
    }
  }
  // Boost if title tokens overlap
  const titleTokens = tokenize(entry.title);
  for (const tok of queryTokens) {
    if (titleTokens.includes(tok)) score += 3;
  }
  return score;
}

export interface RagResult {
  title: string;
  snippet: string;
  source: string;
  score: number;
}

export function searchKnowledgeBase(
  query: string,
  topK = 5
): { results: RagResult[]; total: number } {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return { results: [], total: 0 };
  }
  const scored = KNOWLEDGE_BASE.map((e) => ({
    entry: e,
    score: scoreEntry(e, tokens),
  }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return {
    results: scored.map((s) => ({
      title: s.entry.title,
      snippet: s.entry.snippet,
      source: s.entry.source,
      score: Number(s.score.toFixed(2)),
    })),
    total: scored.length,
  };
}
