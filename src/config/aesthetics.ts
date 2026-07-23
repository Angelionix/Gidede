/**
 * Gidede — Centralized aesthetics & Yee motivation constants.
 *
 * DRY: replaces duplicated AESTHETICS, AESTHETIC_MAP, and YEE_MOTIVATIONS
 * definitions that were scattered across block pages 1 and 3.
 */

import {
  Zap,
  Sparkles,
  MessageSquare,
  Shield,
  BrainCircuit,
  Search,
  Lightbulb,
  RotateCcw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ============================================================
// Hunicke's 8 Aesthetics (with Lucide icons for UI rendering)
// Source: Block 3 (MDA Lab)
// ============================================================

export interface AestheticOption {
  value: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

export const AESTHETICS: AestheticOption[] = [
  { value: "sensation", label: "Чувственное", icon: Zap, color: "bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800" },
  { value: "fantasy", label: "Фантазия", icon: Sparkles, color: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800" },
  { value: "narrative", label: "Нарратив", icon: MessageSquare, color: "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800" },
  { value: "challenge", label: "Вызов", icon: Shield, color: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800" },
  { value: "fellowship", label: "Товарищество", icon: BrainCircuit, color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800" },
  { value: "discovery", label: "Открытие", icon: Search, color: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800" },
  { value: "expression", label: "Выражение", icon: Lightbulb, color: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800" },
  { value: "submission", label: "Подчинение", icon: RotateCcw, color: "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-950/40 dark:text-gray-300 dark:border-gray-800" },
];

// ============================================================
// Aesthetic emoji/color map (lightweight, no icon dependency)
// Source: Block 1 (Concept Generator)
// ============================================================

export interface AestheticMapEntry {
  emoji: string;
  label: string;
  color: string;
}

export const AESTHETIC_MAP: Record<string, AestheticMapEntry> = {
  sensation: { emoji: "\u{1F534}", label: "Чувственное", color: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800" },
  fantasy: { emoji: "\u{1F7E3}", label: "Фантазия", color: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800" },
  narrative: { emoji: "\u{1F535}", label: "Нарратив", color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800" },
  challenge: { emoji: "\u{1F7E0}", label: "Вызов", color: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800" },
  fellowship: { emoji: "\u{1F7E2}", label: "Товарищество", color: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800" },
  discovery: { emoji: "\u{1F7E1}", label: "Открытие", color: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-800" },
  expression: { emoji: "\u{1FA79}", label: "Выражение", color: "bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800" },
  submission: { emoji: "\u26AA", label: "Подчинение", color: "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-950/40 dark:text-gray-300 dark:border-gray-800" },
};

// ============================================================
// Yee's Motivation Model (3 clusters, 12 motivations)
// Source: Block 1 (Concept Generator)
// ============================================================

export interface YeeMotivationItem {
  value: string;
  label: string;
}

export interface YeeMotivationCluster {
  cluster: string;
  items: YeeMotivationItem[];
}

export const YEE_MOTIVATIONS: YeeMotivationCluster[] = [
  {
    cluster: "Действие-Социальность",
    items: [
      { value: "destruction", label: "Разрушение" },
      { value: "excitement", label: "Возбуждение" },
      { value: "competition", label: "Соревнование" },
      { value: "community", label: "Сообщество" },
    ],
  },
  {
    cluster: "Мастерство-Достижение",
    items: [
      { value: "challenge", label: "Вызов" },
      { value: "strategy", label: "Стратегия" },
      { value: "completion", label: "Завершение" },
      { value: "power", label: "Мощь" },
    ],
  },
  {
    cluster: "Погружение-Творчество",
    items: [
      { value: "fantasy_yee", label: "Фантазия" },
      { value: "story", label: "Сюжет" },
      { value: "design", label: "Дизайн" },
      { value: "discovery_yee", label: "Открытие" },
    ],
  },
];
