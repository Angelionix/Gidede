"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  MECHANICS_DB,
  getMechanicsDBStats,
  type Mechanic,
} from "@/lib/mechanics-db";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Layers, Search, SlidersHorizontal, BookMarked, ArrowRight, Library } from "lucide-react";

// ============================================================
// КОНФИГ ЦВЕТОВ ДЛЯ ГРУПП И ЭСТЕТИК (без indigo / blue)
// ============================================================

const GROUP_COLORS: Record<string, string> = {
  Базовые: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  Прогрессия: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
  Пространство: "bg-lime-100 text-lime-700 dark:bg-lime-950/60 dark:text-lime-300 border-lime-200 dark:border-lime-900",
  Боевые: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-900",
  Движение: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-900",
  Экономика: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/60 dark:text-yellow-300 border-yellow-200 dark:border-yellow-900",
  Социальные: "bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border-pink-200 dark:border-pink-900",
  Стелс: "bg-slate-100 text-slate-700 dark:bg-slate-950/60 dark:text-slate-300 border-slate-200 dark:border-slate-800",
  Навыки: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border-violet-200 dark:border-violet-900",
  Время: "bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-900",
  Территория: "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300 border-green-200 dark:border-green-900",
  Сюжет: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-900",
  Выживание: "bg-stone-100 text-stone-700 dark:bg-stone-950/60 dark:text-stone-300 border-stone-200 dark:border-stone-800",
  Информация: "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-900",
  Мета: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/60 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-900",
};

const AESTHETIC_COLORS: Record<string, string> = {
  sensation: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-900",
  fantasy: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border-violet-200 dark:border-violet-900",
  narrative: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  challenge: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-900",
  fellowship: "bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border-pink-200 dark:border-pink-900",
  discovery: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
  expression: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-900",
  submission: "bg-slate-100 text-slate-700 dark:bg-slate-950/60 dark:text-slate-300 border-slate-200 dark:border-slate-800",
};

const AESTHETIC_ORDER = [
  "sensation",
  "fantasy",
  "narrative",
  "challenge",
  "fellowship",
  "discovery",
  "expression",
  "submission",
];

// ============================================================
// ГЛОССАРИЙ
// ============================================================

interface GlossaryTerm {
  term: string;
  definition: string;
}

const GLOSSARY: GlossaryTerm[] = [
  {
    term: "MDA Framework",
    definition:
      "Формальная модель геймдизайна (Hunicke, LeBlanc, Zubek): Mechanics → Dynamics → Aesthetics. Механики порождают динамики, динамики создают эстетику — эмоциональный отклик игрока.",
  },
  {
    term: "Механика (Mechanic)",
    definition:
      "Базовое правило, действие или поведение в игре — то, что игрок может делать, и как игра отвечает. Составной кирпичик всей системы.",
  },
  {
    term: "Динамика (Dynamic)",
    definition:
      "Поведение механики во время реальной игры — то, как она «оживает» во взаимодействии игрока, правил и других механик (например, таймер давления как динамика от механики лимита времени).",
  },
  {
    term: "Эстетика (Aesthetic)",
    definition:
      "Эмоциональный отклик игрока. По MDA выделяют 8 типов: sensation, fantasy, narrative, challenge, fellowship, discovery, expression, submission. Это цель дизайна, а не «красота интерфейса».",
  },
  {
    term: "Core Loop",
    definition:
      "Основной цикл действий игрока, повторяемый на протяжении всей сессии (например: собрать → скрафтить → сразиться → получить награду → собрать). От качества core loop зависит «залипательность» игры.",
  },
  {
    term: "Engine / Economy / Ecology",
    definition:
      "Три структурных типа core loop по Адамсу: Engine — накопительный рост, Economy — товарно-денежный обмен, Ecology — замкнутая саморегулирующаяся система.",
  },
  {
    term: "Triangle of Weirdness",
    definition:
      "Модель Скотта Роджерса: баланс между Familiarity (узнаваемость), Novelty (новизна) и Usability (удобство). Хороший дизайн держит все три вершины в здоровом напряжении, не жертвуя ни одной.",
  },
  {
    term: "Линзы Шелла",
    definition:
      "Набор из 113 «линз» (Jesse Schell, The Art of Game Design) — вопросов, которыми дизайнер проверяет свою игру: от «Что игрок чувствует?» до «Есть ли у игры история?».",
  },
];

