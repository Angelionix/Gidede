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
  Gamepad2,
  ArrowRight,
  CheckCircle2,
  Circle,
  Construction,
} from "lucide-react";
import Link from "next/link";
import { BLOCKS } from "@/config/blocks";
import type { BlockDevStatus } from "@/config/blocks";

const statusIcon: Record<BlockDevStatus | "complete", typeof CheckCircle2> = {
  skeleton: Construction,
  planned: Circle,
  active: CheckCircle2,
  complete: CheckCircle2,
};

const statusText: Record<BlockDevStatus | "complete", string> = {
  skeleton: "Скелет API",
  planned: "Запланирован",
  active: "В разработке",
  complete: "Реализован",
};

const statusColor: Record<BlockDevStatus | "complete", string> = {
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
          Фаза 4.B: Основные модули • 8 функциональных блоков • 31
          AI-промпт • 10 алгоритмов
        </p>
      </div>

      {/* Прогресс */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg">Прогресс разработки</CardTitle>
          <CardDescription>
            Фазы 1–3 завершены (анализ, библия, алгоритмы). Фаза 4.B — разработка основных модулей
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
        {BLOCKS.map((block) => {
          const StatusIcon = statusIcon[block.status];
          const BlockIcon = block.icon;
          return (
            <Card key={block.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <BlockIcon className="h-5 w-5 text-primary" />
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
                  Алгоритм {block.algorithm}
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
