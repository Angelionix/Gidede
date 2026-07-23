"use client";

import React, { useState, useCallback } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Zap,
  Milestone,
  Coins,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { usePipeline } from "@/hooks/use-pipeline";

// ============================================================
// External constants & types
// ============================================================

import { API_BASE_URL, apiRoutes } from "@/config/api";
import { GENRES } from "@/config/genres";
import { PROGRESSION_TYPES, MONETIZATION_MODELS, PACING_OPTIONS, OPENNESS_OPTIONS } from "@/constants/progression";
import type { ProgressionDesignResponse } from "@/types/progression";
import type { EconomyDesignResponse } from "@/types/economy";

// ============================================================
// Extracted sub-components
// ============================================================

import { MacroParamsTab, TiersTab, CurvesTab, ContentPlanTab, ValidationTab } from "@/components/gidede/progression";
import { ResourcesTab, ClassificationTab, MachinationsEconomyTab, DiagnosticsTab, SimulationEconomyTab } from "@/components/gidede/economy";

// ============================================================
// Main Component
// ============================================================

export default function Block5Page() {
  const { apiFetch } = useAuth();
  const { toast } = useToast();

  // --- Pipeline ---
  const projectId =
    typeof window !== "undefined"
      ? localStorage.getItem("gidede_active_project")
      : null;
  const pipeline = usePipeline(projectId);

  // --- Top-level tab ---
  const [mainTab, setMainTab] = useState("progression");

  // --- Progression form state ---
  const [progGenre, setProgGenre] = useState("rpg");
  const [progDuration, setProgDuration] = useState(40);
  const [progLevels, setProgLevels] = useState(50);
  const [progType, setProgType] = useState("exponential");
  const [progMonetization, setProgMonetization] = useState("f2p");
  const [progPacing, setProgPacing] = useState("balanced");

  // --- Economy form state ---
  const [ecoGenre, setEcoGenre] = useState("rpg");
  const [ecoMonetization, setEcoMonetization] = useState("f2p");
  const [ecoOpenness, setEcoOpenness] = useState("mixed");

  // --- Result state ---
  const [isProgLoading, setIsProgLoading] = useState(false);
  const [isEcoLoading, setIsEcoLoading] = useState(false);
  const [progResult, setProgResult] = useState<ProgressionDesignResponse | null>(null);
  const [ecoResult, setEcoResult] = useState<EconomyDesignResponse | null>(null);
  const [progError, setProgError] = useState<string | null>(null);
  const [ecoError, setEcoError] = useState<string | null>(null);

  // --- Progression sub-tab ---
  const [progSubTab, setProgSubTab] = useState("macro");
  // --- Economy sub-tab ---
  const [ecoSubTab, setEcoSubTab] = useState("resources");

  // --- Run Progression Design ---
  const handleRunProgression = useCallback(async () => {
    setIsProgLoading(true);
    setProgError(null);

    try {
      const payload = {
        genre: progGenre,
        target_duration: progDuration,
        target_levels: progLevels,
        progression_type: progType,
        monetization_model: progMonetization,
        pacing: progPacing,
        project_id: projectId || undefined,
      };

      const data = await apiFetch<ProgressionDesignResponse>("/progression/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setProgResult(data);

      if (projectId) {
        pipeline.notifyUpdated(5, {
          progression_id: data.id,
          progression_type: progType,
          overall_score: data.validation?.overall_score,
        });
      }

      toast({
        title: "Прогрессия спроектирована",
        description: `Завершено за ${data.latency_ms || 0} мс`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Неизвестная ошибка";
      setProgError(msg);
      toast({
        title: "Ошибка проектирования прогрессии",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsProgLoading(false);
    }
  }, [progGenre, progDuration, progLevels, progType, progMonetization, progPacing, projectId, apiFetch, pipeline, toast]);

  // --- Run Economy Design ---
  const handleRunEconomy = useCallback(async () => {
    setIsEcoLoading(true);
    setEcoError(null);

    try {
      const payload = {
        genre: ecoGenre,
        monetization_type: ecoMonetization,
        openness: ecoOpenness,
        project_id: projectId || undefined,
      };

      const data = await apiFetch<EconomyDesignResponse>("/economy/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setEcoResult(data);

      if (projectId) {
        pipeline.notifyUpdated(5, {
          economy_id: data.id,
          economic_type: data.classification?.type,
          overall_severity: data.diagnostics?.overall_severity,
        });
      }

      toast({
        title: "Экономика спроектирована",
        description: `Завершено за ${data.latency_ms || 0} мс`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Неизвестная ошибка";
      setEcoError(msg);
      toast({
        title: "Ошибка проектирования экономики",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsEcoLoading(false);
    }
  }, [ecoGenre, ecoMonetization, ecoOpenness, projectId, apiFetch, pipeline, toast]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <TrendingUp className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Экономика и прогрессия</h1>
          <p className="text-sm text-muted-foreground">Блок 5 • Алгоритмы 3.5–3.6</p>
        </div>
        {(progResult || ecoResult) && (
          <Badge variant="outline" className="ml-auto text-xs border-green-300 text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3 mr-1" />Спроектировано
          </Badge>
        )}
      </div>

      {/* Main Tabs */}
      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="progression" className="flex items-center gap-1.5">
            <Milestone className="h-4 w-4" />
            Прогрессия
          </TabsTrigger>
          <TabsTrigger value="economy" className="flex items-center gap-1.5">
            <Coins className="h-4 w-4" />
            Экономика
          </TabsTrigger>
        </TabsList>

        {/* ====================== PROGRESSION TAB ====================== */}
        <TabsContent value="progression" className="space-y-6 mt-4">
          {/* Input Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Milestone className="h-5 w-5 text-primary" />
                Параметры прогрессии
              </CardTitle>
              <CardDescription>Настройте параметры для проектирования прогрессии</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Genre */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Жанр</Label>
                  <Select value={progGenre} onValueChange={setProgGenre}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GENRES.map((g) => (
                        <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Target Duration */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Целевая длительность (часы)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={progDuration}
                    onChange={(e) => setProgDuration(Number(e.target.value) || 40)}
                    className="h-9 text-sm"
                  />
                </div>

                {/* Target Levels */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Целевые уровни</Label>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    value={progLevels}
                    onChange={(e) => setProgLevels(Number(e.target.value) || 50)}
                    className="h-9 text-sm"
                  />
                </div>

                {/* Progression Type */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Тип прогрессии</Label>
                  <Select value={progType} onValueChange={setProgType}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROGRESSION_TYPES.map((pt) => (
                        <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Monetization */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Модель монетизации</Label>
                  <Select value={progMonetization} onValueChange={setProgMonetization}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONETIZATION_MODELS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Pacing */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Темп</Label>
                  <Select value={progPacing} onValueChange={setProgPacing}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PACING_OPTIONS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Run button */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleRunProgression}
                  disabled={isProgLoading}
                  className="gap-1.5"
                >
                  {isProgLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  Спроектировать прогрессию
                </Button>
                {progResult?.latency_ms != null && !isProgLoading && (
                  <span className="text-xs text-muted-foreground">
                    Последний запуск: {progResult.latency_ms} мс
                  </span>
                )}
              </div>

              {/* Error */}
              {progError && (
                <div className="flex items-start gap-2 text-xs rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-3">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <span className="text-red-700 dark:text-red-300">{progError}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results */}
          {progResult && (
            <Tabs value={progSubTab} onValueChange={setProgSubTab} className="animate-fade-in" aria-label="Результаты прогрессии">
              <TabsList>
                <TabsTrigger value="macro" className="text-xs sm:text-sm">Макро-параметры</TabsTrigger>
                <TabsTrigger value="tiers" className="text-xs sm:text-sm">Этапы</TabsTrigger>
                <TabsTrigger value="curves" className="text-xs sm:text-sm">Кривые</TabsTrigger>
                <TabsTrigger value="content" className="text-xs sm:text-sm">Контент-план</TabsTrigger>
                <TabsTrigger value="validation" className="text-xs sm:text-sm">Валидация</TabsTrigger>
              </TabsList>
              <TabsContent value="macro" className="mt-4">
                <MacroParamsTab result={progResult} />
              </TabsContent>
              <TabsContent value="tiers" className="mt-4">
                <TiersTab result={progResult} />
              </TabsContent>
              <TabsContent value="curves" className="mt-4">
                <CurvesTab result={progResult} />
              </TabsContent>
              <TabsContent value="content" className="mt-4">
                <ContentPlanTab result={progResult} />
              </TabsContent>
              <TabsContent value="validation" className="mt-4">
                <ValidationTab result={progResult} />
              </TabsContent>
            </Tabs>
          )}
        </TabsContent>

        {/* ====================== ECONOMY TAB ====================== */}
        <TabsContent value="economy" className="space-y-6 mt-4">
          {/* Input Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Coins className="h-5 w-5 text-primary" />
                Параметры экономики
              </CardTitle>
              <CardDescription>Настройте параметры для проектирования экономики</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Genre */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Жанр</Label>
                  <Select value={ecoGenre} onValueChange={setEcoGenre}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GENRES.map((g) => (
                        <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Monetization Type */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Тип монетизации</Label>
                  <Select value={ecoMonetization} onValueChange={setEcoMonetization}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONETIZATION_MODELS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Openness */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Открытость</Label>
                  <Select value={ecoOpenness} onValueChange={setEcoOpenness}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPENNESS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Run button */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleRunEconomy}
                  disabled={isEcoLoading}
                  className="gap-1.5"
                >
                  {isEcoLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  Спроектировать экономику
                </Button>
                {ecoResult?.latency_ms != null && !isEcoLoading && (
                  <span className="text-xs text-muted-foreground">
                    Последний запуск: {ecoResult.latency_ms} мс
                  </span>
                )}
              </div>

              {/* Error */}
              {ecoError && (
                <div className="flex items-start gap-2 text-xs rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-3">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <span className="text-red-700 dark:text-red-300">{ecoError}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results */}
          {ecoResult && (
            <Tabs value={ecoSubTab} onValueChange={setEcoSubTab} className="animate-fade-in" aria-label="Результаты экономики">
              <TabsList>
                <TabsTrigger value="resources" className="text-xs sm:text-sm">Ресурсы</TabsTrigger>
                <TabsTrigger value="classification" className="text-xs sm:text-sm">Классификация</TabsTrigger>
                <TabsTrigger value="machinations" className="text-xs sm:text-sm">Machinations</TabsTrigger>
                <TabsTrigger value="diagnostics" className="text-xs sm:text-sm">Диагностика</TabsTrigger>
                <TabsTrigger value="simulation" className="text-xs sm:text-sm">Симуляция</TabsTrigger>
              </TabsList>
              <TabsContent value="resources" className="mt-4">
                <ResourcesTab result={ecoResult} />
              </TabsContent>
              <TabsContent value="classification" className="mt-4">
                <ClassificationTab result={ecoResult} />
              </TabsContent>
              <TabsContent value="machinations" className="mt-4">
                <MachinationsEconomyTab result={ecoResult} />
              </TabsContent>
              <TabsContent value="diagnostics" className="mt-4">
                <DiagnosticsTab result={ecoResult} />
              </TabsContent>
              <TabsContent value="simulation" className="mt-4">
                <SimulationEconomyTab result={ecoResult} />
              </TabsContent>
            </Tabs>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
