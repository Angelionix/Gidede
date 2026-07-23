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
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Zap,
  BookOpen,
  FileEdit,
  ShieldAlert,
  Download,
  ClipboardCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { usePipeline } from "@/hooks/use-pipeline";

// ============================================================
// Constants & types
// ============================================================

import { DETAIL_LEVELS, DOC_AUDIENCES, PROJECT_STAGES } from "@/constants/gdd";
import type {
  GDDProfile,
  GDDGenerationRequest,
  ChecklistValidationProfile,
} from "@/types/gdd";

// ============================================================
// Sub-components
// ============================================================

import {
  GDDFormatSelector,
  GDDPreview,
  GDDSectionEditor,
  ConsistencyPanel,
  ExportPanel,
  ChecklistPanel,
} from "@/components/gidede/gdd";

// ============================================================
// Main Component
// ============================================================

export default function Block6Page() {
  const { apiFetch } = useAuth();
  const { toast } = useToast();

  // --- Pipeline ---
  const projectId =
    typeof window !== "undefined"
      ? localStorage.getItem("gidede_active_project")
      : null;
  const pipeline = usePipeline(projectId);

  // --- Tab state ---
  const [mainTab, setMainTab] = useState("format");

  // --- Form state ---
  const [targetFormat, setTargetFormat] = useState("full_gdd");
  const [detailLevel, setDetailLevel] = useState("standard");
  const [docAudience, setDocAudience] = useState("team_sync");
  const [projectStage, setProjectStage] = useState("preproduction");
  const [language, setLanguage] = useState("ru");

  // --- Result state ---
  const [isGenerating, setIsGenerating] = useState(false);
  const [gddProfile, setGddProfile] = useState<GDDProfile | null>(null);
  const [gddError, setGddError] = useState<string | null>(null);

  // --- Checklist state ---
  const [checklistValidation, setChecklistValidation] =
    useState<ChecklistValidationProfile | null>(null);
  const [isChecklistLoading, setIsChecklistLoading] = useState(false);

  // --- Run GDD Generation ---
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setGddError(null);

    try {
      const payload: GDDGenerationRequest = {
        target_format: targetFormat,
        detail_level: detailLevel,
        target_audience_doc: docAudience,
        project_stage: projectStage,
        language,
      };

      const data = await apiFetch<GDDProfile>("/gdd/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setGddProfile(data);

      if (projectId) {
        pipeline.notifyUpdated(6, {
          gdd_format: targetFormat,
          coverage_score: data.coverage_score,
          stages_completed: data.stages_completed,
        });
      }

      toast({
        title: "GDD сгенерирован",
        description: `Покрытие: ${Math.round(data.coverage_score * 100)}% • ${data.latency_ms} мс`,
      });

      // Switch to preview tab after generation
      setMainTab("preview");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Неизвестная ошибка";
      setGddError(msg);
      toast({
        title: "Ошибка генерации GDD",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [
    targetFormat,
    detailLevel,
    docAudience,
    projectStage,
    language,
    projectId,
    apiFetch,
    pipeline,
    toast,
  ]);

  // --- Run Checklist Validation ---
  const handleRunChecklist = useCallback(async () => {
    setIsChecklistLoading(true);

    try {
      const data = await apiFetch<ChecklistValidationProfile>(
        "/checklist/validate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId || undefined,
          }),
        }
      );

      setChecklistValidation(data);

      toast({
        title: "Валидация завершена",
        description: `Оценка: ${data.summary ? Math.round(data.summary.overall_score * 100) + "%" : "N/A"} • ${data.latency_ms} мс`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Неизвестная ошибка";
      toast({
        title: "Ошибка валидации",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsChecklistLoading(false);
    }
  }, [projectId, apiFetch, toast]);

  // --- Section update handler ---
  const handleSectionUpdate = useCallback(
    async (sectionName: string, content: string) => {
      if (!gddProfile?.assembled_document) return;

      // Optimistic update — update local state immediately
      setGddProfile((prev) => {
        if (!prev?.assembled_document) return prev;
        const updated = { ...prev };
        updated.assembled_document = {
          ...updated.assembled_document,
          sections: {
            ...updated.assembled_document.sections,
            [sectionName]: {
              ...updated.assembled_document.sections[sectionName],
              content,
              source: "manual",
              requires_review: false,
            },
          },
        };
        return updated;
      });

      toast({
        title: "Секция обновлена",
        description: sectionName,
      });
    },
    [gddProfile, toast]
  );

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">GDD Generator</h1>
          <p className="text-sm text-muted-foreground">
            Блок 6 • Алгоритмы 3.7–3.8
          </p>
        </div>
        {gddProfile && (
          <Badge
            variant="outline"
            className="ml-auto text-xs border-green-300 text-green-700 dark:text-green-400"
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Сгенерирован
          </Badge>
        )}
      </div>

      {/* Main Tabs */}
      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
          <TabsTrigger value="format" className="flex items-center gap-1.5">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Формат</span>
          </TabsTrigger>
          <TabsTrigger
            value="preview"
            className="flex items-center gap-1.5"
            disabled={!gddProfile}
          >
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Предпросмотр</span>
          </TabsTrigger>
          <TabsTrigger
            value="editor"
            className="flex items-center gap-1.5"
            disabled={!gddProfile}
          >
            <FileEdit className="h-4 w-4" />
            <span className="hidden sm:inline">Редактор</span>
          </TabsTrigger>
          <TabsTrigger
            value="consistency"
            className="flex items-center gap-1.5"
            disabled={!gddProfile}
          >
            <ShieldAlert className="h-4 w-4" />
            <span className="hidden sm:inline">Согласованность</span>
          </TabsTrigger>
          <TabsTrigger
            value="export"
            className="flex items-center gap-1.5"
            disabled={!gddProfile}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Экспорт</span>
          </TabsTrigger>
          <TabsTrigger value="checklist" className="flex items-center gap-1.5">
            <ClipboardCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Чек-листы</span>
          </TabsTrigger>
        </TabsList>

        {/* ====================== FORMAT TAB ====================== */}
        <TabsContent value="format" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Параметры GDD
              </CardTitle>
              <CardDescription>
                Выберите формат и настройки для генерации документа
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Format selector */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Формат документа</Label>
                <GDDFormatSelector
                  selectedFormat={targetFormat}
                  onFormatChange={setTargetFormat}
                />
              </div>

              {/* Form fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Detail level */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Уровень детализации</Label>
                  <Select value={detailLevel} onValueChange={setDetailLevel}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DETAIL_LEVELS.map((dl) => (
                        <SelectItem key={dl.value} value={dl.value}>
                          {dl.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Audience */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Аудитория документа</Label>
                  <Select value={docAudience} onValueChange={setDocAudience}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOC_AUDIENCES.map((a) => (
                        <SelectItem key={a.value} value={a.value}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Project stage */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Стадия проекта</Label>
                  <Select value={projectStage} onValueChange={setProjectStage}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_STAGES.map((ps) => (
                        <SelectItem key={ps.value} value={ps.value}>
                          {ps.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Language */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Язык документа</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ru">Русский</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Generate button */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="gap-1.5"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  Сгенерировать GDD
                </Button>
                {gddProfile?.latency_ms != null && !isGenerating && (
                  <span className="text-xs text-muted-foreground">
                    Последняя генерация: {gddProfile.latency_ms} мс • Покрытие:{" "}
                    {Math.round(gddProfile.coverage_score * 100)}%
                  </span>
                )}
              </div>

              {/* Error */}
              {gddError && (
                <div className="flex items-start gap-2 text-xs rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-3">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <span className="text-red-700 dark:text-red-300">
                    {gddError}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Data mapping info (if available) */}
          {gddProfile?.data_mapping && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Маппинг данных проекта
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 rounded-md bg-muted/50">
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">
                      {gddProfile.data_mapping.auto_fillable_sections.length}
                    </p>
                    <p className="text-xs text-muted-foreground">Автозаполняемых</p>
                  </div>
                  <div className="p-3 rounded-md bg-muted/50">
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {gddProfile.data_mapping.ai_generatable_sections.length}
                    </p>
                    <p className="text-xs text-muted-foreground">AI-генерируемых</p>
                  </div>
                  <div className="p-3 rounded-md bg-muted/50">
                    <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                      {gddProfile.data_mapping.manual_sections.length}
                    </p>
                    <p className="text-xs text-muted-foreground">Ручных</p>
                  </div>
                  <div className="p-3 rounded-md bg-muted/50">
                    <p className="text-lg font-bold">
                      {Math.round(
                        gddProfile.data_mapping.coverage_score * 100
                      )}
                      %
                    </p>
                    <p className="text-xs text-muted-foreground">Покрытие</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ====================== PREVIEW TAB ====================== */}
        <TabsContent value="preview" className="mt-4 animate-fade-in">
          {gddProfile && <GDDPreview profile={gddProfile} />}
        </TabsContent>

        {/* ====================== EDITOR TAB ====================== */}
        <TabsContent value="editor" className="mt-4 animate-fade-in">
          {gddProfile && (
            <GDDSectionEditor
              profile={gddProfile}
              onSectionUpdate={handleSectionUpdate}
            />
          )}
        </TabsContent>

        {/* ====================== CONSISTENCY TAB ====================== */}
        <TabsContent value="consistency" className="mt-4 animate-fade-in">
          {gddProfile && (
            <ConsistencyPanel
              report={gddProfile.assembled_document?.consistency_report}
            />
          )}
        </TabsContent>

        {/* ====================== EXPORT TAB ====================== */}
        <TabsContent value="export" className="mt-4 animate-fade-in">
          {gddProfile && (
            <ExportPanel profile={gddProfile} projectId={projectId} />
          )}
        </TabsContent>

        {/* ====================== CHECKLIST TAB ====================== */}
        <TabsContent value="checklist" className="mt-4">
          <ChecklistPanel
            validation={checklistValidation}
            onRunValidation={handleRunChecklist}
            isLoading={isChecklistLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
