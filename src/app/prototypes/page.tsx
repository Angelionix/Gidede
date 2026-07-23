"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gamepad2, Play, RotateCcw, Lightbulb, AlertCircle, Loader2, FlaskConical, Box, Square } from "lucide-react";

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
  project_id: string;
  project_name: string;
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
  const [loading, setLoading] = useState(false);
  const [prototype, setPrototype] = useState<PrototypeResponse | null>(null);

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
        body: JSON.stringify({ project_id: selectedProject, mode }),
      });
      setPrototype(data);
      toast({
        title: `Прототип готов (${mode.toUpperCase()})`,
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
          <div className="flex items-center gap-2">
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
