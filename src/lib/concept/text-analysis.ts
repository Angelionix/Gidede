import {
  containsTokenSequence,
  countWordOrPhraseMatches,
  hasAnyWordOrPhrase,
  tokenizeUnicodeWords,
} from "@/lib/text/unicode-tokenizer";

export const GENRE_CLASSIFIER_VERSION = "1.0.0" as const;

export interface GenreInference {
  primary: string;
  subgenres: string[];
}

export interface GenreCandidateEvidence {
  genre: string;
  score: number;
  matched_keywords: string[];
}

export interface GenreClassificationEvidence {
  classifier_version: typeof GENRE_CLASSIFIER_VERSION;
  selection_source: "keyword_match" | "explicit" | "fallback_default";
  selected_primary: string;
  selected_subgenres: string[];
  candidates: GenreCandidateEvidence[];
  fallback_reason?: "no_keyword_matches";
}

export interface GenreSelectionOverrides {
  primaryGenre?: string | null;
  subgenres?: readonly string[] | null;
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

export function classifyGenresFromText(idea: string): GenreClassificationEvidence {
  const tokens = tokenizeUnicodeWords(idea);
  const candidates = GENRE_KEYWORDS
    .map((entry, order) => {
      const matchedKeywords = entry.keywords.filter((keyword) =>
        containsTokenSequence(tokens, keyword)
      );
      return {
        genre: entry.genre,
        score: matchedKeywords.length,
        matched_keywords: matchedKeywords,
        order,
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map(({ order: _order, ...candidate }) => candidate);

  if (candidates.length === 0) {
    return {
      classifier_version: GENRE_CLASSIFIER_VERSION,
      selection_source: "fallback_default",
      selected_primary: "action",
      selected_subgenres: [],
      candidates: [],
      fallback_reason: "no_keyword_matches",
    };
  }

  return {
    classifier_version: GENRE_CLASSIFIER_VERSION,
    selection_source: "keyword_match",
    selected_primary: candidates[0].genre,
    selected_subgenres: candidates.slice(1, 4).map(({ genre }) => genre),
    candidates,
  };
}

export function resolveGenreClassification(
  idea: string,
  overrides: GenreSelectionOverrides = {}
): GenreClassificationEvidence {
  const classification = classifyGenresFromText(idea);
  const explicitPrimary = overrides.primaryGenre || null;
  const selectedPrimary = explicitPrimary ?? classification.selected_primary;
  const inferredGenres = classification.candidates.map(({ genre }) => genre);
  const requestedSubgenres = overrides.subgenres
    ? [...overrides.subgenres]
    : explicitPrimary
      ? inferredGenres
      : classification.selected_subgenres;
  const selectedSubgenres = Array.from(new Set(requestedSubgenres))
    .filter((genre) => genre !== selectedPrimary)
    .slice(0, 3);

  return {
    ...classification,
    selection_source: explicitPrimary ? "explicit" : classification.selection_source,
    selected_primary: selectedPrimary,
    selected_subgenres: selectedSubgenres,
    fallback_reason: explicitPrimary ? undefined : classification.fallback_reason,
  };
}

export function inferGenresFromText(idea: string): GenreInference {
  const classification = classifyGenresFromText(idea);
  return {
    primary: classification.selected_primary,
    subgenres: classification.selected_subgenres,
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
