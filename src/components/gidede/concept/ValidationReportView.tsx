"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
} from "lucide-react";
import type { ValidationReport } from "../../../../shared/types/typescript/interfaces";

// ============================================================
// ScoreIndicator — цветной индикатор процента
// ============================================================

export const ScoreIndicator = React.memo(function ScoreIndicator({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  let colorClass = "text-red-600 dark:text-red-400";
  let bgClass = "bg-red-100 dark:bg-red-950/40";
  if (score >= 0.8) {
    colorClass = "text-green-600 dark:text-green-400";
    bgClass = "bg-green-100 dark:bg-green-950/40";
  } else if (score >= 0.6) {
    colorClass = "text-yellow-600 dark:text-yellow-400";
    bgClass = "bg-yellow-100 dark:bg-yellow-950/40";
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold ${bgClass} ${colorClass}`}>
      {score >= 0.8 ? <CheckCircle2 className="h-3.5 w-3.5" /> : score >= 0.6 ? <AlertTriangle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {pct}%
    </span>
  );
});

// ============================================================
// ValidatorSection — один валидатор (score/passed или dict)
// ============================================================

function ValidatorSection({ title, description, data }: { title: string; description: string; data: unknown }) {
  const d = data as Record<string, unknown>;

  // If it's a ValidationResult-like object with score/passed
  if (typeof d.score === "number") {
    const details = d.details as string | undefined;
    const validatorWarnings = Array.isArray(d.warnings)
      ? d.warnings.map((w: unknown) => typeof w === "string" ? w : (w as Record<string, unknown>).message as string || JSON.stringify(w))
      : [];
    const validatorSuggestions = Array.isArray(d.suggestions)
      ? d.suggestions.map((s: unknown) => typeof s === "string" ? s : (s as Record<string, unknown>).suggestion as string || (s as Record<string, unknown>).message as string || JSON.stringify(s))
      : [];

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{title}</span>
          <ScoreIndicator score={d.score} />
          <Badge variant={d.passed ? "default" : "destructive"} className="text-xs">
            {d.passed ? "Пройдено" : "Не пройдено"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {details && <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">{details}</p>}
        {validatorWarnings.length > 0 && (
          <div className="space-y-1 pl-2">
            {validatorWarnings.map((w, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-yellow-600 dark:text-yellow-400">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                {w}
              </div>
            ))}
          </div>
        )}
        {validatorSuggestions.length > 0 && (
          <div className="space-y-1 pl-2">
            {validatorSuggestions.map((s, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                {s}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // If it's a dict of questions/filters (Record<string, boolean> or Record<string, FilterResult>)
  const entries = Object.entries(d);
  if (entries.length > 0) {
    return (
      <div className="space-y-2">
        <span className="text-sm font-medium">{title}</span>
        <p className="text-xs text-muted-foreground">{description}</p>
        <div className="space-y-1.5">
          {entries.map(([key, val]) => {
            // boolean pass/fail
            if (typeof val === "boolean") {
              return (
                <div key={key} className="flex items-center gap-2 text-xs">
                  {val ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  )}
                  <span className={val ? "" : "text-red-600 dark:text-red-400"}>{key}</span>
                </div>
              );
            }
            // FilterResult-like with score
            if (val && typeof val === "object" && "score" in (val as Record<string, unknown>)) {
              const fv = val as Record<string, unknown>;
              const score = fv.score as number;
              const reason = (fv.reason as string) || "";
              const improvement = (fv.improvement as string) || "";
              return (
                <div key={key} className="rounded-md border p-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{key}</span>
                    <ScoreIndicator score={score} />
                  </div>
                  {reason && <p className="text-xs text-muted-foreground">{reason}</p>}
                  {improvement && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 flex items-start gap-1">
                      <Info className="h-3 w-3 mt-0.5 shrink-0" />
                      {improvement}
                    </p>
                  )}
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    );
  }

  return null;
}

// ============================================================
// ValidationReportView — основной компонент отчёта валидации
// ============================================================

export const ValidationReportView = React.memo(function ValidationReportView({ report }: { report: ValidationReport }) {
  // Handle both shared/types structure and Python API structure
  const overallScore = report.overall_score ?? 0;
  const overallPassed = overallScore >= 0.6;

  // Warnings and suggestions can be strings[] or object[]
  const warnings = Array.isArray(report.warnings)
    ? report.warnings.map((w) => typeof w === "string" ? w : (w as Record<string, unknown>).message as string || JSON.stringify(w))
    : [];
  const suggestions = Array.isArray(report.suggestions)
    ? report.suggestions.map((s) => typeof s === "string" ? s : (s as Record<string, unknown>).suggestion as string || (s as Record<string, unknown>).message as string || JSON.stringify(s))
    : [];

  // Try to get the three validators from both possible structures
  const triangleCheck = (report as unknown as Record<string, unknown>).triangle_check ?? (report as unknown as Record<string, unknown>).triangle_of_weirdness;
  const coreQuestions = (report as unknown as Record<string, unknown>).core_questions ?? (report as unknown as Record<string, unknown>).five_questions;
  const ideaFilters = (report as unknown as Record<string, unknown>).idea_filters ?? (report as unknown as Record<string, unknown>).eight_filters;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Отчёт валидации</CardTitle>
        <CardDescription>
          Алгоритм 3.1 Этап 6 — проверка концепции (3 валидатора)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Overall score */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Общий результат:</span>
          <ScoreIndicator score={overallScore} />
          <Badge variant={overallPassed ? "default" : "destructive"} className="text-xs">
            {overallPassed ? "Пройдено" : "Не пройдено"}
          </Badge>
        </div>

        <Separator />

        {/* Validator 1: Triangle of Weirdness */}
        {Boolean(triangleCheck) && (
          <ValidatorSection
            title="Triangle of Weirdness"
            description="Кн. 8 — баланс странности, привлекательности и достоверности"
            data={triangleCheck}
          />
        )}

        {/* Validator 2: 5 Core Questions */}
        {Boolean(coreQuestions) && (
          <ValidatorSection
            title="5 вопросов кор-геймплея"
            description="Кн. 10 — проверка ядра геймплея"
            data={coreQuestions}
          />
        )}

        {/* Validator 3: 8 Idea Filters */}
        {Boolean(ideaFilters) && (
          <ValidatorSection
            title="8 фильтров идеи"
            description="Кн. 1 — фильтрация качества идеи"
            data={ideaFilters}
          />
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400">Предупреждения</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs rounded-md bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 p-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Предложения по улучшению</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {suggestions.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-xs rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-2">
                  <Info className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
