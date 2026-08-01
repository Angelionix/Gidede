/**
 * Gidede — Unified mechanic namespace (Block 1/2/3, roadmap R4-07).
 *
 * Introduces a single `MechanicRef` wire type that flows through Concept →
 * Core Loop → MDA stages, carrying a stable ASCII `id`, the display `name`,
 * the MechanicsDB `group`, a canonical 5-bucket `category`, and a `source`
 * provenance tag.
 *
 * Before R4-07, three ad-hoc namespaces coexisted and were mixed at runtime:
 *   - MechanicsDB Russian names (e.g. "Изучение мира") — no id field.
 *   - English snake_case from GENRE_MECHANICS.default / DYNAMICS_TO_MECHANICS
 *     / GENRE_DEFAULT_MECHANICS (e.g. "map_exploration", "health_damage").
 *   - English verbs from deriveMechanicsFromIdea (e.g. "combat", "explore").
 *
 * Stage 3 (MDA) tried to re-categorise mechanics by regex-matching the NAME,
 * which silently failed on Cyrillic input (every Russian name fell into the
 * "base" bucket). R4-07 fixes this by canonicalising the category ONCE at
 * Stage 1 and reading it from the ref at Stage 3.
 *
 * ID generation: MechanicsDB mechanics get a deterministic transliterated
 * slug (e.g. "Изучение мира" → "izuchenie_mira"). This is stable, unique and
 * ASCII-safe without requiring a hand-curated English name for each of the
 * 128 entries. The MDA-internal English namespace (DYNAMICS_TO_MECHANICS etc.)
 * remains separate and is explicitly tagged `source: "dynamics_to_mechanics"`.
 */

import type { Mechanic } from "@/lib/mechanics-db";

/** Canonical 5-bucket category used across Concept/Core Loop/MDA. */
export type MechanicCategory = "base" | "combat" | "progression" | "spatial" | "social";

/** Where a mechanic ref originated. */
export type MechanicSource =
  | "mechanics_db"
  | "dynamics_to_mechanics"
  | "genre_default"
  | "request"
  | "fallback";

/**
 * Unified wire format for a mechanic reference flowing between pipeline
 * stages. The `id` is the primary join key; `name` is display-only.
 */
export interface MechanicRef {
  /** Stable ASCII snake_case ID (e.g. "izuchenie_mira"). Primary join key. */
  id: string;
  /** Display name (Russian for MechanicsDB, English for MDA-internal). */
  name: string;
  /** MechanicsDB group (Russian, e.g. "Базовые") — empty for non-DB sources. */
  group: string;
  /** Canonical 5-bucket category. */
  category: MechanicCategory;
  /** Provenance tag. */
  source: MechanicSource;
}

/** Russian Cyrillic → Latin transliteration table (GOST/BGN-style). */
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
  я: "ya",
};

/**
 * Transliterate a Russian string to Latin and slugify it into a stable
 * ASCII snake_case ID. Non-Cyrillic characters are kept as-is.
 *
 * Examples:
 *   "Изучение мира" → "izuchenie_mira"
 *   "Броня"         → "bronya"
 *   "Очки опыта"    → "ochki_opyta"
 */
export function slugifyMechanicId(name: string): string {
  const lower = name.toLowerCase().trim();
  let out = "";
  for (const ch of lower) {
    if (TRANSLIT[ch] !== undefined) {
      out += TRANSLIT[ch];
    } else if (/[a-z0-9]/.test(ch)) {
      out += ch;
    } else if (/\s|-|_|\//.test(ch)) {
      out += "_";
    }
    // other characters are dropped
  }
  // Collapse multiple underscores and trim leading/trailing.
  out = out.replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  return out || "mechanic";
}

/**
 * Canonical 5-bucket category from a MechanicsDB group (Russian).
 *
 * Consolidates the duplicated group→category maps that previously existed in
 * `concept/generate/route.ts` (groupMap) and `mda/constants.ts`
 * (categorizeMechanic regex). Single source of truth.
 */
