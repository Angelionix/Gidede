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
import { Separator } from "@/components/ui/separator";
import { Shield, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { WarningsList } from "@/components/gidede/shared";

export const ValidationPanel = React.memo(function ValidationPanel({ validation }: { validation: Record<string, unknown> }) {
  const funCheck = validation.fun_check as Record<string, unknown> | undefined;
  const loopClosedness = validation.loop_closedness as Record<string, unknown> | undefined;
  const resourceSufficiency = validation.resource_sufficiency as Record<string, unknown> | undefined;
  const checklistPassed = (validation.checklist_passed as number) || 0;
  const checklistTotal = (validation.checklist_total as number) || 5;
  const overallPassed = validation.overall_passed as boolean;
  const score = (validation.score as number) || 0;
  const warnings = (validation.warnings as string[]) || [];

  const criteriaItems = [
    {
      label: "Тест «30 секунд веселья»",
      passed: funCheck?.passed as boolean,
      score: funCheck?.score as number,
      detail: funCheck?.reasoning as string,
    },
    {
      label: "Замкнутость петли",
      passed: loopClosedness?.is_closed as boolean,
      detail: loopClosedness?.connection_description as string,
    },
    {
      label: "Достаточность ресурсов",
      passed: !(resourceSufficiency?.has_dead_resources || resourceSufficiency?.has_unsourced_consumables),
      detail: resourceSufficiency
        ? [
            ...(resourceSufficiency.dead_resources as string[] || []).map(r => `Мёртвый ресурс: ${r}`),
            ...(resourceSufficiency.unsourced_consumables as string[] || []).map(r => `Без источника: ${r}`),
          ].join("; ")
        : undefined,
    },
    {
      label: "Отсутствие критических патологий",
      passed: checklistPassed >= 4,
    },
    {
      label: "Корректное число шагов (3-7)",
      passed: checklistPassed >= 3,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Валидация Core Loop (Этап 4)
        </CardTitle>
        <CardDescription>
          Алгоритм 3.2 Этап 4 — 5 критериев чек-листа
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Результат:</span>
          {overallPassed ? (
            <Badge className="text-xs bg-green-600 text-white">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Пройдено
            </Badge>
          ) : (
            <Badge variant="destructive" className="text-xs">
              <XCircle className="h-3 w-3 mr-1" />
              Не пройдено
            </Badge>
          )}
          <span className="text-sm text-muted-foreground">
            {checklistPassed}/{checklistTotal} критериев
          </span>
          {score > 0 && (
            <span className="text-sm font-semibold">
              {Math.round(score * 100)}%
            </span>
          )}
        </div>

        <Progress value={(checklistPassed / checklistTotal) * 100} className="h-2.5" />

        <Separator />

        {/* Criteria */}
        <div className="space-y-2.5">
          {criteriaItems.map((c, i) => (
            <div key={i} className="flex items-start gap-2.5">
              {c.passed ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className={`text-sm ${c.passed ? "" : "text-red-600 dark:text-red-400"}`}>
                  {c.label}
                </span>
                {c.detail && (
                  <p className="text-xs text-muted-foreground mt-0.5">{c.detail}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Warnings — using shared WarningsList */}
        <WarningsList warnings={warnings} />
      </CardContent>
    </Card>
  );
});
