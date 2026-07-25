"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Lightbulb, RefreshCw, FlaskConical, Scale, TrendingUp,
  FileText, Bot, Puzzle, Rocket, CheckCircle2, Circle, Loader2, AlertCircle, ArrowRight
} from "lucide-react";
import Link from "next/link";
import { BLOCKS } from "@/config/blocks";

interface Project {
  id: string;
  name: string;
  has_concept: boolean;
  has_core_loop: boolean;
  has_mda: boolean;
  has_balance: boolean;
  has_progression: boolean;
  has_economy: boolean;
  has_gdd: boolean;
  has_checklist: boolean;
  completion_percent: number;
}

interface PipelineState {
  project_id: string;
  project_name: string;
  blocks: Array<{
    block_id: number;
    name: string;
    status: string;
    is_filled: boolean;
  }>;
  completion_percent: number;
  current_stage: string;
  next_block: number | null;
}

const BLOCK_ICONS = [Lightbulb, RefreshCw, FlaskConical, Scale, TrendingUp, FileText, Bot, Puzzle];

export default function PipelinePage() {
  const { apiFetch, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [pipeline, setPipeline] = useState<PipelineState | null>(null);
  const [running, setRunning] = useState(false);
  const [runProgress, setRunProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<string>("");

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      apiFetch<{ projects: Project[] }>("/projects/?per_page=50")
        .then((data) => setProjects(data.projects))
        .catch(() => {});
    }
  }, [authLoading, isAuthenticated, apiFetch]);

  const loadPipeline = useCallback(async (projectId: string) => {
    try {
      const data = await apiFetch<PipelineState>(`/pipeline/state/${projectId}`);
      setPipeline(data);
    } catch {
      setPipeline(null);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (selectedProject) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadPipeline(selectedProject);
    }
  }, [selectedProject, loadPipeline]);

  const runFullPipeline = async () => {
    if (!selectedProject) return;
    setRunning(true);
    setRunProgress(5);
    setCurrentStep("Запуск серверного пайплайна...");

    try {
      // Single server-side call runs all 8 blocks sequentially with persistence.
      const result = await apiFetch<{
        stages_completed: number;
        stages_total: number;
        stages: Array<{ stage: string; block_name: string; status: string; message: string }>;
        completion_percent: number;
        note?: string;
      }>(`/pipeline/run-full-pipeline/${selectedProject}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: "Сгенерировать концепцию из данных проекта",
          format: "one_sheet",
          total_levels: 50,
        }),
      });

      setRunProgress(100);
      setCurrentStep(`Готово: ${result.stages_completed}/${result.stages_total} стадий`);

      // Report per-stage results.
      for (const stage of result.stages) {
        const ok = stage.status === "completed";
        toast({
          title: `${ok ? "✅" : stage.status === "skipped" ? "⏭️" : "⚠️"} ${stage.block_name} — ${stage.stage}`,
          description: stage.message,
          variant: ok ? "default" : "destructive",
        });
      }

      toast({
        title: result.stages_completed === result.stages_total
          ? "🎉 Пайплайн завершён"
          : "⚠️ Пайплайн завершён с ошибками",
        description: result.note || `Выполнено ${result.stages_completed}/${result.stages_total} стадий. Завершённость: ${result.completion_percent}%`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Неизвестная ошибка";
      setCurrentStep("Ошибка");
      toast({
        title: "❌ Ошибка пайплайна",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setRunning(false);
      loadPipeline(selectedProject);
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
        <Rocket className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Войдите в аккаунт</h2>
        <p className="text-muted-foreground">Пайплайн доступен после авторизации.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Rocket className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Сквозной пайплайн</h1>
          <p className="text-sm text-muted-foreground">
            От идеи до GDD за 60 минут — 8 блоков в одном потоке
          </p>
        </div>
      </div>

      {/* Project selector + Run button */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">1. Выберите проект</CardTitle>
          <CardDescription>Пайплайн обработает все 8 блоков последовательно</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Выберите проект —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.completion_percent}% завершено)
                </option>
              ))}
            </select>
            <Button
              onClick={runFullPipeline}
              disabled={!selectedProject || running}
              className="sm:w-auto"
              size="lg"
            >
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {currentStep}
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4 mr-2" />
                  Запустить пайплайн
                </>
              )}
            </Button>
          </div>
          {running && (
            <div className="mt-3">
              <Progress value={runProgress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">{currentStep} ({runProgress}%)</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pipeline visualization */}
      {pipeline ? (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Состояние пайплайна</CardTitle>
                <CardDescription>{pipeline.project_name} • {pipeline.completion_percent}% завершено</CardDescription>
              </div>
              <Badge variant={pipeline.completion_percent >= 100 ? "default" : "secondary"}>
                {pipeline.current_stage || "—"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* Visual flow */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {pipeline.blocks.map((block, i) => {
                const Icon = BLOCK_ICONS[i] || Circle;
                const isComplete = block.status === "completed";
                const isInProgress = block.status === "in_progress";
                const isStale = block.status === "stale";

                return (
                  <Link
                    key={block.block_id}
                    href={`/blocks/${block.block_id}`}
                    className="group relative flex flex-col items-center p-3 rounded-lg border transition-all hover:shadow-md"
                    style={{
                      borderColor: isComplete ? "#10b981" : isStale ? "#f59e0b" : "#e2e8f0",
                      backgroundColor: isComplete ? "rgba(16,185,129,0.05)" : isStale ? "rgba(245,158,11,0.05)" : "transparent",
                    }}
                  >
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full mb-2 transition-colors"
                      style={{
                        backgroundColor: isComplete ? "#10b981" : isStale ? "#f59e0b" : "#e2e8f0",
                        color: isComplete || isStale ? "#fff" : "#64748b",
                      }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-medium text-center truncate w-full">
                      {BLOCKS[i]?.name || block.name}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      {isComplete ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      ) : isStale ? (
                        <AlertCircle className="h-3 w-3 text-amber-500" />
                      ) : (
                        <Circle className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {isComplete ? "Готов" : isStale ? "Устарел" : "Пусто"}
                      </span>
                    </div>
                    {/* Arrow to next */}
                    {i < pipeline.blocks.length - 1 && (
                      <ArrowRight className="hidden sm:block absolute -right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Прогресс</span>
                <span className="font-medium">{pipeline.completion_percent}%</span>
              </div>
              <Progress value={pipeline.completion_percent} className="h-2" />
            </div>
          </CardContent>
        </Card>
      ) : selectedProject ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Загрузка состояния пайплайна...</p>
          </CardContent>
        </Card>
      ) : null}

      {/* Concept card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-3">
            <Rocket className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium mb-1">Как это работает</p>
              <p className="text-muted-foreground leading-relaxed">
                Пайплайн последовательно запускает все 8 блоков: Концепция → Core Loop → MDA →
                Баланс → Прогрессия → Экономика → GDD → Чек-лист. Каждый блок использует данные
                из предыдущих. Результат — готовый Game Design Document с валидацией.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
