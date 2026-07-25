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
  Sparkles,
  Zap,
  BookOpen,
  Target,
} from "lucide-react";
import Link from "next/link";
import { BLOCKS } from "@/config/blocks";
import type { BlockDevStatus } from "@/config/blocks";
import { useAuth } from "@/lib/auth";

const statusIcon: Record<BlockDevStatus | "complete", typeof CheckCircle2> = {
  skeleton: Construction,
  planned: Circle,
  active: CheckCircle2,
  complete: CheckCircle2,
};

const statusText: Record<BlockDevStatus | "complete", string> = {
  skeleton: "Скелет API",
  planned: "Запланирован",
  active: "Активен",
  complete: "Реализован",
};

const statusClasses: Record<BlockDevStatus | "complete", string> = {
  skeleton:
    "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  planned:
    "bg-gray-100 text-gray-500 dark:bg-gray-800/60 dark:text-gray-400 border-gray-200 dark:border-gray-700",
  active:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
  complete:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
};

const PHASES = [
  {
    id: 1,
    name: "Исследование",
    done: true,
    detail: "17 книг",
  },
  {
    id: 2,
    name: "Библия GD",
    done: true,
    detail: "12 разделов",
  },
  {
    id: 3,
    name: "Алгоритмы",
    done: true,
    detail: "10 спецификаций",
  },
  {
    id: 4,
    name: "Разработка",
    done: false,
    detail: "8 блоков",
  },
];

const STATS = [
  { label: "Алгоритмов", value: "10", icon: Zap },
  { label: "AI-промптов", value: "34", icon: Sparkles },
  { label: "Книг в базе", value: "17", icon: BookOpen },
  { label: "Эстетик MDA", value: "8", icon: Target },
];

export default function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen">
      {/* Hero section with gradient */}
      <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-background via-background to-muted/30">
        {/* Decorative gradient orbs */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl"
        />
        <div className="relative p-6 md:p-10 max-w-7xl mx-auto">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur mb-4">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Game Design AI System • v0.51.0
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                  <Gamepad2 className="h-7 w-7" />
                </div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                  Gidede
                </h1>
              </div>
              <p className="text-lg md:text-xl text-muted-foreground font-medium leading-relaxed">
                От идеи до GDD за 60 минут.
              </p>
              <p className="text-sm text-muted-foreground/80 mt-2 leading-relaxed">
                AI-powered система для геймдизайнеров. 8 функциональных блоков,
                формализованные алгоритмы из 17 книг по геймдизайну, контекстный
                AI-ассистент.
              </p>
              <div className="flex flex-wrap gap-3 mt-6">
                {isAuthenticated ? (
                  <Button asChild size="lg" className="shadow-md">
                    <Link href="/projects">
                      Мои проекты
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                ) : (
                  <Button asChild size="lg" className="shadow-md">
                    <Link href="/register">
                      Начать бесплатно
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                )}
                <Button asChild size="lg" variant="outline">
                  <Link href="/blocks/1">Попробовать блок 1</Link>
                </Button>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 md:w-72">
              {STATS.map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-border bg-card/80 p-4 backdrop-blur shadow-sm"
                >
                  <s.icon className="h-4 w-4 text-primary mb-2" />
                  <div className="text-2xl font-bold">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-10 max-w-7xl mx-auto">
        {/* Progress timeline */}
        <Card className="mb-10 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              Прогресс разработки
            </CardTitle>
            <CardDescription>
              Фазы 1–3 завершены (анализ, библия, алгоритмы). Фаза 4 —
              разработка веб-приложения.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {/* Connecting line */}
              <div
                aria-hidden
                className="hidden md:block absolute top-6 left-[12.5%] right-[12.5%] h-0.5 bg-border"
              />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative">
                {PHASES.map((phase) => (
                  <div key={phase.id} className="flex flex-col items-center text-center">
                    <div
                      className={`relative flex h-12 w-12 items-center justify-center rounded-full border-2 shadow-sm ${
                        phase.done
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-primary bg-primary text-primary-foreground animate-pulse"
                      }`}
                    >
                      {phase.done ? (
                        <CheckCircle2 className="h-6 w-6" />
                      ) : (
                        <Construction className="h-5 w-5" />
                      )}
                    </div>
                    <div className="mt-3">
                      <div className="text-xs text-muted-foreground uppercase tracking-wide">
                        Фаза {phase.id}
                      </div>
                      <div className="text-sm font-semibold mt-0.5">
                        {phase.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {phase.detail}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Blocks */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Функциональные блоки</h2>
          <Badge variant="secondary" className="text-xs">
            8 модулей
          </Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {BLOCKS.map((block) => {
            const StatusIcon = statusIcon[block.status];
            const BlockIcon = block.icon;
            return (
              <Card
                key={block.id}
                className="group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <BlockIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{block.name}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          Алгоритм {block.algorithm}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-medium border ${statusClasses[block.status]}`}
                    >
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusText[block.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    {block.description}
                  </p>
                  <Button asChild variant="outline" size="sm" className="group-hover:border-primary group-hover:text-primary">
                    <Link href={block.href}>
                      Открыть блок
                      <ArrowRight className="h-3 w-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="mt-12 text-center text-xs text-muted-foreground">
          <p>
            Gidede — Game Design AI System. Основано на 17 книгах по геймдизайну.
          </p>
        </div>
      </div>
    </div>
  );
}
