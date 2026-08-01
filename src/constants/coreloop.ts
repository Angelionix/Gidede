/**
 * Gidede — CoreLoop Constants (Block 2)
 * SRP: извлечены из src/app/blocks/2/page.tsx
 */

import {
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  Info,
  Zap,
  Activity,
  Layers,
  Shield,
  Flame,
  BrainCircuit,
} from "lucide-react";

export const LOOP_TYPES = [
  { value: "engine", label: "Engine (Двигатель)", description: "Усиливающие петли, один ресурс → рост. Action, Shooter, Platformer." },
  { value: "economy", label: "Economy (Экономика)", description: "Смешанные петли, конвертация ресурсов. RPG, Strategy, Simulation." },
  { value: "ecology", label: "Ecology (Экология)", description: "Балансирующие петли, равновесие. Horror, Survival, Sandbox." },
  { value: "hybrid", label: "Hybrid (Гибрид)", description: "Смешанная структура. Adventure, Roguelike, Tower Defense." },
];

export const LOOP_TYPE_BADGES: Record<string, { label: string; color: string; icon: typeof Flame }> = {
  engine: { label: "Двигатель", color: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800", icon: Flame },
  economy: { label: "Экономика", color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800", icon: Activity },
  ecology: { label: "Экология", color: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800", icon: Shield },
  hybrid: { label: "Гибрид", color: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800", icon: Layers },
};

export const SEVERITY_STYLES: Record<string, { color: string; icon: typeof AlertTriangle }> = {
  critical: { color: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300", icon: AlertTriangle },
  warning: { color: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-300", icon: AlertCircle },
  info: { color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300", icon: Info },
};

export const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
};

export const HIERARCHY_LEVELS: { key: string; label: string; timeScale: string; icon: typeof Activity }[] = [
  { key: "micro", label: "Микро", timeScale: "мс-секунды", icon: Zap },
  { key: "small", label: "Малая", timeScale: "1-2 мин", icon: RefreshCw },
  { key: "medium", label: "Средняя", timeScale: "5-10 мин", icon: Activity },
  { key: "large", label: "Большая", timeScale: "15-30 мин", icon: Layers },
  { key: "macro", label: "Макро", timeScale: "часы", icon: Shield },
  { key: "meta", label: "Мета", timeScale: "недели-месяцы", icon: BrainCircuit },
];
