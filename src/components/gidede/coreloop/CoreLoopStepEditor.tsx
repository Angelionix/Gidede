"use client";

import React, { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Plus,
  Trash2,
  Save,
  Loader2,
  ChevronDown,
  Pencil,
  GripVertical,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

// ============================================================
// Types
// ============================================================

/**
 * Один шаг Core Loop. Поддерживаем оба варианта формы:
 *  - "canonical" из Блока 2: { action, mechanics, feedback_type, ... }
 *  - "упрощённый" из редактора: { name, action, feedback }
 *  Любое поле опционально — редактор работает с любым входом.
 */
export interface CoreLoopEditableStep {
  name?: string;
  action?: string;
  feedback?: string;
  // Сохраняем все остальные поля при редактировании
  [key: string]: unknown;
}

interface CoreLoopStepEditorProps {
  /** Существующие шаги из сгенерированного результата. */
  steps: CoreLoopEditableStep[];
  /** ID активного проекта (для записи в правильную строку ProjectCoreLoop). */
  projectId: string | null;
  /** Колбэк, вызывается после успешного сохранения с обновлённым массивом шагов. */
  onSaved?: (updatedSteps: CoreLoopEditableStep[]) => void;
}

// ============================================================
// Helpers
// ============================================================

function makeEmptyStep(): CoreLoopEditableStep {
  return { name: "", action: "", feedback: "" };
}

function deriveName(step: CoreLoopEditableStep): string {
  return (step.name || step.action || "").toString();
}

function deriveFeedback(step: CoreLoopEditableStep): string {
  const v = step.feedback ?? step.feedback_type;
  if (!v) return "";
  return v.toString();
}

function uid(): string {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================
// Component
// ============================================================

export function CoreLoopStepEditor({
  steps,
  projectId,
  onSaved,
}: CoreLoopStepEditorProps) {
  const { apiFetch } = useAuth();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<CoreLoopEditableStep[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Синхронизируем черновик с входящими шагами при первом открытии или
  // когда пришёл новый результат генерации.
  useEffect(() => {
    if (!steps || steps.length === 0) {
      setDraft([]);
      setDirty(false);
      return;
    }
    // Клонируем, добавляем уникальный id для стабильности key.
    setDraft(
      steps.map((s) => ({
        ...s,
        // Сохраняем оригинальные поля (action, mechanics, ...) и добавляем
        // каноничные упрощённые поля для UI.
        name: deriveName(s),
        feedback: deriveFeedback(s),
        _uid: uid(),
      }))
    );
    setDirty(false);
  }, [steps]);

  const updateField = (idx: number, field: "name" | "action" | "feedback", value: string) => {
    setDraft((prev) => {
      const next = [...prev];
      const step = { ...next[idx] };
      if (field === "name") {
        step.name = value;
        // Если action пустой — синхронизируем с name (для сохранения формы CoreStep).
        if (!step.action) step.action = value;
      } else if (field === "action") {
        step.action = value;
        // Если name пустой — синхронизируем.
        if (!step.name) step.name = value;
      } else if (field === "feedback") {
        step.feedback = value;
        step.feedback_type = value as unknown;
      }
      next[idx] = step;
      return next;
    });
    setDirty(true);
  };

  const handleAddStep = () => {
    setDraft((prev) => [...prev, { ...makeEmptyStep(), _uid: uid() }]);
    setDirty(true);
  };

  const handleDeleteStep = (idx: number) => {
    setDraft((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!projectId) {
      toast({
        title: "Нет активного проекта",
        description: "Выберите проект на странице «Мои проекты», чтобы сохранить изменения.",
        variant: "destructive",
      });
      return;
    }
    // Чистим шаги: убираем служебное поле _uid, дропаем пустые.
    const cleaned = draft
      .map(({ _uid: _ignored, ...rest }) => {
        void _ignored;
        return rest;
      })
      .filter((s) => (s.name || s.action || "").trim().length > 0);

    if (cleaned.length === 0) {
      toast({
        title: "Нечего сохранять",
        description: "Добавьте хотя бы один шаг с названием.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await apiFetch(`/api/v1/coreloop/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps: cleaned }),
      });
      setDirty(false);
      // Обновляем draft, чтобы _uid был стабильным при следующих правках.
      setDraft(
        cleaned.map((s) => ({
          ...s,
          name: deriveName(s),
          feedback: deriveFeedback(s),
          _uid: uid(),
        }))
      );
      onSaved?.(cleaned);
      toast({
        title: "Шаги сохранены",
        description: `Записано ${cleaned.length} шаг(ов) в ProjectCoreLoop.stepsData.`,
      });
    } catch (err) {
      toast({
        title: "Не удалось сохранить",
        description: err instanceof Error ? err.message : "Сервер вернул ошибку.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const hasSteps = draft.length > 0;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="border rounded-lg"
    >
      <Card className="border-0 shadow-none">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/40 transition-colors">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Pencil className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base">Редактор шагов</CardTitle>
                  <CardDescription className="text-xs">
                    Отредактируйте, добавьте или удалите шаги Core Loop. Изменения сохраняются в базу проекта.
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {dirty && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400">
                    несохранённые изменения
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{draft.length} шаг.</span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-2">
            {!hasSteps ? (
              <div className="rounded-md border border-dashed p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Шаги пока не сгенерированы. Нажмите «Добавить шаг», чтобы создать первый.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {draft.map((step, idx) => {
                  const stepId = (step._uid as string) || `step-${idx}`;
                  return (
                    <div
                      key={stepId}
                      className="rounded-md border p-3 space-y-3 bg-card"
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">
                          Шаг {idx + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="ml-auto h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteStep(idx)}
                          aria-label="Удалить шаг"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Удалить шаг {idx + 1}</span>
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-6">
                        <div className="space-y-1">
                          <Label htmlFor={`name-${stepId}`} className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Название
                          </Label>
                          <Input
                            id={`name-${stepId}`}
                            value={step.name || ""}
                            onChange={(e) => updateField(idx, "name", e.target.value)}
                            placeholder="Напр. «Собрать ресурсы»"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`action-${stepId}`} className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Действие
                          </Label>
                          <Input
                            id={`action-${stepId}`}
                            value={step.action || ""}
                            onChange={(e) => updateField(idx, "action", e.target.value)}
                            placeholder="Что игрок делает"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`feedback-${stepId}`} className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Тип обратной связи
                          </Label>
                          <Input
                            id={`feedback-${stepId}`}
                            value={step.feedback || ""}
                            onChange={(e) => updateField(idx, "feedback", e.target.value)}
                            placeholder="positive / negative / neutral"
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddStep}
              >
                <Plus className="h-4 w-4 mr-1" />
                Добавить шаг
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={!dirty || saving || !projectId}
                className="ml-auto"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-1" />
                    Сохранить изменения
                  </>
                )}
              </Button>
              {!projectId && (
                <span className="text-[10px] text-destructive">
                  Нет активного проекта
                </span>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
