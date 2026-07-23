/**
 * Gidede — Centralized genre taxonomy (Rogers taxonomy, MechanicsDB).
 *
 * DRY: replaces 5+ duplicated GENRES definitions across block pages 1–5.
 * Block 1 had the most complete list (29 items) — that version is canonical.
 */

export interface GenreOption {
  value: string;
  label: string;
}

export const GENRES: GenreOption[] = [
  { value: "action", label: "Action" },
  { value: "platformer", label: "Платформер" },
  { value: "shooter", label: "Шутер" },
  { value: "fighting", label: "Fighting" },
  { value: "stealth", label: "Stealth" },
  { value: "survival_horror", label: "Survival Horror" },
  { value: "rhythm", label: "Rhythm" },
  { value: "adventure", label: "Adventure" },
  { value: "rpg", label: "RPG" },
  { value: "action_rpg", label: "Action RPG" },
  { value: "jrpg", label: "JRPG" },
  { value: "tactical_rpg", label: "Tactical RPG" },
  { value: "mmorpg", label: "MMORPG" },
  { value: "roguelike", label: "Roguelike" },
  { value: "simulation", label: "Симулятор" },
  { value: "strategy", label: "Стратегия" },
  { value: "rts", label: "RTS" },
  { value: "tbs", label: "TBS" },
  { value: "tower_defense", label: "Tower Defense" },
  { value: "puzzle", label: "Квест/Пазл" },
  { value: "party", label: "Party" },
  { value: "educational", label: "Educational" },
  { value: "racing", label: "Гонки" },
  { value: "sports", label: "Спорт" },
  { value: "sandbox", label: "Sandbox" },
  { value: "horror", label: "Хоррор" },
  { value: "metroidvania", label: "Metroidvania" },
  { value: "idle", label: "Idle" },
  { value: "visual_novel", label: "Visual Novel" },
];
