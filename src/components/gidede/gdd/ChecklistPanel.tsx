"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  MinusCircle,
  Loader2,
  Zap,
  AlertCircle,
  AlertTriangle,
  Info,
  ClipboardCheck,
  Lightbulb,
  Shield,
} from "lucide-react";
import type { ChecklistValidationProfile } from "@/types/gdd";

interface ChecklistPanelProps {
  validation: ChecklistValidationProfile | null;
  onRunValidation: () => void;
  isLoading: boolean;
}

interface CheckBlockProps {
  title: string;
  icon: React.ReactNode;
  skipped: boolean;
  score?: number;
  issues: Array<{
    severity: string;
    issue_type: string;
    description: string;
    suggestion: string;
  }>;
}

function CheckBlock({ title, icon, skipped, score, issues }: CheckBlockProps) {
  if (skipped) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/30">
        <MinusCircle className="h-4 w-4 text-gray-400" />
        <span className="text-sm text-muted-foreground">{title} — пропущен</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{title}</span>
        </div>
        {score !== undefined && (
          <div className="flex items-center gap-2">
            <Progress value={score * 100} className="w-20 h-2" />
            <span className="text-xs font-medium">{Math.round(score * 100)}%</span>
          </div>
        )}
      </div>
      {issues.length > 0 && (
        <div className="space-y-1.5 pl-6">
          {issues.map((issue, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs">
              {issue.severity === "error" ? (
                <AlertCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
              ) : issue.severity === "warning" ? (
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
              ) : (
                <Info className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
              )}
              <div className="flex-1">
                <span className="font-medium">{issue.issue_type}:</span>{" "}
                {issue.description}
              </div>
            </div>
          ))}
        </div>
      )}
      {issues.length === 0 && score !== undefined && score >= 0.8 && (
        <div className="flex items-center gap-1.5 pl-6 text-xs text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Проверка пройдена
        </div>
      )}
    </div>
  );
}

function readinessBadge(readiness: string) {
  const map: Record<string, { label: string; className: string }> = {
    ready: { label: "Готов", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
    almost: { label: "Почти готов", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
    not_ready: { label: "Не готов", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  };
  const info = map[readiness] || { label: readiness, className: "" };
  return (
    <Badge variant="outline" className={`text-xs border-0 ${info.className}`}>
      {info.label}
    </Badge>
  );
}

export function ChecklistPanel({
  validation,
  onRunValidation,
  isLoading,
}: ChecklistPanelProps) {
  return (
    <div className="space-y-4">
      {/* Run button */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Валидация чек-листов
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Button onClick={onRunValidation} disabled={isLoading} className="gap-1.5">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              Запустить валидацию
            </Button>
            {validation?.latency_ms != null && !isLoading && (
              <span className="text-xs text-muted-foreground">
                Последний запуск: {validation.latency_ms} мс
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Validation results */}
      {validation && (
        <>
          {/* Summary */}
          {validation.summary && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Общая оценка
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Progress
                    value={validation.summary.overall_score * 100}
                    className="flex-1 h-3"
                  />
                  <span className="text-sm font-bold">
                    {Math.round(validation.summary.overall_score * 100)}%
                  </span>
                  {readinessBadge(validation.summary.readiness)}
                </div>

                {/* Top 5 issues */}
                {validation.summary.top_5_issues.length > 0 && (
                  <div className="space-y-1.5 mt-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      Топ-5 проблем:
                    </p>
                    {validation.summary.top_5_issues.map((issue, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 text-xs p-2 rounded border bg-card"
                      >
                        {issue.severity === "error" ? (
                          <AlertCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                        ) : issue.severity === "warning" ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
                        ) : (
                          <Info className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                        )}
                        <div>
                          <span className="font-medium">{issue.issue_type}:</span>{" "}
                          {issue.description}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick wins */}
                {validation.summary.quick_wins.length > 0 && (
                  <div className="space-y-1.5 mt-3">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Lightbulb className="h-3.5 w-3.5" />
                      Быстрые улучшения:
                    </p>
                    {validation.summary.quick_wins.map((win, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 text-xs p-2 rounded border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
                        <div>
                          <span>{win.description}</span>
                          <span className="text-muted-foreground ml-1">
                            ({win.effort})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Individual checks */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Результаты проверок</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CheckBlock
                title="MDA-анализ"
                icon={<Shield className="h-4 w-4 text-primary" />}
                skipped={validation.mda_check?.skipped ?? true}
                score={validation.mda_check?.overall_mda_score}
                issues={validation.mda_check?.issues || []}
              />
              <CheckBlock
                title="Баланс"
                icon={<Shield className="h-4 w-4 text-primary" />}
                skipped={validation.balance_check?.skipped ?? true}
                score={validation.balance_check?.overall_balance_score}
                issues={validation.balance_check?.issues || []}
              />
              <CheckBlock
                title="Нарратив"
                icon={<Shield className="h-4 w-4 text-primary" />}
                skipped={validation.narrative_check?.skipped ?? true}
                score={validation.narrative_check?.overall_narrative_score}
                issues={validation.narrative_check?.issues || []}
              />
              <CheckBlock
                title="Экономика"
                icon={<Shield className="h-4 w-4 text-primary" />}
                skipped={validation.economy_check?.skipped ?? true}
                issues={validation.economy_check?.issues || []}
              />
              <CheckBlock
                title="Линз-аудит"
                icon={<Shield className="h-4 w-4 text-primary" />}
                skipped={validation.lens_check?.skipped ?? true}
                issues={validation.lens_check?.issues || []}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
