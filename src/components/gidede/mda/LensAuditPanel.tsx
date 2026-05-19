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
import { Progress } from "@/components/ui/progress";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Wrench,
  XCircle,
} from "lucide-react";
import type { MDAAnalysisResult } from "@/types/mda";
import { PRIORITY_LENSES, SCORE_COLORS, CATEGORY_COLORS } from "@/constants/mda";
import { EmptyStateCard } from "@/components/gidede/shared";

/**
 * Shell's Lenses: Этап 5 (9 приоритетных линз валидации).
 */
export function LensAuditPanel({
  result,
}: {
  result: MDAAnalysisResult | null;
}) {
  const lensValidation = result?.lens_validation;

  if (!result || !lensValidation) {
    return (
      <EmptyStateCard
        icon={Eye}
        title="Запустите полный анализ, чтобы увидеть результаты Линз Шелла"
        description="Этап 5: 9 приоритетных линз валидации"
      />
    );
  }

  const lensResults = (lensValidation.results as Record<string, unknown>[]) || [];
  const criticalIssues = (lensValidation.critical_issues as Record<string, unknown>[]) || [];
  const lensWarnings = (lensValidation.warnings as Record<string, unknown>[]) || [];
  const passedCount = (lensValidation.passed_count as number) || 0;
  const totalCount = (lensValidation.total_count as number) || 9;
  const overallScore = (lensValidation.overall_score as number) || 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Валидация через Линзы Шелла (Этап 5)
          </CardTitle>
          <CardDescription>
            Алгоритм 3.3.7 — 9 приоритетных линз из книги «Арт Геймдизайна»
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Общий score:</span>
              <span className={`text-lg font-bold ${overallScore >= 0.7 ? SCORE_COLORS.high : overallScore >= 0.4 ? SCORE_COLORS.medium : SCORE_COLORS.low}`}>
                {Math.round(overallScore * 100)}%
              </span>
            </div>
            <Badge variant="outline" className="text-xs border-green-400 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-3 w-3 mr-1" />{passedCount}/{totalCount} пройдено
            </Badge>
            {criticalIssues.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />{criticalIssues.length} критических
              </Badge>
            )}
            {lensWarnings.length > 0 && (
              <Badge variant="outline" className="text-xs border-yellow-400 text-yellow-700 dark:text-yellow-400">
                <AlertCircle className="h-3 w-3 mr-1" />{lensWarnings.length} предупреждений
              </Badge>
            )}
          </div>
          <Progress value={overallScore * 100} className="h-3" />
        </CardContent>
      </Card>

      {/* Individual lens results */}
      <div className="space-y-3">
        {lensResults.map((lens, i) => {
          const lensName = (lens.lens_name as string) || `Линза ${(lens.lens_id as number) || i + 1}`;
          const score = (lens.score as number) || 0;
          const issues = (lens.issues_found as string[]) || [];
          const suggestions = (lens.suggestions as string[]) || [];
          const questions = (lens.questions_asked as string[]) || [];
          const answers = (lens.answers as string[]) || [];

          const lensMeta = PRIORITY_LENSES.find((l) => l.name === lensName);
          const category = lensMeta?.category || "";
          const categoryColor = CATEGORY_COLORS[category] || "";

          const scoreColorClass = score >= 0.7 ? SCORE_COLORS.high : score >= 0.4 ? SCORE_COLORS.medium : SCORE_COLORS.low;
          const scoreBgClass = score >= 0.7
            ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/10"
            : score >= 0.4
              ? "border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/10"
              : "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/10";

          return (
            <Card key={i} className={scoreBgClass}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium text-sm ${scoreColorClass}`}>
                      #{lens.lens_id as number} {lensName}
                    </span>
                    {category && (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${categoryColor}`}>
                        {category}
                      </span>
                    )}
                  </div>
                  <span className={`text-lg font-bold ${scoreColorClass}`}>
                    {Math.round(score * 100)}%
                  </span>
                </div>

                {/* Questions & answers */}
                {questions.length > 0 && (
                  <div className="space-y-1">
                    {questions.map((q, qi) => (
                      <div key={qi} className="text-xs">
                        <span className="text-muted-foreground">Q: {q}</span>
                        {answers[qi] && (
                          <span className="ml-1 font-medium">A: {answers[qi]}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Issues */}
                {issues.length > 0 && (
                  <div className="space-y-1">
                    {issues.map((issue, ii) => (
                      <div key={ii} className="flex items-start gap-1.5 text-xs text-red-700 dark:text-red-400">
                        <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>{issue}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Suggestions */}
                {suggestions.length > 0 && (
                  <div className="space-y-1">
                    {suggestions.map((s, si) => (
                      <div key={si} className="flex items-start gap-1.5 text-xs text-blue-700 dark:text-blue-400">
                        <Wrench className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
