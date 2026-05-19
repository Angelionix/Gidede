"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Shield,
} from "lucide-react";
import type { ProgressionDesignResponse } from "@/types/progression";
import { SEVERITY_COLORS } from "@/constants/economy";
import { EmptyStateCard, SuggestionsList } from "@/components/gidede/shared";

interface ValidationTabProps {
  result: ProgressionDesignResponse | null;
}

export function ValidationTab({ result }: ValidationTabProps) {
  if (!result?.validation) {
    return (
      <EmptyStateCard
        icon={Shield}
        title="Спроектируйте прогрессию для просмотра валидации"
        description="Проверки качества и рекомендации"
      />
    );
  }

  const v = result.validation;
  const checks = v.checks || {};
  const checkLabels: Record<string, string> = {
    no_grind: "Нет гринда",
    no_walls: "Нет стен",
    no_empty_levels: "Нет пустых уровней",
    no_runaway: "Нет убегающей сложности",
    no_build_gaps: "Нет разрывов в развитии",
    aesthetic_alignment: "Эстетическое соответствие",
  };

  const issues = v.issues || [];
  const suggestions = v.suggestions || [];

  return (
    <div className="space-y-4">
      {/* Overall Score */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="text-center flex-1">
              <p className="text-xs text-muted-foreground mb-1">Общая оценка</p>
              <p className="text-3xl font-bold">{typeof v.overall_score === "number" ? (v.overall_score * 100).toFixed(0) + "%" : "—"}</p>
              <Progress value={typeof v.overall_score === "number" ? v.overall_score * 100 : 0} className="h-2 mt-2" />
            </div>
            <Separator orientation="vertical" className="h-16" />
            <div className="flex gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Critical</p>
                <p className="text-lg font-bold text-red-600 dark:text-red-400">{v.critical_count || 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Warning</p>
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{v.warning_count || 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Info</p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{v.info_count || 0}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Checks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Проверки
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(checks).map(([key, passed]) => (
            <div key={key} className="flex items-center gap-2 text-xs">
              {passed ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
              )}
              <span className={passed ? "" : "text-red-600 dark:text-red-400"}>
                {checkLabels[key] || key}
              </span>
            </div>
          ))}
          {Object.keys(checks).length === 0 && (
            <p className="text-xs text-muted-foreground">Нет данных о проверках</p>
          )}
        </CardContent>
      </Card>

      {/* Issues */}
      {issues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Проблемы ({issues.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 max-h-48 overflow-y-auto">
            {issues.map((issue, i) => (
              <div key={i} className={`flex items-start gap-2 text-xs rounded-md border p-2 ${SEVERITY_COLORS[issue.severity] || SEVERITY_COLORS.info}`}>
                {issue.severity === "critical" ? (
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                ) : issue.severity === "warning" ? (
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                ) : (
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                )}
                <span>{issue.description}</span>
                <Badge variant="outline" className="text-[10px] ml-auto shrink-0">{issue.severity}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Suggestions — use shared component with inline variant */}
      {suggestions.length > 0 && (
        <SuggestionsList suggestions={suggestions} variant="card" />
      )}
    </div>
  );
}