// ============================================================
// ПОДГОТОВКА ДАННЫХ
// ============================================================

const STATS = getMechanicsDBStats();
const ALL_GROUPS = Object.keys(STATS.mechanicsPerGroup);

function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е");
}

// ============================================================
// КАРТОЧКА МЕХАНИКИ
// ============================================================

function MechanicCard({
  mechanic,
  onOpen,
}: {
  mechanic: Mechanic;
  onOpen: () => void;
}) {
  const groupClass =
    GROUP_COLORS[mechanic.group] ||
    "bg-muted text-muted-foreground border-border";

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group h-full cursor-pointer transition-all hover:shadow-md hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Открыть карточку механики: ${mechanic.name}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">{mechanic.name}</CardTitle>
          <Badge
            variant="outline"
            className={`shrink-0 text-[10px] ${groupClass}`}
          >
            {mechanic.group}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
          {mechanic.desc}
        </p>
        <div className="flex flex-wrap gap-1">
          {mechanic.aesthetics.map((a) => (
            <Badge
              key={a}
              variant="outline"
              className={`text-[9px] px-1.5 py-0 ${
                AESTHETIC_COLORS[a] || "bg-muted text-muted-foreground border-border"
              }`}
            >
              {a}
            </Badge>
          ))}
        </div>
        {mechanic.genres.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {mechanic.genres.slice(0, 4).map((g) => (
              <Badge
                key={g}
                variant="outline"
                className="text-[9px] px-1.5 py-0 bg-muted/60 text-muted-foreground border-border"
              >
                {g}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// СТРАНИЦА
// ============================================================

export default function MechanicsPage() {
  const stats = STATS;
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [activeAesthetic, setActiveAesthetic] = useState<string | null>(null);
  const [aestheticOpen, setAestheticOpen] = useState(false);
  const [selected, setSelected] = useState<Mechanic | null>(null);

  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    return MECHANICS_DB.filter((m) => {
      if (activeGroup && m.group !== activeGroup) return false;
      if (activeAesthetic && !m.aesthetics.includes(activeAesthetic)) return false;
      if (q) {
        const hay = normalize(
          `${m.name} ${m.desc} ${m.group} ${m.aesthetics.join(" ")} ${m.genres.join(" ")}`,
        );
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [search, activeGroup, activeAesthetic]);

  const resetFilters = () => {
    setSearch("");
    setActiveGroup(null);
    setActiveAesthetic(null);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Заголовок */}
      <div className="flex items-start gap-3 mb-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Layers className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Библиотека механик</h1>
          <p className="text-sm text-muted-foreground">
            128 механик из SW.BAND «Карты геймдизайнера» (Книга 15)
          </p>
        </div>
      </div>

      {/* Stats bar */}
      <Card className="mb-4 border-primary/20 bg-primary/5">
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">{stats.total}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Механик
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">{stats.groups}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Групп
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">8</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Эстетик MDA
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div className="text-[11px] text-muted-foreground leading-tight">
                Источник: SW.BAND
                <br />
                Книга 15
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Глоссарий (аккордеон) */}
      <Accordion type="single" collapsible className="mb-4">
        <AccordionItem
          value="glossary"
          className="border rounded-lg px-4 bg-card"
        >
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <BookMarked className="h-4 w-4 text-primary" />
              <span className="font-medium">Глоссарий</span>
              <span className="text-xs text-muted-foreground">
                ({GLOSSARY.length} терминов геймдизайна)
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 pb-4">
              {GLOSSARY.map((g) => (
                <div
                  key={g.term}
                  className="rounded-lg border border-border bg-muted/30 p-3"
                >
                  <div className="text-sm font-semibold text-foreground mb-1">
                    {g.term}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {g.definition}
                  </p>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Поиск */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Поиск по названию, описанию, группе, эстетике..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          aria-label="Поиск механик"
        />
      </div>

      {/* Фильтр по группам */}
      <div className="mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveGroup(null)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              activeGroup === null
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-muted-foreground border-border hover:border-primary/40 hover:text-primary"
            }`}
          >
            Все
          </button>
          {ALL_GROUPS.map((g) => {
            const isActive = activeGroup === g;
            const cls = GROUP_COLORS[g] || "";
            return (
              <button
                key={g}
                onClick={() => setActiveGroup(isActive ? null : g)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  isActive
                    ? cls || "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 text-muted-foreground border-border hover:border-primary/40 hover:text-primary"
                }`}
              >
                {g}
                <span className="ml-1 opacity-70">
                  {stats.mechanicsPerGroup[g]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Фильтр по эстетике (collapsible) */}
      <Collapsible open={aestheticOpen} onOpenChange={setAestheticOpen} className="mb-4">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground hover:text-primary">
            <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
            {aestheticOpen ? "Скрыть фильтр по эстетике" : "Фильтр по эстетике MDA"}
            {activeAesthetic && (
              <Badge
                variant="outline"
                className={`ml-2 text-[10px] px-1.5 py-0 ${
                  AESTHETIC_COLORS[activeAesthetic] || ""
                }`}
              >
                {activeAesthetic}
              </Badge>
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="flex items-center gap-2 flex-wrap rounded-lg border border-border bg-muted/20 p-3">
            <button
              onClick={() => setActiveAesthetic(null)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                activeAesthetic === null
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-primary"
              }`}
            >
              Все эстетики
            </button>
            {AESTHETIC_ORDER.map((a) => {
              const isActive = activeAesthetic === a;
              const cls = AESTHETIC_COLORS[a] || "";
              return (
                <button
                  key={a}
                  onClick={() => setActiveAesthetic(isActive ? null : a)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    isActive
                      ? cls || "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-primary"
                  }`}
                >
                  {a}
                </button>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Счётчик результатов */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">
          Показано: <span className="font-medium text-foreground">{filtered.length}</span> из {stats.total}
        </p>
        {(search || activeGroup || activeAesthetic) && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetFilters}>
            Сбросить фильтры
          </Button>
        )}
      </div>

      {/* Сетка механик */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="pt-10 pb-10 text-center">
            <Library className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-base font-medium mb-1">Ничего не найдено</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Попробуйте изменить поисковый запрос или сбросить фильтры — в библиотеке точно есть подходящие механики.
            </p>
            <Button variant="outline" size="sm" onClick={resetFilters}>
              Сбросить фильтры
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((m) => (
            <MechanicCard
              key={`${m.group}-${m.name}`}
              mechanic={m}
              onOpen={() => setSelected(m)}
            />
          ))}
        </div>
      )}

      {/* Диалог деталей механики */}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap pr-6">
              {selected?.name}
              {selected && (
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    GROUP_COLORS[selected.group] || ""
                  }`}
                >
                  {selected.group}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Полное описание механики из SW.BAND «Карты геймдизайнера» (Книга 15)
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <p className="text-sm text-foreground/90 leading-relaxed">
                {selected.desc}
              </p>

              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Эстетики MDA
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selected.aesthetics.map((a) => (
                    <Badge
                      key={a}
                      variant="outline"
                      className={`text-xs ${
                        AESTHETIC_COLORS[a] || ""
                      }`}
                    >
                      {a}
                    </Badge>
                  ))}
                </div>
              </div>

              {selected.genres.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Жанры
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.genres.map((g) => (
                      <Badge
                        key={g}
                        variant="outline"
                        className="text-xs bg-muted/60 text-muted-foreground border-border"
                      >
                        {g}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button asChild>
              <Link href="/blocks/1">
                Использовать в Концепции
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
