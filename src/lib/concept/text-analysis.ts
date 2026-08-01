import {
  countWordOrPhraseMatches,
  hasAnyWordOrPhrase,
  tokenizeUnicodeWords,
} from "@/lib/text/unicode-tokenizer";

export interface GenreInference {
  primary: string;
  subgenres: string[];
}

const GENRE_KEYWORDS: Array<{ keywords: string[]; genre: string }> = [
  { keywords: ["shooter", "shoot", "gun", "bullet", "fps", "шутер", "стрельба", "оружие", "пуля"], genre: "shooter" },
  { keywords: ["puzzle", "match-3", "logic", "tile", "головоломка", "логика"], genre: "puzzle" },
  { keywords: ["platformer", "jump", "platform", "speedrun", "платформер", "прыжки", "платформа", "спидран"], genre: "platformer" },
  { keywords: ["rpg", "roleplay", "role playing", "quest", "character", "leveling", "рпг", "ролевая игра", "квест", "персонаж", "прокачка"], genre: "rpg" },
  { keywords: ["strategy", "tactic", "rts", "build", "empire", "стратегия", "тактика", "империя"], genre: "strategy" },
  { keywords: ["horror", "scary", "fear", "survival", "хоррор", "страх", "выживание"], genre: "horror" },
  { keywords: ["race", "racing", "car", "speed", "гонка", "гонки", "автомобиль", "скорость"], genre: "racing" },
  { keywords: ["card", "deck", "roguelike", "rogue", "карты", "колода", "рогалик"], genre: "roguelike" },
  { keywords: ["sandbox", "craft", "build", "open world", "песочница", "крафт", "открытый мир"], genre: "sandbox" },
  { keywords: ["tower defense", "td", "wave", "защита башен", "волна"], genre: "tower_defense" },
  { keywords: ["mmo", "online", "raid", "ммо", "онлайн", "рейд"], genre: "mmorpg" },
  { keywords: ["idle", "clicker", "incremental", "кликер", "инкрементальная игра"], genre: "idle" },
  { keywords: ["story", "visual novel", "narrative", "визуальная новелла", "история", "нарратив"], genre: "visual_novel" },
  { keywords: ["fighting", "brawl", "combat", "versus", "файтинг", "драка", "поединок"], genre: "fighting" },
  { keywords: ["stealth", "sneak", "invisible", "стелс", "скрытность", "невидимость"], genre: "stealth" },
  { keywords: ["metroid", "vania", "metroidvania", "метроидвания"], genre: "metroidvania" },
  { keywords: ["rhythm", "music", "beat", "ритм", "музыка", "бит"], genre: "rhythm" },
];

const AESTHETIC_KEYWORDS: Array<{ aesthetic: string; keywords: string[] }> = [
  { aesthetic: "narrative", keywords: ["story", "narrative", "plot", "dialogue", "character driven", "storytelling", "история", "нарратив", "сюжет", "диалог", "персонаж"] },
  { aesthetic: "discovery", keywords: ["explore", "discover", "exploration", "uncover", "find", "search", "исследовать", "исследование", "открывать", "найти"] },
  { aesthetic: "expression", keywords: ["build", "create", "construct", "craft", "design", "customize", "sandbox", "строить", "создавать", "крафтить", "конструировать", "настраивать"] },
  { aesthetic: "fellowship", keywords: ["team", "friends", "co-op", "coop", "cooperative", "multiplayer", "party", "guild", "команда", "друзья", "кооператив", "вместе", "гильдия"] },
  { aesthetic: "challenge", keywords: ["difficult", "hard", "skill", "competitive", "hardcore", "challenge", "сложный", "сложно", "навык", "соревновательный", "хардкор", "вызов"] },
  { aesthetic: "sensation", keywords: ["fast", "speed", "action", "intense", "adrenaline", "thrilling", "быстрый", "скорость", "экшен", "интенсивный", "адреналин"] },
  { aesthetic: "fantasy", keywords: ["roleplay", "role-play", "immersion", "character", "hero", "epic", "роли", "ролевая", "погружение", "герой", "эпический"] },
  { aesthetic: "submission", keywords: ["relax", "calm", "zen", "meditative", "idle", "peaceful", "routine", "расслабиться", "расслабление", "спокойный", "дзен", "медитативный", "мирный"] },
];

const CORE_ACTION_VERBS = [
  "build", "builds", "building", "survive", "survives", "surviving", "explore", "explores", "exploring",
  "fight", "fights", "fighting", "collect", "collects", "collecting", "escape", "escapes", "escaping",
  "defend", "defends", "defending", "conquer", "conquers", "conquering", "solve", "solves", "solving",
  "race", "races", "racing", "craft", "crafts", "crafting", "trade", "trades", "trading",
  "hunt", "hunts", "hunting", "protect", "protects", "protecting", "destroy", "destroys", "destroying",
  "create", "creates", "creating",
  "строить", "строит", "строят", "выживать", "выживает", "выживают", "исследовать", "исследует", "исследуют",
  "сражаться", "сражается", "сражаются", "собирать", "собирает", "собирают", "бежать", "бежит", "бегут",
  "защищать", "защищает", "защищают", "завоевывать", "завоевывает", "завоевывают", "решать", "решает", "решают",
  "крафтить", "крафтит", "крафтят", "торговать", "торгует", "торгуют", "охотиться", "охотится", "охотятся",
  "уничтожать", "уничтожает", "уничтожают", "создавать", "создает", "создают", "планировать", "планирует", "планируют",
  "управлять", "управляет", "управляют", "выбирать", "выбирает", "выбирают", "открывать", "открывает", "открывают",
  "прятаться", "прячется", "прячутся", "запускать", "запускает", "запускают", "связывать", "связывает", "связывают",
  "экономить", "экономит", "экономят", "менять", "меняет", "меняют", "захватывать", "захватывает", "захватывают",
];

export function inferGenresFromText(idea: string): GenreInference {
  const tokens = tokenizeUnicodeWords(idea);
  const scores = new Map<string, number>();

  for (const entry of GENRE_KEYWORDS) {
    const matches = countWordOrPhraseMatches(tokens, entry.keywords);
    if (matches > 0) scores.set(entry.genre, (scores.get(entry.genre) ?? 0) + matches);
  }

  if (scores.size === 0) return { primary: "action", subgenres: [] };

  const sorted = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
  return {
    primary: sorted[0][0],
    subgenres: sorted.slice(1, 4).map(([genre]) => genre),
  };
}

export function rankAestheticsFromText(idea: string): string[] {
  const tokens = tokenizeUnicodeWords(idea);

  return AESTHETIC_KEYWORDS
    .map((entry, order) => ({
      aesthetic: entry.aesthetic,
      order,
      score: countWordOrPhraseMatches(tokens, entry.keywords),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((entry) => entry.aesthetic);
}

export function hasCoreActionVerb(textOrTokens: string | readonly string[]): boolean {
  return hasAnyWordOrPhrase(textOrTokens, CORE_ACTION_VERBS);
}
