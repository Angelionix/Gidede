"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Lightbulb,
  RefreshCw,
  FlaskConical,
  Scale,
  TrendingUp,
  FileText,
  Bot,
  Puzzle,
  Gamepad2,
  ArrowRight,
  CheckCircle2,
  Circle,
  Construction,
} from "lucide-react";
import Link from "next/link";

const blocks = [
  {
    id: 1,
    name: "Генератор концепции",
    description:
      "Превращает абстрактную идею в структурированную концепцию: жанр, эстетика, механики, Core Loop, USP.",
    icon: Lightbulb,
    href: "/blocks/1",
    status: "skeleton" as const,
    algorithm: "Алгоритм 3.1",
  },
  {
    id: 2,
    name: "Core Loop Designer",
    description:
      "Визуальный конструктор основного игрового цикла. Иерархия петель, диагностика патологий, валидация.",
    icon: RefreshCw,
    href: "/blocks/2",
    status: "skeleton" as const,
    algorithm: "Алгоритм 3.2",
  },
  {
    id: 3,
    name: "MDA Lab",
    description:
      "Интерактивная среда для работы с MDA-фреймворком: Reverse MDA, Classic MDA, линзы Шелла, матрица Бонда.",
    icon: FlaskConical,
    href: "/blocks/3",
    status: "skeleton" as const,
    algorithm: "Алгоритм 3.3",
  },
  {
    id: 4,
    name: "Баланс и симуляция",
    description:
      "Transitive/intransitive анализ, Monte Carlo симуляция, Machinations-визуализация экономики.",
    icon: Scale,
    href: "/blocks/4",
    status: "skeleton" as const,
    algorithm: "Алгоритм 3.4",
  },
  {
    id: 5,
    name: "Экономика и прогрессия",
    description:
      "Конструктор внутренней экономики на основе Machinations. Кривые прогрессии, контент-план.",
    icon: TrendingUp,
    href: "/blocks/5",
    status: "skeleton" as const,
    algorithm: "Алгоритмы 3.5–3.6",
  },
  {
    id: 6,
    name: "GDD Generator",
    description:
      "Генерация дизайн-документов по шаблонам (38 секций Роджерса). 5 типов чек-листов валидации.",
    icon: FileText,
    href: "/blocks/6",
    status: "skeleton" as const,
    algorithm: "Алгоритмы 3.7–3.8",
  },
  {
    id: 7,
    name: "AI-ассистент",
    description:
      "Контекстно-осведомлённый чат-бот. Знает проект, цитирует книги, предлагает рекомендации.",
    icon: Bot,
    href: "/blocks/7",
    status: "skeleton" as const,
    algorithm: "Спецификация 3.9",
  },
  {
    id: 8,
    name: "Интеграция GBE",
    description:
      "API Bridge для GDCombine. Blueprint-синхронизация, Linter-правила, шаблоны документов.",
    icon: Puzzle,
    href: "/blocks/8",
    status: "planned" as const,
    algorithm: "—",
  },
];

const statusIcon = {
  skeleton: Construction,
  planned: Circle,
  active: CheckCircle2,
  complete: CheckCircle2,
};

const statusText = {
  skeleton: "Скелет API",
  planned: "Запланирован",
  active: "В разработке",
  complete: "Реализован",
};

const statusColor = {
  skeleton: "text-yellow-600",
  planned: "text-gray-400",
  active: "text-blue-600",
  complete: "text-green-600",
};

export default function Home() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Заголовок */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Gamepad2 className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Gidede</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Game Design AI System — от идеи до GDD за 60 минут
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Фаза 4.A: Инфраструктура и фундамент • 8 функциональных блоков • 31
          AI-промпт • 10 алгоритмов
        </p>
      </div>

      {/* Прогресс */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg">Прогресс разработки</CardTitle>
          <CardDescription>
            Фазы 1–3 завершены (анализ, библия, алгоритмы). Фаза 4 — разработка
            веб-приложения.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                ✅
              </div>
              <div className="text-muted-foreground">Фаза 1</div>
              <div className="font-medium">Исследование</div>
            </div>
            <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                ✅
              </div>
              <div className="text-muted-foreground">Фаза 2</div>
              <div className="font-medium">Библия GD</div>
            </div>
            <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                ✅
              </div>
              <div className="text-muted-foreground">Фаза 3</div>
              <div className="font-medium">Алгоритмы</div>
            </div>
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                🔨
              </div>
              <div className="text-muted-foreground">Фаза 4</div>
              <div className="font-medium">Разработка</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Блоки */}
      <h2 className="text-xl font-semibold mb-4">Функциональные блоки</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {blocks.map((block) => {
          const StatusIcon = statusIcon[block.status];
          return (
            <Card key={block.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <block.icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{block.name}</CardTitle>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs ${statusColor[block.status]}`}
                  >
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {statusText[block.status]}
                  </Badge>
                </div>
                <CardDescription className="text-xs mt-1">
                  {block.algorithm}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  {block.description}
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link href={block.href}>
                    Открыть
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
