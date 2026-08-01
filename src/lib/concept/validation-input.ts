/**
 * Gidede — Concept input validation (Block 1, TASK-1.15).
 *
 * Валидация входных данных для /concept/generate.
 *
 * Проверки:
 *   - idea: длина 10-2000 символов
 *   - genre: если передан, должен быть из known list (с alias normalisation)
 *   - subgenres: каждый должен быть из known list (с alias normalisation)
 *   - forbidden_mechanics: aliases нормализуются
 *   - target_audience: опциональная структура
 *   - platforms: опциональный массив
 *   - constraints: опциональная структура
 *
 * Возвращает либо { valid: true, normalized } либо { valid: false, error }.
 */

// Known genres из GENRE_AESTHETICS (src/app/api/v1/concept/generate/route.ts).
// Дублируем здесь для независимости от route.ts.
export const KNOWN_GENRES = new Set([
  "action", "platformer", "shooter", "fighting", "stealth", "survival_horror",
  "rhythm", "adventure", "rpg", "action_rpg", "jrpg", "tactical_rpg", "mmorpg",
  "roguelike", "simulation", "strategy", "rts", "tbs", "tower_defense",
  "puzzle", "party", "educational", "racing", "sports", "sandbox", "horror",
  "metroidvania", "idle", "visual_novel",
]);

// Genre aliases: пользователь может написать "shooting" вместо "shooter".
// Нормализуем к canonical genre ID.
const GENRE_ALIASES: Record<string, string> = {
  shooting: "shooter",
  shoot: "shooter",
  fps: "shooter",
  tps: "shooter",
  roleplay: "rpg",
  role_playing: "rpg",
  "role-playing": "rpg",
  tactics: "tactical_rpg",
  tactical: "tactical_rpg",
  td: "tower_defense",
  "tower defense": "tower_defense",
  towerdefense: "tower_defense",
  mmo: "mmorpg",
  online: "mmorpg",
  vn: "visual_novel",
  novel: "visual_novel",
  card: "roguelike",
  deckbuilder: "roguelike",
  "deck builder": "roguelike",
  survival: "survival_horror",
  scary: "horror",
  fear: "horror",
  race: "racing",
  cars: "racing",
  fight: "fighting",
  brawl: "fighting",
  versus: "fighting",
  stealthy: "stealth",
  sneak: "stealth",
  metroid: "metroidvania",
  vania: "metroidvania",
  clicker: "idle",
  incremental: "idle",
  story: "visual_novel",
  narrative: "visual_novel",
};

export function normalizeGenre(input: string): string {
  // TASK-1.15: нормализуем whitespace перед alias lookup.
  // "deck builder" → "deck_builder", "tower defense" → "tower_defense".
  const lower = input.toLowerCase().trim().replace(/\s+/g, "_");
  // Сначала проверяем alias с underscore-ключами.
  if (GENRE_ALIASES[lower]) return GENRE_ALIASES[lower];
  // Также проверяем alias с пробелами (на случай если ключ хранится с пробелом).
  const withSpaces = lower.replace(/_/g, " ");
  if (GENRE_ALIASES[withSpaces]) return GENRE_ALIASES[withSpaces];
  return lower;
}

export function isValidGenre(input: string): boolean {
  return KNOWN_GENRES.has(normalizeGenre(input));
}

export interface ConceptInputValidation {
  valid: boolean;
  error?: string;
  // Normalized values (после alias resolution).
  idea?: string;
  genre?: string | null;
  subgenres?: string[];
  forbiddenMechanics?: string[];
  target_audience?: { primary?: string[]; experience?: string } | null;
  platform?: string[] | null;
  constraints?: { team_size?: number; budget?: string } | null;
  reference_games?: string[] | null;
  use_ai?: boolean;
  project_id?: string;
}

