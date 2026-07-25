"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Eye,
  ArrowRight,
  Target,
  Activity,
  Layers,
  Loader2,
  ArrowDownToLine,
  FlaskConical,
  GitBranch,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { usePipeline } from "@/hooks/use-pipeline";
import { apiRoutes } from "@/config/api";
import type { MDAFormState, MDAAnalysisResult } from "@/types/mda";
import {
  MDAInputForm,
  ReverseMDAPanel,
  ClassicMDAPanel,
  LensAuditPanel,
  BondMatrixPanel,
} from "@/components/gidede/mda";

// ============================================================
// Main Page Component
// ============================================================

export default function Block3Page() {
  const { apiFetch } = useAuth();
  const { toast } = useToast();

  // --- Pipeline ---
  const projectId = typeof window !== "undefined" ? localStorage.getItem("gidede_active_project") : null;
  const pipeline = usePipeline(projectId);
  const [pipelineLoaded, setPipelineLoaded] = useState(false);
  const [isLoadingPipeline, setIsLoadingPipeline] = useState(false);
  const [pipelineWarning, setPipelineWarning] = useState<string | null>(null);

  // --- Form state ---
  const [form, setForm] = useState<MDAFormState>({
    conceptId: "",
    genre: "rpg",
    primaryAesthetic: "challenge",
    secondaryAesthetic: "fantasy",
    tertiaryAesthetic: "discovery",
    idea: "",
    existingMechanics: "",
    requiredMechanics: "",
    forbiddenMechanics: "",
    maxMechanics: 18,
    convergenceThreshold: 0.8,
    fullAnalysis: true,
  });

  // --- Generation state ---
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<MDAAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("reverse");

  // --- Pipeline auto-fill handler ---
  const handleLoadFromPipeline = useCallback(async () => {
    if (!projectId) {
      toast({ title: "Нет активного проекта", description: "Выберите проект для загрузки данных из пайплайна", variant: "destructive" });
      return;
    }
    setIsLoadingPipeline(true);
    setPipelineWarning(null);
    try {
      const data = (await pipeline.prepareInput(3)) as Record<string, unknown> | null;
      if (!data) {
        toast({ title: "Нет данных", description: "Не удалось загрузить данные из пайплайна. Убедитесь, что предыдущие блоки заполнены.", variant: "destructive" });
        return;
      }

      // Реальная форма ответа /pipeline/prepare-input:
      //   { project_id, block_id, block_name, prepared_input: {
      //       upstream: { concept: {...}, core_loop: {...}, mda: {...} },
      //       suggested: { genre, ... } }, context, ready }
      const prepared = (data.prepared_input as Record<string, unknown> | undefined) || data;
      const upstream = (prepared.upstream as Record<string, unknown> | undefined) || {};
      const concept = (upstream.concept as Record<string, unknown> | undefined) || {};
      const coreLoop = (upstream.core_loop as Record<string, unknown> | undefined) || {};
      const suggested = (prepared.suggested as Record<string, unknown> | undefined) || {};

      const updates: Partial<MDAFormState> = {};
      if (typeof data.project_id === "string") updates.conceptId = data.project_id;
      const genre = (concept.genre as string | undefined) || (suggested.genre as string | undefined);
      if (genre) updates.genre = genre;

      // primary_aesthetic — из concept.aesthetic_profile (вложенный объект),
      // либо из top-level concept.primary_aesthetic.
      const aestheticProfile = concept.aesthetic_profile as Record<string, unknown> | undefined;
      const primaryAesthetic =
        (aestheticProfile?.primary_aesthetic as string | undefined) ||
        (concept.primary_aesthetic as string | undefined);
      if (primaryAesthetic) updates.primaryAesthetic = primaryAesthetic;
      const secondaryAesthetic = aestheticProfile?.secondary_aesthetic as string | undefined;
      if (secondaryAesthetic) updates.secondaryAesthetic = secondaryAesthetic;
      const tertiaryAesthetic = aestheticProfile?.tertiary_aesthetic as string | undefined;
      if (tertiaryAesthetic) updates.tertiaryAesthetic = tertiaryAesthetic;

      const idea = (concept.one_pager as string | undefined) ||
        (data.project_description as string | undefined);
      if (idea) updates.idea = idea;

      // Существующие механики — из core_loop.steps (массив CoreStep с mechanics[]) или concept.mechanic_set
      const existingMechanics = new Set<string>();
      const coreSteps = coreLoop.steps;
      if (Array.isArray(coreSteps)) {
        for (const step of coreSteps) {
          if (step && typeof step === "object") {
            const mechs = (step as Record<string, unknown>).mechanics;
            if (Array.isArray(mechs)) {
              for (const m of mechs) {
                if (typeof m === "string") existingMechanics.add(m);
              }
            }
          }
        }
      }
      const conceptMechanicSet = concept.mechanic_set;
      if (Array.isArray(conceptMechanicSet)) {
        for (const m of conceptMechanicSet) {
          if (typeof m === "string") existingMechanics.add(m);
          else if (m && typeof m === "object") {
            const obj = m as Record<string, unknown>;
            const name = (obj.name as string | undefined) || (obj.id as string | undefined);
            if (name) existingMechanics.add(name);
          }
        }
      }
      if (existingMechanics.size > 0) {
        updates.existingMechanics = Array.from(existingMechanics).join(", ");
      }

      if (data.warning) setPipelineWarning(data.warning as string);
      // core_loop отсутствует — предупреждаем (но не блокируем).
      if (!coreLoop || Object.keys(coreLoop).length === 0) {
        setPipelineWarning("Блок 2 (Core Loop) ещё не заполнен. Результаты MDA могут быть неполными.");
      }

      if (Object.keys(updates).length > 0) {
        setForm((prev) => ({ ...prev, ...updates }));
        setPipelineLoaded(true);
        toast({
          title: "Данные загружены из пайплайна",
          description: `Загружено: ${Object.keys(updates).map((k) => {
            const labels: Record<string, string> = { conceptId: "ID концепции", genre: "Жанр", primaryAesthetic: "Основная эстетика", secondaryAesthetic: "Вторичная эстетика", tertiaryAesthetic: "Третичная эстетика", idea: "Идея", existingMechanics: "Механики" };
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

  // Авто-загрузка данных из пайплайна при первом монтировании.
  useEffect(() => {
    if (projectId && !pipelineLoaded && !isLoadingPipeline) {
      handleLoadFromPipeline();
    }
  }, [projectId, pipelineLoaded, isLoadingPipeline, handleLoadFromPipeline]);

  // --- Validation & Handlers ---
  const isFormValid = form.primaryAesthetic !== "" && form.genre !== "";

  const updateField = useCallback(
    <K extends keyof MDAFormState>(field: K, value: MDAFormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleAnalyze = useCallback(async () => {
    if (!isFormValid) return;
    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const mechanicsList = form.existingMechanics.split(",").map((m) => m.trim()).filter(Boolean);
      const requiredList = form.requiredMechanics.split(",").map((m) => m.trim()).filter(Boolean);
      const forbiddenList = form.forbiddenMechanics.split(",").map((m) => m.trim()).filter(Boolean);

      const body: Record<string, unknown> = {
        concept_id: form.conceptId || "standalone",
        genre: form.genre,
        idea: form.idea,
        primary_aesthetic: form.primaryAesthetic,
        secondary_aesthetic: form.secondaryAesthetic,
        tertiary_aesthetic: form.tertiaryAesthetic,
        max_mechanics: form.maxMechanics,
        convergence_threshold: form.convergenceThreshold,
        full_analysis: form.fullAnalysis,
      };
      // Отправляем project_id, чтобы сервер записал результат в правильный проект,
      // а не в auto-selected "most-recent".
      if (projectId) {
        body.project_id = projectId;
      }
      if (mechanicsList.length > 0) body.existing_mechanics = mechanicsList;
      if (requiredList.length > 0) body.required_mechanics = requiredList;
      if (forbiddenList.length > 0) body.forbidden_mechanics = forbiddenList;

      const data = await apiFetch<MDAAnalysisResult>("/api/v1/mda/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setResult(data);

      // Notify pipeline
      try {
        const pid = typeof window !== "undefined" ? localStorage.getItem("gidede_active_project") : null;
        if (pid) {
          await apiFetch(apiRoutes.pipeline.notify(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ project_id: pid, block_id: 3, metadata: {} }),
          });
        }
      } catch { /* non-critical */ }

      toast({ title: "MDA-анализ завершён", description: `Этапы: ${data.stages_completed?.join(", ") || "1-3"}. ${data.latency_ms || 0} мс.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Неизвестная ошибка";
      setError(message);
      toast({ title: "Ошибка MDA-анализа", description: message, variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  }, [form, isFormValid, apiFetch, toast]);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <FlaskConical className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">MDA Lab</h1>
          <p className="text-sm text-muted-foreground">Блок 3 • Алгоритм 3.3 • 6 этапов</p>
        </div>
        <Badge variant="outline" className="text-green-600 ml-auto">
          <Check className="h-3 w-3 mr-1" />Активен
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
            <Badge variant="outline" className="text-[10px]">Блок 2</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="secondary" className="text-[10px] font-bold">Блок 3 ←</Badge>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {pipelineLoaded && (
              <Badge variant="outline" className="text-[10px] border-green-400 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-3 w-3 mr-1" />Данные из пайплайна
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={handleLoadFromPipeline} disabled={isLoadingPipeline} className="text-xs h-7">
              {isLoadingPipeline ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ArrowDownToLine className="h-3 w-3 mr-1" />}
              Загрузить из пайплайна
            </Button>
          </div>
        </div>
      )}

      {/* Input Form */}
      <MDAInputForm
        form={form}
        pipelineWarning={pipelineWarning}
        isAnalyzing={isAnalyzing}
        isFormValid={isFormValid}
        updateField={updateField}
        onAnalyze={handleAnalyze}
        result={result}
      />

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4">
            <div className="flex items-start gap-2 text-destructive">
              <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Ошибка MDA-анализа</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results — Tabs */}
      {result && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="animate-fade-in" aria-label="MDA результаты">
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full">
            <TabsTrigger value="reverse" className="text-xs"><Target className="h-3.5 w-3.5 mr-1.5" />Reverse MDA</TabsTrigger>
            <TabsTrigger value="classic" className="text-xs"><Eye className="h-3.5 w-3.5 mr-1.5" />Classic MDA</TabsTrigger>
            <TabsTrigger value="lenses" className="text-xs"><Activity className="h-3.5 w-3.5 mr-1.5" />Линзы Шелла</TabsTrigger>
            <TabsTrigger value="bond" className="text-xs"><Layers className="h-3.5 w-3.5 mr-1.5" />Матрица Бонда</TabsTrigger>
          </TabsList>
          <TabsContent value="reverse" className="mt-4"><ReverseMDAPanel result={result} /></TabsContent>
          <TabsContent value="classic" className="mt-4"><ClassicMDAPanel result={result} /></TabsContent>
          <TabsContent value="lenses" className="mt-4"><LensAuditPanel result={result} /></TabsContent>
          <TabsContent value="bond" className="mt-4"><BondMatrixPanel result={result} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
