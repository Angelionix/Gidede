"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  Loader2,
  AlertCircle,
  Check,
  ArrowRight,
  CheckCircle2,
  ArrowDownToLine,
  GitBranch,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { usePipeline } from "@/hooks/use-pipeline";
import { apiRoutes } from "@/config/api";
import { GENRES } from "@/config/genres";
import { LOOP_TYPES, DEFAULT_MECHANICS } from "@/constants/coreloop";
import type { CoreLoopFormState, CoreLoopDesignResult } from "@/types/coreloop";
import {
  StructuralTypeCard,
  CoreLoopDiagram,
  CoreLoopStepEditor,
  type CoreLoopEditableStep,
  LoopHierarchyTree,
  PathologyPanel,
  ValidationPanel,
  RecommendationsPanel,
} from "@/components/gidede/coreloop";

// ============================================================
// Main Page Component
// ============================================================

export default function Block2Page() {
  const { apiFetch } = useAuth();
  const { toast } = useToast();

  // --- Pipeline ---
  const projectId = typeof window !== "undefined" ? localStorage.getItem("gidede_active_project") : null;
  const pipeline = usePipeline(projectId);
  const [pipelineLoaded, setPipelineLoaded] = useState(false);
  const [isLoadingPipeline, setIsLoadingPipeline] = useState(false);

  // --- Form state ---
  const [form, setForm] = useState<CoreLoopFormState>({
    conceptId: "",
    mechanics: DEFAULT_MECHANICS,
    genre: "rpg",
    desiredLoopType: "",
    customSteps: "",
  });

  // --- Generation state ---
  const [isDesigning, setIsDesigning] = useState(false);
  const [result, setResult] = useState<CoreLoopDesignResult | null>(null);
  const [editedSteps, setEditedSteps] = useState<CoreLoopEditableStep[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- Pipeline auto-fill handler ---
  const handleLoadFromPipeline = useCallback(async () => {
    if (!projectId) {
      toast({ title: "Нет активного проекта", description: "Выберите проект для загрузки данных из пайплайна", variant: "destructive" });
      return;
    }
    setIsLoadingPipeline(true);
    try {
      const data = (await pipeline.prepareInput(2)) as Record<string, unknown> | null;
      if (!data) {
        toast({ title: "Нет данных", description: "Не удалось загрузить данные из пайплайна. Убедитесь, что Блок 1 заполнен.", variant: "destructive" });
        return;
      }

      // Реальная форма ответа /pipeline/prepare-input:
      //   { project_id, block_id, block_name, prepared_input: {
      //       upstream: { concept: { genre, primary_aesthetic, usp, ... },
      //                    core_loop: { steps, ... } },
      //       suggested: { genre, ... } }, context, ready }
      const prepared = (data.prepared_input as Record<string, unknown> | undefined) || data;
      const upstream = (prepared.upstream as Record<string, unknown> | undefined) || {};
      const concept = (upstream.concept as Record<string, unknown> | undefined) || {};
      const suggested = (prepared.suggested as Record<string, unknown> | undefined) || {};

      const updates: Partial<CoreLoopFormState> = {};
      // concept_id хранится в project_id (он же concept.projectId), но в
      // prepared_input его нет — берём из верхнего уровня.
      if (typeof data.project_id === "string") {
        updates.conceptId = data.project_id;
      }
      const genre = (concept.genre as string | undefined) || (suggested.genre as string | undefined);
      if (genre) updates.genre = genre;

      // Механики — из concept.mechanic_set (массив объектов MechanicsDB)
      const mechanicSet = concept.mechanic_set;
      if (Array.isArray(mechanicSet) && mechanicSet.length > 0) {
        const names = mechanicSet
          .map((m: unknown) => {
            if (typeof m === "string") return m;
            if (m && typeof m === "object") {
              const obj = m as Record<string, unknown>;
              return (obj.name as string | undefined) || (obj.id as string | undefined) || "";
            }
            return "";
          })
          .filter(Boolean);
        if (names.length > 0) updates.mechanics = names.join(", ");
      }

      if (Object.keys(updates).length > 0) {
        setForm((prev) => ({ ...prev, ...updates }));
        setPipelineLoaded(true);
        toast({
          title: "Данные загружены из пайплайна",
          description: `Загружено: ${Object.keys(updates).map((k) => {
            const labels: Record<string, string> = { conceptId: "ID концепции", mechanics: "Механики", genre: "Жанр" };
            return labels[k] || k;
          }).join(", ")}`,
        });
      } else {
        toast({ title: "Нет данных для загрузки", description: "Пайплайн не содержит данных для этого блока" });
      }
    } catch {
      toast({ title: "Ошибка загрузки", description: "Не удалось загрузить данные из пайплайна", variant: "destructive" });
    } finally {
      setIsLoadingPipeline(false);
    }
  }, [projectId, pipeline, toast]);

  // Авто-загрузка данных из пайплайна при первом монтировании (если проект выбран).
  useEffect(() => {
    if (projectId && !pipelineLoaded && !isLoadingPipeline) {
      handleLoadFromPipeline();
    }
  }, [projectId, pipelineLoaded, isLoadingPipeline, handleLoadFromPipeline]);

  // --- Validation ---
  const mechanicsLength = form.mechanics.trim().length;
  const isFormValid = mechanicsLength >= 3;

  // --- Handlers ---
  const updateField = useCallback(
    <K extends keyof CoreLoopFormState>(field: K, value: CoreLoopFormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleDesign = useCallback(async () => {
    if (!isFormValid) return;

    setIsDesigning(true);
    setError(null);
    setResult(null);

    try {
      const mechanicsList = form.mechanics
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);

      const customStepsList = form.customSteps
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const body: Record<string, unknown> = {
        concept_id: form.conceptId || "standalone",
        mechanics: mechanicsList,
        genre: form.genre,
      };
      // Отправляем project_id, чтобы сервер записал результат в правильный проект,
      // а не в auto-selected "most-recent".
      if (projectId) {
        body.project_id = projectId;
      }

      if (form.desiredLoopType) {
        body.desired_loop_type = form.desiredLoopType;
      }
      if (customStepsList.length > 0) {
        body.custom_steps = customStepsList;
      }

      const data = await apiFetch<CoreLoopDesignResult>("/api/v1/coreloop/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      setResult(data);

      // Уведомляем pipeline об обновлении Блока 2
      try {
        const projectId = typeof window !== "undefined" ? localStorage.getItem("gidede_active_project") : null;
        if (projectId) {
          await apiFetch(
            apiRoutes.pipeline.notify(),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ project_id: projectId, block_id: 2, metadata: {} }),
            }
          );
        }
      } catch {
        // Pipeline notification is non-critical
      }

      toast({
        title: "Core Loop спроектирован",
        description: `Этапы: ${data.stages_completed?.join(", ") || "1-5"}. ${data.pathologies?.total_count || 0} патологий.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Неизвестная ошибка";
      setError(message);
      toast({
        title: "Ошибка проектирования",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsDesigning(false);
    }
  }, [form, isFormValid, apiFetch, toast]);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <RefreshCw className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Core Loop Designer</h1>
          <p className="text-sm text-muted-foreground">
            Блок 2 • Алгоритм 3.2 • 5 этапов
          </p>
        </div>
        <Badge variant="outline" className="text-green-600 ml-auto">
          <Check className="h-3 w-3 mr-1" />
          Активен
        </Badge>
      </div>

      {/* Pipeline Data Flow Indicator */}
      {projectId && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Пайплайн:</span>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-[10px]">Блок 1</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="secondary" className="text-[10px] font-bold">Блок 2 ←</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="text-[10px]">Блок 3</Badge>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {pipelineLoaded && (
              <Badge variant="outline" className="text-[10px] border-green-400 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Данные из пайплайна
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadFromPipeline}
              disabled={isLoadingPipeline}
              className="text-xs h-7"
            >
              {isLoadingPipeline ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <ArrowDownToLine className="h-3 w-3 mr-1" />
              )}
              Загрузить из пайплайна
            </Button>
          </div>
        </div>
      )}

      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Параметры проектирования</CardTitle>
          <CardDescription>
            Укажите данные для проектирования Core Loop. Алгоритм 3.2: классификация → иерархия → патологии → валидация → рекомендации.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Concept ID */}
          <div className="space-y-1.5">
            <Label htmlFor="conceptId" className="text-sm">ID концепции (из Блока 1)</Label>
            <Input
              id="conceptId"
              placeholder="Оставьте пустым для автономного проектирования"
              value={form.conceptId}
              onChange={(e) => updateField("conceptId", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Если концепция создана в Блоке 1, укажите её ID для автоматической загрузки данных.
            </p>
          </div>

          {/* Mechanics */}
          <div className="space-y-1.5">
            <Label htmlFor="mechanics" className="text-sm">Механики (через запятую) *</Label>
            <Input
              id="mechanics"
              placeholder={DEFAULT_MECHANICS}
              value={form.mechanics}
              onChange={(e) => updateField("mechanics", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Механики из MechanicsDB, которые определяют Core Loop. Минимум 2-3 механики.
            </p>
          </div>

          {/* Genre */}
          <div className="space-y-1.5">
            <Label className="text-sm">Жанр</Label>
            <Select value={form.genre} onValueChange={(v) => updateField("genre", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите жанр" />
              </SelectTrigger>
              <SelectContent>
                {GENRES.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Жанр влияет на определение структурного типа Core Loop.
            </p>
          </div>

          {/* Desired Loop Type */}
          <div className="space-y-1.5">
            <Label className="text-sm">Желаемый тип петли</Label>
            <Select value={form.desiredLoopType} onValueChange={(v) => updateField("desiredLoopType", v === "auto" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Определить автоматически" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Определить автоматически</SelectItem>
                {LOOP_TYPES.map((lt) => (
                  <SelectItem key={lt.value} value={lt.value}>
                    {lt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Loop type descriptions */}
          {form.desiredLoopType && form.desiredLoopType !== "auto" && (
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">
                {LOOP_TYPES.find(lt => lt.value === form.desiredLoopType)?.description}
              </p>
            </div>
          )}

          {/* Custom Steps */}
          <div className="space-y-1.5">
            <Label htmlFor="customSteps" className="text-sm">Пользовательские шаги (по строкам)</Label>
            <Textarea
              id="customSteps"
              placeholder={"Найти врага\nСразиться\nПолучить награду\nУлучшить экипировку"}
              value={form.customSteps}
              onChange={(e) => updateField("customSteps", e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Необязательно. Каждый шаг на отдельной строке. Если не указаны, шаги генерируются автоматически.
            </p>
          </div>

          {/* Submit button */}
          <Button
            onClick={handleDesign}
            disabled={!isFormValid || isDesigning}
            className="w-full"
            size="lg"
          >
            {isDesigning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Проектирование Core Loop...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Проектировать Core Loop
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="py-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">Ошибка проектирования</p>
                <p className="text-xs text-muted-foreground mt-1">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-6 animate-fade-in" aria-live="polite">
          {/* Meta info */}
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-xs">
                    Этапы: {result.stages_completed.join(", ")}
                  </Badge>
                  {result.latency_ms > 0 && (
                    <Badge variant="outline" className="text-xs">{result.latency_ms} мс</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {result.models_used.map((m, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">{m}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 1. Structural Type */}
          {result.structural_type && Object.keys(result.structural_type).length > 0 && (
            <StructuralTypeCard structuralType={result.structural_type} />
          )}

          {/* 1.5. Visual Core Loop Diagram */}
          {result.steps && result.steps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Визуальная диаграмма Core Loop</CardTitle>
                <CardDescription>Круговая визуализация шагов игрового цикла</CardDescription>
              </CardHeader>
              <CardContent>
                <CoreLoopDiagram
                  steps={(editedSteps || result.steps) as Array<Record<string, unknown>>}
                  structuralType={result.structural_type?.type as string | undefined}
                  pathologies={result.pathologies?.pathologies as Array<{ name: string; type: string; severity: string }> | undefined}
                />
              </CardContent>
            </Card>
          )}

          {/* 1.6. Step Editor — позволяет править шаги после генерации */}
          {result.steps && result.steps.length > 0 && (
            <CoreLoopStepEditor
              steps={(editedSteps || result.steps) as CoreLoopEditableStep[]}
              projectId={projectId}
              onSaved={(updated) => setEditedSteps(updated)}
            />
          )}

          {/* 3. Loop Hierarchy */}
          {result.loop_hierarchy && Object.keys(result.loop_hierarchy).length > 0 && (
            <LoopHierarchyTree hierarchy={result.loop_hierarchy} />
          )}

          {/* 4. Pathologies */}
          {result.pathologies && Object.keys(result.pathologies).length > 0 && (
            <PathologyPanel pathologies={result.pathologies} />
          )}

          {/* 5. Validation */}
          {result.validation && Object.keys(result.validation).length > 0 && (
            <ValidationPanel validation={result.validation} />
          )}

          {/* 6. Recommendations */}
          {result.recommendations && result.recommendations.length > 0 && (
            <RecommendationsPanel recommendations={result.recommendations} />
          )}
        </div>
      )}
    </div>
  );
}
