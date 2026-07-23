"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, FlaskConical, Loader2 } from "lucide-react";
import { GENRES } from "@/config/genres";
import { AESTHETICS } from "@/config/aesthetics";
import type { MDAFormState } from "@/types/mda";
import { AestheticIcon } from "@/components/gidede/mda";

/**
 * MDA input form card — genre, aesthetics, idea, mechanics, mode toggle.
 * Receives form state and updaters from the parent page.
 */
export function MDAInputForm({
  form,
  pipelineWarning,
  isAnalyzing,
  isFormValid,
  updateField,
  onAnalyze,
  result,
}: {
  form: MDAFormState;
  pipelineWarning: string | null;
  isAnalyzing: boolean;
  isFormValid: boolean;
  updateField: <K extends keyof MDAFormState>(field: K, value: MDAFormState[K]) => void;
  onAnalyze: () => void;
  result: { stages_completed: number[]; latency_ms: number; models_used: string[] } | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Параметры MDA-анализа</CardTitle>
        <CardDescription>
          Укажите целевые эстетики и параметры. Алгоритм 3.3: Эстетика → Динамики → Механики → Геймплей → Валидация → Матрица Бонда.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pipeline warning */}
        {pipelineWarning && (
          <div className="flex items-start gap-2 text-xs rounded-md bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 p-2">
            <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
            <span>{pipelineWarning}</span>
          </div>
        )}

        {/* Concept ID */}
        <div className="space-y-1.5">
          <Label htmlFor="conceptId" className="text-sm">ID концепции (из Блока 1)</Label>
          <Input
            id="conceptId"
            placeholder="Оставьте пустым для автономного анализа"
            value={form.conceptId}
            onChange={(e) => updateField("conceptId", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Если концепция создана в Блоке 1, укажите ID для привязки результатов.
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
        </div>

        {/* Target Aesthetics */}
        <div className="space-y-2">
          <Label className="text-sm">Целевые эстетики (8 типов ЛеБланка)</Label>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
            {AESTHETICS.map((aesthetic) => (
              <AestheticIcon
                key={aesthetic.value}
                value={aesthetic.value}
                selected={form.primaryAesthetic === aesthetic.value}
                onClick={() => updateField("primaryAesthetic", aesthetic.value)}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Нажмите на иконку, чтобы выбрать основную эстетику
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Вторичная эстетика</Label>
            <Select value={form.secondaryAesthetic} onValueChange={(v) => updateField("secondaryAesthetic", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AESTHETICS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Третичная эстетика</Label>
            <Select value={form.tertiaryAesthetic} onValueChange={(v) => updateField("tertiaryAesthetic", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AESTHETICS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Idea description */}
        <div className="space-y-1.5">
          <Label htmlFor="idea" className="text-sm">Описание идеи игры</Label>
          <Textarea
            id="idea"
            placeholder="Опишите идею игры в 1-5 предложений..."
            value={form.idea}
            onChange={(e) => updateField("idea", e.target.value)}
            rows={3}
          />
        </div>

        <Separator />

        {/* Advanced parameters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="existingMechanics" className="text-sm">Существующие механики (через запятую)</Label>
            <Input
              id="existingMechanics"
              placeholder="Враги, Очки опыта, Уровни..."
              value={form.existingMechanics}
              onChange={(e) => updateField("existingMechanics", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="requiredMechanics" className="text-sm">Обязательные механики</Label>
            <Input
              id="requiredMechanics"
              placeholder="Механики, которые нельзя удалить"
              value={form.requiredMechanics}
              onChange={(e) => updateField("requiredMechanics", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="forbiddenMechanics" className="text-sm">Запрещённые механики</Label>
            <Input
              id="forbiddenMechanics"
              placeholder="Механики, которые будут исключены"
              value={form.forbiddenMechanics}
              onChange={(e) => updateField("forbiddenMechanics", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="maxMechanics" className="text-sm">Максимум механик</Label>
            <Input
              id="maxMechanics"
              type="number"
              min={8}
              max={25}
              value={form.maxMechanics}
              onChange={(e) => updateField("maxMechanics", parseInt(e.target.value) || 18)}
            />
          </div>
        </div>

        <Separator />

        {/* Analysis mode toggle */}
        <div className="flex items-center gap-4">
          <Label className="text-sm font-medium">Режим анализа:</Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={form.fullAnalysis ? "default" : "outline"}
              size="sm"
              onClick={() => updateField("fullAnalysis", true)}
            >
              Полный (Этапы 1–6)
            </Button>
            <Button
              type="button"
              variant={!form.fullAnalysis ? "default" : "outline"}
              size="sm"
              onClick={() => updateField("fullAnalysis", false)}
            >
              Краткий (Этапы 1–3)
            </Button>
          </div>
        </div>

        {/* Submit button */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={onAnalyze}
            disabled={!isFormValid || isAnalyzing}
            className="min-w-[200px]"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Анализ...
              </>
            ) : (
              <>
                <FlaskConical className="h-4 w-4 mr-2" />
                Запустить MDA-анализ
              </>
            )}
          </Button>
          {result && (
            <span className="text-xs text-muted-foreground">
              Этапы {result.stages_completed.join(", ")} • {result.latency_ms} мс
              {result.models_used.length > 0 && ` • ${result.models_used.join(", ")}`}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
