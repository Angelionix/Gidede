/**
 * Gidede — Balance Constants (Block 4)
 * SRP: извлечены из src/app/blocks/4/page.tsx
 */

import type { BalanceObject } from "@/types/balance";

export const GAME_MODES = [
  { value: "PvP", label: "PvP" },
  { value: "PvE", label: "PvE" },
  { value: "PvPvE", label: "PvPvE" },
];

export const BALANCE_TYPES = [
  { value: "transitive", label: "Transitive" },
  { value: "intransitive", label: "Intransitive" },
  { value: "situational", label: "Situational" },
  { value: "mixed", label: "Mixed" },
];

export const STATUS_COLORS: Record<string, string> = {
  overpowered:
    "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
  underpowered:
    "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  balanced:
    "bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800",
  ideal_imbalance:
    "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
};

export const STATUS_DOT: Record<string, string> = {
  overpowered: "bg-red-500",
  underpowered: "bg-amber-500",
  balanced: "bg-green-500",
  ideal_imbalance: "bg-blue-500",
};

export const VERDICT_STYLES: Record<string, string> = {
  GOOD: "bg-green-600 text-white",
  MODERATE: "bg-amber-600 text-white",
  POOR: "bg-red-600 text-white",
};

export const DEFAULT_OBJECTS: BalanceObject[] = [
  {
    id: "1",
    name: "Warrior",
    type: "melee",
    attributes: { HP: 100, damage: 15, speed: 5, armor: 10 },
    cost: 100,
    tier: 1,
  },
  {
    id: "2",
    name: "Mage",
    type: "ranged",
    attributes: { HP: 60, damage: 25, speed: 7, armor: 3 },
    cost: 120,
    tier: 1,
  },
  {
    id: "3",
    name: "Rogue",
    type: "melee",
    attributes: { HP: 70, damage: 20, speed: 12, armor: 5 },
    cost: 110,
    tier: 1,
  },
  {
    id: "4",
    name: "Tank",
    type: "melee",
    attributes: { HP: 200, damage: 8, speed: 3, armor: 20 },
    cost: 150,
    tier: 2,
  },
  {
    id: "5",
    name: "Healer",
    type: "support",
    attributes: { HP: 80, damage: 10, speed: 6, armor: 8 },
    cost: 90,
    tier: 1,
  },
];
