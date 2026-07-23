import {
  Lightbulb,
  RefreshCw,
  FlaskConical,
  Scale,
  TrendingUp,
  FileText,
  Bot,
  Puzzle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ============================================================
// СТАТИЧЕСКАЯ КОНФИГУРАЦИЯ БЛОКОВ (единственный источник истины)
// ============================================================

export type BlockDevStatus = "active" | "skeleton" | "planned";

export interface BlockConfig {
  id: number;
  name: string;
  href: string;
  description: string;
  icon: LucideIcon;
  algorithm: string;
  status: BlockDevStatus;
}

export const BLOCKS: BlockConfig[] = [
  {
    id: 1,
    name: "Генератор концепции",
    href: "/blocks/1",
    description:
      "Превращает абстрактную идею в структурированную концепцию: жанр, эстетика, механики, Core Loop, USP.",
    icon: Lightbulb,
    algorithm: "3.1",
    status: "active",
  },
  {
    id: 2,
    name: "Core Loop Designer",
    href: "/blocks/2",
    description:
      "Визуальный конструктор основного игрового цикла. Иерархия петель, диагностика патологий, валидация.",
    icon: RefreshCw,
    algorithm: "3.2",
    status: "active",
  },
  {
    id: 3,
    name: "MDA Lab",
    href: "/blocks/3",
    description:
      "Интерактивная среда для работы с MDA-фреймворком: Reverse MDA, Classic MDA, линзы Шелла, матрица Бонда.",
    icon: FlaskConical,
    algorithm: "3.3",
    status: "active",
  },
  {
    id: 4,
    name: "Баланс и симуляция",
    href: "/blocks/4",
    description:
      "Transitive/intransitive анализ, Monte Carlo симуляция, Machinations-визуализация экономики.",
    icon: Scale,
    algorithm: "3.4",
    status: "skeleton",
  },
  {
    id: 5,
    name: "Экономика и прогрессия",
    href: "/blocks/5",
    description:
      "Конструктор внутренней экономики на основе Machinations. Кривые прогрессии, контент-план.",
    icon: TrendingUp,
    algorithm: "3.5–3.6",
    status: "skeleton",
  },
  {
    id: 6,
    name: "GDD Generator",
    href: "/blocks/6",
    description:
      "Генерация дизайн-документов по шаблонам (38 секций Роджерса). 5 типов чек-листов валидации.",
    icon: FileText,
    algorithm: "3.7–3.8",
    status: "skeleton",
  },
  {
    id: 7,
    name: "AI-ассистент",
    href: "/blocks/7",
    description:
      "Контекстно-осведомлённый чат-бот. Знает проект, цитирует книги, предлагает рекомендации.",
    icon: Bot,
    algorithm: "3.9",
    status: "skeleton",
  },
  {
    id: 8,
    name: "Интеграция GBE",
    href: "/blocks/8",
    description:
      "API Bridge для GDCombine. Blueprint-синхронизация, Linter-правила, шаблоны документов.",
    icon: Puzzle,
    algorithm: "—",
    status: "planned",
  },
];
