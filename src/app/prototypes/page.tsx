"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gamepad2, Play, RotateCcw, Lightbulb, AlertCircle, Loader2, FlaskConical, Box, Square, Wand2, Sparkles, Save, History } from "lucide-react";

interface Project {
  id: string;
  name: string;
  genre: string | null;
  has_core_loop: boolean;
}

interface PrototypeResponse {
  playable: boolean;
  html: string;
  config: {
    type: string;
    mode: string;
    steps: string[];
    resource: string;
    goal: string;
  };
  ai_insights: string | null;
  ai_generated: boolean;
  project_id: string;
  project_name: string;
}

interface PlaytestHistoryEntry {
  id: string;
  prototype_type: string;
  mode: string;
  outcome: string;
  score: number | null;
  duration_sec: number;
  notes: string | null;
  ai_generated: boolean;
  created_at: string;
}

const TYPE_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  engine: { label: "Engine", color: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300", desc: "Ресурс генерируется со временем" },
  economy: { label: "Economy", color: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300", desc: "Конвертация ресурсов" },
  ecology: { label: "Ecology", color: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300", desc: "Конкуренция / выживание" },
};

export default function PrototypesPage() {
  const { apiFetch, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [mode, setMode] = useState<"2d" | "3d">("2d");
  const [useAi, setUseAi] = useState(false);
  const [typeOverride, setTypeOverride] = useState<string>("auto");
  const [loading, setLoading] = useState(false);
  const [prototype, setPrototype] = useState<PrototypeResponse | null>(null);
  const [history, setHistory] = useState<PlaytestHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const TYPE_OPTIONS = [
    { value: "auto", label: "Авто (из проекта)" },
    { value: "engine", label: "Engine — генерация ресурса" },
    { value: "economy", label: "Economy — конвертация" },
    { value: "ecology", label: "Ecology — выживание" },
    { value: "tower_defense", label: "Tower Defense — защита" },
    { value: "rhythm", label: "Rhythm — ритм" },
    { value: "puzzle", label: "Puzzle — тетрис-лайк" },
  ];

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      apiFetch<{ projects: Project[] }>("/projects/?per_page=50")
        .then((data) => setProjects(data.projects))
        .catch(() => {});
    }
  }, [authLoading, isAuthenticated, apiFetch]);

  const handleGenerate = async () => {
    if (!selectedProject) {
      toast({
        title: "Выберите проект",
        description: "Укажите проект для генерации прототипа",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    setPrototype(null);
    try {
      const data = await apiFetch<PrototypeResponse>("/prototypes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: selectedProject,
          mode,
          use_ai: useAi,
          ...(typeOverride !== "auto" ? { type: typeOverride } : {}),
        }),
      });
      setPrototype(data);
      toast({
        title: `Прототип готов (${mode.toUpperCase()}${useAi ? " + AI" : ""})`,
        description: `Тип: ${data.config.type}, ресурс: ${data.config.resource}`,
      });
    } catch (err) {
      toast({
        title: "Ошибка генерации",
        description: err instanceof Error ? err.message : "Неизвестная ошибка",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = () => {
    if (iframeRef.current) {
      // Перезагружаем iframe, чтобы перезапустить игру
      const src = iframeRef.current.src;
      iframeRef.current.src = "about:blank";
      setTimeout(() => {
        if (iframeRef.current) iframeRef.current.src = src;
      }, 50);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
        <Gamepad2 className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Войдите в аккаунт</h2>
        <p className="text-muted-foreground">Прототипы доступны после авторизации.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FlaskConical className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Прототипы кор-лупа</h1>
          <p className="text-sm text-muted-foreground">
            Быстрые прототипы для теста основного цикла за 30 секунд
          </p>
        </div>
      </div>

      {/* Concept card */}
      <Card className="mb-6 border-primary/20 bg-primary/5">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium mb-1">Зачем это нужно?</p>
              <p className="text-muted-foreground leading-relaxed">
                Алгоритм 3.2 требует теста «30 секунд веселья» для каждого кор-лупа.
                Здесь вы можете быстро протестировать структурный тип (Engine / Economy /
                Ecology) и понять, приносит ли цикл удовольствие, до того как писать реальный код игры.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project selector */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">1. Выберите проект</CardTitle>
          <CardDescription>
            Лучше всего работают проекты, у которых уже сгенерирован Core Loop (Блок 2).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Выберите проект —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.has_core_loop ? "✓" : "— (нет Core Loop)"}
                </option>
              ))}
            </select>
            <Button onClick={handleGenerate} disabled={loading || !selectedProject} className="sm:w-auto">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" /> Генерация...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-1" /> Сгенерировать прототип
                </>
              )}
            </Button>
          </div>

          {/* Mode toggle 2D / 3D */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1">Режим:</span>
            <button
              type="button"
              onClick={() => setMode("2d")}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                mode === "2d"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <Square className="h-3.5 w-3.5" />
              2D (LittleJS)
            </button>
            <button
              type="button"
              onClick={() => setMode("3d")}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                mode === "3d"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <Box className="h-3.5 w-3.5" />
              3D (Three.js)
            </button>
            <div className="w-px h-5 bg-border mx-1" />
            <button
              type="button"
              onClick={() => setUseAi(!useAi)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                useAi
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted/50"
              }`}
              title="AI сгенерирует инсайты для прототипа (~10 сек)"
            >
              <Wand2 className="h-3.5 w-3.5" />
              AI-инсайты
            </button>
            <div className="w-px h-5 bg-border mx-1" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={async () => {
                setShowHistory(!showHistory);
                if (!showHistory) {
                  try {
                    const data = await apiFetch<{ results: PlaytestHistoryEntry[] }>(
                      `/playtests/history?limit=10`
                    );
                    setHistory(data.results);
                  } catch (e) {
                    /* ignore */
                  }
                }
              }}
            >
              <History className="h-3.5 w-3.5 mr-1" />
              История
            </Button>
          </div>

          {/* Type override selector */}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-muted-foreground">Тип кор-лупа:</span>
            <select
              value={typeOverride}
              onChange={(e) => setTypeOverride(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {projects.length === 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              Нет проектов. Создайте проект на странице «Мои проекты».
            </p>
          )}
        </CardContent>
      </Card>

      {/* Prototype display */}
      {prototype && (
        <>
          <Card className="mb-4">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Gamepad2 className="h-5 w-5 text-primary" />
                    {prototype.project_name}
                  </CardTitle>
                  <CardDescription>{prototype.config.goal}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={TYPE_LABELS[prototype.config.type]?.color}>
                    {TYPE_LABELS[prototype.config.type]?.label || prototype.config.type}
                  </Badge>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    {prototype.config.mode?.toUpperCase()}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={handleRestart}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Заново
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-[1fr_200px] gap-4">
                <div className="rounded-lg overflow-hidden border border-border shadow-sm">
                  <iframe
                    ref={iframeRef}
                    srcDoc={prototype.html}
                    title="Прототип кор-лупа"
                    className="w-full h-[340px] block"
                  />
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Тип</p>
                    <Badge variant="outline" className={TYPE_LABELS[prototype.config.type]?.color}>
                      {TYPE_LABELS[prototype.config.type]?.label}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {TYPE_LABELS[prototype.config.type]?.desc}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Шаги</p>
                    <ol className="text-sm space-y-1 list-decimal list-inside">
                      {prototype.config.steps.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Ресурс</p>
                    <p className="text-sm font-medium">{prototype.config.resource}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Insights (if generated) */}
          {prototype.ai_insights && (
            <Card className="mb-4 border-primary/30 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  AI-инсайты для прототипа
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {prototype.ai_insights}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Playtest history */}
          {showHistory && (
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  История плейтестов ({history.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Нет сохранённых результатов.</p>
                ) : (
                  <>
                    {/* Stats summary */}
                    {(() => {
                      const wins = history.filter((h) => h.outcome === "win").length;
                      const losses = history.length - wins;
                      const winRate = Math.round((wins / history.length) * 100);
                      const byType: Record<string, { win: number; lose: number }> = {};
                      history.forEach((h) => {
                        const t = h.prototype_type;
                        if (!byType[t]) byType[t] = { win: 0, lose: 0 };
                        byType[t][h.outcome === "win" ? "win" : "lose"]++;
                      });
                      return (
                        <div className="mb-4 grid grid-cols-3 gap-2">
                          <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-2 text-center">
                            <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{wins}</div>
                            <div className="text-[10px] text-muted-foreground">Победы</div>
                          </div>
                          <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-2 text-center">
                            <div className="text-xl font-bold text-rose-700 dark:text-rose-300">{losses}</div>
                            <div className="text-[10px] text-muted-foreground">Поражения</div>
                          </div>
                          <div className="rounded-lg border border-primary/20 bg-primary/5 p-2 text-center">
                            <div className="text-xl font-bold text-primary">{winRate}%</div>
                            <div className="text-[10px] text-muted-foreground">Win rate</div>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                    {history.map((h) => (
                      <div
                        key={h.id}
                        className="flex items-center gap-3 rounded-lg border border-border p-2 text-xs"
                      >
                        <span className={`px-2 py-0.5 rounded font-medium ${
                          h.outcome === "win"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                        }`}>
                          {h.outcome === "win" ? "Победа" : "Поражение"}
                        </span>
                        <span className="font-medium">{h.prototype_type}</span>
                        <span className="text-muted-foreground">{h.mode.toUpperCase()}</span>
                        <span className="text-muted-foreground">{Math.round(h.duration_sec)}с</span>
                        {h.ai_generated && (
                          <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                            AI
                          </Badge>
                        )}
                        <span className="text-muted-foreground ml-auto">
                          {new Date(h.created_at).toLocaleString("ru-RU")}
                        </span>
                      </div>
                    ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Save result buttons */}
          <Card className="mb-4 border-primary/20">
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <Save className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1">Сохранить результат плейтеста</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Запишите исход, чтобы отслеживать итерации кор-лупа. Время засчитывается как 30 сек.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                      onClick={async () => {
                        try {
                          await apiFetch("/playtests/save", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              project_id: prototype.project_id,
                              prototype_type: prototype.config.type,
                              mode: prototype.config.mode,
                              outcome: "win",
                              duration_sec: 30,
                              ai_generated: prototype.ai_generated,
                            }),
                          });
                          toast({ title: "Сохранено", description: "Победа записана в историю" });
                        } catch (e) {
                          toast({ title: "Ошибка", description: "Не удалось сохранить", variant: "destructive" });
                        }
                      }}
                    >
                      🎉 Победа
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-500/10"
                      onClick={async () => {
                        try {
                          await apiFetch("/playtests/save", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              project_id: prototype.project_id,
                              prototype_type: prototype.config.type,
                              mode: prototype.config.mode,
                              outcome: "lose",
                              duration_sec: 30,
                              ai_generated: prototype.ai_generated,
                            }),
                          });
                          toast({ title: "Сохранено", description: "Поражение записано в историю" });
                        } catch (e) {
                          toast({ title: "Ошибка", description: "Не удалось сохранить", variant: "destructive" });
                        }
                      }}
                    >
                      💀 Поражение
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-800 dark:text-amber-300">
                  <p className="font-medium mb-1">Это супер-упрощённый прототип</p>
                  <p>
                    Прототип проверяет только <strong>структурный тип</strong> кор-лупа и базовый
                    «fun factor». Для реальной игры потребуется полноценная реализация механик,
                    контента и баланса. Используйте результат, чтобы решить, стоит ли продолжать
                    с этим кор-лупом или вернуться к Блоку 2.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