export function validateConceptInput(body: unknown): ConceptInputValidation {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Тело запроса должно быть объектом" };
  }
  const b = body as Record<string, unknown>;

  // --- idea ---
  const rawIdea = typeof b.idea === "string" ? b.idea.trim() : "";
  if (!rawIdea) {
    return { valid: false, error: "Поле 'idea' обязательно" };
  }
  if (rawIdea.length < 10) {
    return {
      valid: false,
      error: `Поле 'idea' должно быть не менее 10 символов (получено ${rawIdea.length})`,
    };
  }
  if (rawIdea.length > 2000) {
    return {
      valid: false,
      error: `Поле 'idea' должно быть не более 2000 символов (получено ${rawIdea.length})`,
    };
  }

  // --- genre (optional) ---
  let genre: string | null = null;
  if (b.genre && typeof b.genre === "string" && b.genre.trim()) {
    const normalized = normalizeGenre(b.genre);
    if (!KNOWN_GENRES.has(normalized)) {
      return {
        valid: false,
        error: `Неизвестный жанр: "${b.genre}". Известные: ${Array.from(KNOWN_GENRES).slice(0, 10).join(", ")}...`,
      };
    }
    genre = normalized;
  }

  // --- subgenres (optional, max 3) ---
  let subgenres: string[] = [];
  if (Array.isArray(b.subgenres)) {
    const rawSubgenres = b.subgenres
      .filter((g: unknown) => typeof g === "string" && g.trim().length > 0)
      .map((g: string) => normalizeGenre(g))
      .filter((g: string) => KNOWN_GENRES.has(g));

    // Dedup (после нормализации).
    subgenres = Array.from(new Set(rawSubgenres)).slice(0, 3);

    // Если были невалидные subgenres, не падаем — просто игнорируем их.
    // Логируем в console для debugging.
    if (b.subgenres.length !== subgenres.length) {
      console.warn(
        `[concept/validate] Некоторые subgenres были невалидны и отфильтрованы:`,
        b.subgenres,
        `→ остались:`,
        subgenres
      );
    }
  }

  // --- forbidden_mechanics (optional) ---
  let forbiddenMechanics: string[] = [];
  if (Array.isArray(b.forbidden_mechanics)) {
    forbiddenMechanics = b.forbidden_mechanics
      .filter((m: unknown) => typeof m === "string" && m.trim().length > 0)
      .map((m: string) => m.trim().toLowerCase())
      .slice(0, 20); // максимум 20 forbidden mechanics
  }

  // --- target_audience (optional) ---
  let target_audience: { primary?: string[]; experience?: string } | null = null;
  if (b.target_audience && typeof b.target_audience === "object") {
    const ta = b.target_audience as { primary?: unknown; experience?: unknown };
    target_audience = {
      primary: Array.isArray(ta.primary)
        ? ta.primary.filter((m: unknown) => typeof m === "string").slice(0, 5) as string[]
        : undefined,
      experience: typeof ta.experience === "string" ? ta.experience : undefined,
    };
  }

  // --- platform (optional) ---
  let platform: string[] | null = null;
  if (Array.isArray(b.platform)) {
    platform = b.platform
      .filter((p: unknown) => typeof p === "string" && p.trim().length > 0)
      .map((p: string) => p.trim().toLowerCase())
      .slice(0, 10);
  }

  // --- constraints (optional) ---
  let constraints: { team_size?: number; budget?: string } | null = null;
  if (b.constraints && typeof b.constraints === "object") {
    const c = b.constraints as { team_size?: unknown; budget?: unknown };
    constraints = {
      team_size: typeof c.team_size === "number" && c.team_size > 0 && c.team_size <= 1000
        ? Math.floor(c.team_size)
        : undefined,
      budget: typeof c.budget === "string" ? c.budget.trim() : undefined,
    };
  }

  // --- reference_games (optional) ---
  let reference_games: string[] | null = null;
  if (Array.isArray(b.reference_games)) {
    reference_games = b.reference_games
      .filter((g: unknown) => typeof g === "string" && g.trim().length > 0)
      .map((g: string) => g.trim())
      .slice(0, 10);
  }

  // --- use_ai (optional) ---
  const use_ai = b.use_ai === true || b.use_ai === "true";

  // --- project_id (optional) ---
  const project_id = typeof b.project_id === "string" ? b.project_id.trim() : undefined;

  return {
    valid: true,
    idea: rawIdea,
    genre,
    subgenres,
    forbiddenMechanics,
    target_audience,
    platform,
    constraints,
    reference_games,
    use_ai,
    project_id,
  };
}
