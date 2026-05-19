"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Lightbulb,
  Loader2,
  Rocket,
  AlertCircle,
  ArrowRight,
  GitBranch,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { usePipeline } from "@/hooks/use-pipeline";
import { apiRoutes } from "@/config/api";

// Extracted types & constants
import type { ConceptFormState, ConceptGenerationResult } from "@/types/concept";
import { LOOP_TYPE_LABELS } from "@/constants/concept";

// Extracted sub-components
import {
  OnePagerCard,
  AestheticProfileView,
  DynamicsProfileCard,
  MechanicSetView,
  CoreLoopCandidates,
  USPCandidates,
  ValidationReportView,
  ConceptForm,
  SelectionSummary,
} from "@/components/gidede/concept";

// Shared components
import { EmptyStateCard } from "@/components/gidede/shared";

// ============================================================
// Компонент
// ============================================================

export default function Block1Page() {
  const { apiFetch } = useAuth();
  const { toast } = useToast();

  // --- Pipeline ---
  const projectId = typeof window !== "undefined" ? localStorage.getItem("gidede_active_project") : null;
  const pipeline = usePipeline(projectId);
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);

  // --- Состояние формы ---
  const [form, setForm] = useState<ConceptFormState>({
    idea: "",
    genreMode: "auto",
    genre: "",
    targetMotivations: [],
    experienceLevel: "midcore",
    platforms: ["pc"],
    referenceGames: "",
    budget: "small",
    forbiddenMechanics: [],
    forbiddenInput: "",
  });

  // --- Состояние генерации ---
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ConceptGenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState<string | null>(null);

  // --- Состояние выбора ---
  const [selectedCoreLoopIndex, setSelectedCoreLoopIndex] = useState<number | null>(null);
  const [selectedUSPIndex, setSelectedUSPIndex] = useState<number | null>(null);

  // --- Валидация ---
  const ideaLength = form.idea.trim().length;
  const isIdeaValid = ideaLength >= 10 && ideaLength <= 1000;
  const isMotivationsValid = form.targetMotivations.length >= 1;
  const isFormValid = isIdeaValid && isMotivationsValid;

  // --- Запуск полного пайплайна 1→2→3 ---
  const handleRunFullPipeline = useCallback(async () => {
    if (!isFormValid) return;
    if (!projectId) {
      toast({ title: "Нет активного проекта", description: "Выберите проект в сайдбаре", variant: "destructive" });
      return;
    }

    setIsRunningPipeline(true);
    setError(null);
    setCurrentStage("Запуск полного пайплайна 1→2→3...");

    try {
      const payload = {
        idea: form.idea.trim(),
        genre: form.genreMode === "auto" ? null : form.genre,
        target_audience: form.targetMotivations.length > 0
          ? { primary: form.targetMotivations, experience: form.experienceLevel }
          : null,
        platform: form.platforms.length > 0 ? form.platforms : null,
        constraints: {
          team_size: form.budget === "solo" ? 1 : form.budget === "small" ? 3 : form.budget === "medium" ? 10 : 20,
          budget: form.budget === "solo" || form.budget === "small" ? "low" : form.budget === "medium" ? "medium" : "high",
        },
        reference_games: form.referenceGames ? form.referenceGames.split(",").map((g: string) => g.trim()).filter(Boolean) : null,
        forbidden_mechanics: form.forbiddenMechanics.length > 0 ? form.forbiddenMechanics : null,
      };

      const data = await apiFetch<{
        concept_result?: ConceptGenerationResult;
        stages_completed?: number[];
        detail?: string;
      }>(
        apiRoutes.pipeline.runPartial(projectId),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ concept_input: payload }),
        }
      );

      if (data.detail) throw new Error(data.detail);
      setCurrentStage(null);

      if (data.concept_result) setResult(data.concept_result as ConceptGenerationResult);
      await pipeline.fetchState();

      toast({ title: "Полный пайплайн завершён", description: `Блоки 1→2→3 выполнены. ${data.stages_completed?.length || 3} этапа.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка запуска пайплайна";
      setError(message);
      toast({ title: "Ошибка пайплайна", description: message, variant: "destructive" });
      setCurrentStage(null);
    } finally {
      setIsRunningPipeline(false);
    }
  }, [form, isFormValid, projectId, apiFetch, pipeline, toast]);

  // --- Генерация концепции ---
  const handleGenerate = useCallback(async () => {
    if (!isFormValid) return;

    setIsGenerating(true);
    setError(null);
    setResult(null);
    setSelectedCoreLoopIndex(null);
    setSelectedUSPIndex(null);
    setCurrentStage("Этап 1: Анализ и определение жанра...");

    try {
      const payload = {
        idea: form.idea.trim(),
        genre: form.genreMode === "auto" ? null : form.genre,
        target_audience: form.targetMotivations.length > 0
          ? { primary: form.targetMotivations, experience: form.experienceLevel }
          : null,
        platform: form.platforms.length > 0 ? form.platforms : null,
        constraints: {
          team_size: form.budget === "solo" ? 1 : form.budget === "small" ? 3 : form.budget === "medium" ? 10 : 20,
          budget: form.budget === "solo" || form.budget === "small" ? "low" : form.budget === "medium" ? "medium" : "high",
        },
        reference_games: form.referenceGames ? form.referenceGames.split(",").map((g) => g.trim()).filter(Boolean) : null,
        forbidden_mechanics: form.forbiddenMechanics.length > 0 ? form.forbiddenMechanics : null,
      };

      const response = await apiFetch<ConceptGenerationResult>("/concept/generate", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setCurrentStage(null);
      setResult(response);

      // Уведомляем pipeline об обновлении Блока 1
      try {
        const pid = typeof window !== "undefined" ? localStorage.getItem("gidede_active_project") : null;
        if (pid) {
          await apiFetch(apiRoutes.pipeline.notify(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ project_id: pid, block_id: 1, metadata: { concept_id: response.id } }),
          });
        }
      } catch {
        // Pipeline notification is non-critical
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Произошла ошибка при генерации концепции");
      setCurrentStage(null);
    } finally {
      setIsGenerating(false);
    }
  }, [form, isFormValid, apiFetch]);

  // --- Сохранение выбора ---
  const handleSaveSelection = useCallback(() => {
    toast({
      title: "Выбор сохранён",
      description: `Core Loop: ${selectedCoreLoopIndex !== null ? `Вариант ${selectedCoreLoopIndex + 1}` : "не выбран"} · USP: ${selectedUSPIndex !== null ? `Вариант ${selectedUSPIndex + 1}` : "не выбран"}`,
    });
  }, [selectedCoreLoopIndex, selectedUSPIndex, toast]);

  // ============================================================
  // Рендер
  // ============================================================

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Заголовок */}
      <div className="flex items-center gap-3 mb-6">
        <Lightbulb className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Генератор концепции</h1>
          <p className="text-sm text-muted-foreground">Блок 1 &bull; Алгоритм 3.1 &bull; 7 этапов</p>
        </div>
        <Badge variant="outline" className={result ? "text-green-600 ml-auto" : "text-yellow-600 ml-auto"}>
          {result ? "Реализация 4.B.1–4.B.5" : "Реализация 4.B.1"}
        </Badge>
      </div>

      {/* Pipeline Data Flow Indicator */}
      {projectId && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Пайплайн:</span>
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-[10px] font-bold">Блок 1 ←</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="text-[10px]">Блок 2</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="text-[10px]">Блок 3</Badge>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRunFullPipeline} disabled={isRunningPipeline || !isFormValid} className="text-xs h-7">
              {isRunningPipeline ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Rocket className="h-3 w-3 mr-1" />}
              Запустить пайплайн 1→2→3
            </Button>
          </div>
        </div>
      )}

      {/* === ФОРМА ВВОДА === */}
      <ConceptForm
        form={form}
        setForm={setForm}
        isGenerating={isGenerating}
        isFormValid={isFormValid}
        currentStage={currentStage}
        onGenerate={handleGenerate}
      />

      {/* === ОШИБКА === */}
      {error && (
        <Card className="border-red-300 bg-red-50 dark:bg-red-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <p className="font-medium text-red-700 dark:text-red-400">Ошибка генерации</p>
                <p className="text-sm text-red-600 dark:text-red-300 mt-1">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* === РЕЗУЛЬТАТ ГЕНЕРАЦИИ === */}
      {result && (
        <div className="space-y-4">
          <OnePagerCard result={result} />

          {result.aesthetic_profile && <AestheticProfileView profile={result.aesthetic_profile} />}
          {result.dynamics_profile && <DynamicsProfileCard dynamicsProfile={result.dynamics_profile} />}
          {result.mechanic_set && <MechanicSetView mechanicSet={result.mechanic_set} />}

          {result.core_loop_candidates && result.core_loop_candidates.length > 0 && (
            <CoreLoopCandidates candidates={result.core_loop_candidates} selectedIndex={selectedCoreLoopIndex} onSelect={setSelectedCoreLoopIndex} />
          )}

          {result.usp_candidates && result.usp_candidates.length > 0 && (
            <USPCandidates candidates={result.usp_candidates} selectedIndex={selectedUSPIndex} onSelect={setSelectedUSPIndex} />
          )}

          {result.validation_report && <ValidationReportView report={result.validation_report} />}

          <SelectionSummary result={result} selectedCoreLoopIndex={selectedCoreLoopIndex} selectedUSPIndex={selectedUSPIndex} onSave={handleSaveSelection} />
        </div>
      )}

      {/* Пустое состояние */}
      {!result && !isGenerating && !error && (
        <EmptyStateCard
          icon={Lightbulb}
          title="Заполните форму и нажмите «Сгенерировать концепцию»"
          description="Backend-реализация: Этапы 1–3 (4.B.2) · Этапы 4–5 (4.B.3) · Этапы 6–7 (4.B.4) · UI (4.B.5)"
        />
      )}
    </div>
  );
}