const GROUP_TO_CATEGORY: Record<string, MechanicCategory> = {
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

export function categoryOfGroup(group: string): MechanicCategory {
  return GROUP_TO_CATEGORY[group] ?? "base";
}

/**
 * Categorise a mechanic NAME by keyword regex. Used ONLY as a fallback when
 * no MechanicsDB group is available (e.g. for MDA-internal English IDs from
 * DYNAMICS_TO_MECHANICS). MechanicsDB mechanics should use `categoryOfGroup`
 * via their `group` field.
 *
 * This is the same logic as the legacy `categorizeMechanic` in
 * `src/lib/mda/constants.ts`, preserved for backward compatibility with
 * MDA-internal mechanic IDs that have no group.
 */
export function categoryOfName(mechanicName: string): MechanicCategory {
  const lower = mechanicName.toLowerCase();
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
 * Convert a MechanicsDB `Mechanic` to a `MechanicRef`.
 * The `id` is generated deterministically from the name via transliteration.
 */
export function toMechanicRef(
  mechanic: Mechanic,
  source: MechanicSource = "mechanics_db",
): MechanicRef {
  return {
    id: slugifyMechanicId(mechanic.name),
    name: mechanic.name,
    group: mechanic.group,
    category: categoryOfGroup(mechanic.group),
    source,
  };
}

/**
 * Build a `MechanicRef` from a raw name string (used for non-MechanicsDB
 * mechanics like MDA-internal IDs or request-supplied names). The `id` is
 * slugified from the name; `group` is empty; `category` is derived from the
 * name via keyword regex (since no group is available).
 */
export function refFromName(
  name: string,
  source: MechanicSource,
): MechanicRef {
  const trimmed = name.trim();
  return {
    id: slugifyMechanicId(trimmed),
    name: trimmed,
    group: "",
    category: categoryOfName(trimmed),
    source,
  };
}

/**
 * Coerce an unknown input (string, MechanicRef, or {name, group?} object)
 * into a `MechanicRef`. Used by pipeline stages that receive mechanics from
 * heterogeneous sources (request body, persisted concept output, etc.).
 */
export function coerceToMechanicRef(
  input: unknown,
  defaultSource: MechanicSource,
): MechanicRef | null {
  if (!input) return null;
  if (typeof input === "string") {
    return refFromName(input, defaultSource);
  }
  if (typeof input === "object" && !Array.isArray(input)) {
    const obj = input as Record<string, unknown>;
    // Already a MechanicRef?
    if (typeof obj.id === "string" && typeof obj.name === "string" && typeof obj.category === "string") {
      return {
        id: obj.id,
        name: obj.name as string,
        group: typeof obj.group === "string" ? obj.group : "",
        category: obj.category as MechanicCategory,
        source: typeof obj.source === "string" ? (obj.source as MechanicSource) : defaultSource,
      };
    }
    // {name, group?} object (MechanicsDB entry shape)?
    if (typeof obj.name === "string") {
      const name = obj.name as string;
      const group = typeof obj.group === "string" ? (obj.group as string) : "";
      return {
        id: typeof obj.id === "string" ? (obj.id as string) : slugifyMechanicId(name),
        name,
        group,
        category: group ? categoryOfGroup(group) : categoryOfName(name),
        source: defaultSource,
      };
    }
  }
  return null;
}

/**
 * Extract a stable `id` from any mechanic-like input. Returns the slugified
 * name when no id is present. Returns "" for falsy input.
 */
export function mechanicIdOf(input: unknown): string {
  if (!input) return "";
  if (typeof input === "string") return slugifyMechanicId(input);
  if (typeof input === "object" && !Array.isArray(input)) {
    const obj = input as Record<string, unknown>;
    if (typeof obj.id === "string" && obj.id.trim()) return obj.id.trim();
    if (typeof obj.name === "string") return slugifyMechanicId(obj.name);
  }
  return "";
}
