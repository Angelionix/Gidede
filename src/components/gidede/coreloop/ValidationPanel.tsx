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
import { AlertTriangle, CheckCircle2, Shield, XCircle } from "lucide-react";
import { WarningsList } from "@/components/gidede/shared";

export const ValidationPanel = React.memo(function ValidationPanel({ validation }: { validation: Record<string, unknown> }) {
  const funHypothesis = validation.fun_hypothesis as Record<string, unknown> | undefined;
  const protocol = funHypothesis?.test_protocol as Record<string, unknown> | undefined;
  const metrics = Array.isArray(protocol?.metrics) ? protocol.metrics as Array<Record<string, unknown>> : [];
  const loopClosedness = validation.loop_closedness as Record<string, unknown> | undefined;
  const resourceSufficiency = validation.resource_sufficiency as Record<string, unknown> | undefined;
  const structuralChecks = validation.structural_checks as Record<string, unknown> | undefined;
  const checklistPassed = (validation.checklist_passed as number) ?? 0;
  const checklistTotal = (validation.checklist_total as number) ?? 4;
  const overallPassed = validation.overall_passed as boolean;
  const score = (validation.score as number) ?? 0;
  const warnings = (validation.warnings as string[]) || [];

  const criteriaItems = [
    {
      label: "Замкнутость петли",
      passed: structuralChecks?.loop_closed as boolean,
      detail: loopClosedness?.connection_description as string,
    },
    {
      label: "Баланс источников и потребителей ресурсов",
      passed: structuralChecks?.resources_balanced as boolean,
      detail: resourceSufficiency
        ? [
            ...((resourceSufficiency.dead_resources as string[]) || []).map((resource) => `Мёртвый ресурс: ${resource}`),
            ...((resourceSufficiency.unsourced_consumables as string[]) || []).map((resource) => `Без источника: ${resource}`),
          ].join("; ")
        : undefined,
    },
    {
      label: "Отсутствие критических патологий",
      passed: structuralChecks?.no_critical_pathologies as boolean,
    },
    {
      label: "Корректное число шагов (3–7)",
      passed: structuralChecks?.step_count_in_range as boolean,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Структурная валидация Core Loop
        </CardTitle>
        <CardDescription>
          Четыре проверяемых критерия структуры. Удовольствие от игры проверяется отдельно на плейтесте.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
          <span className="text-sm font-semibold">{Math.round(score * 100)}%</span>
        </div>

        <Progress value={checklistTotal > 0 ? (checklistPassed / checklistTotal) * 100 : 0} className="h-2.5" />

        <Separator />

        <div className="space-y-2.5">
          {criteriaItems.map((criterion) => (
            <div key={criterion.label} className="flex items-start gap-2.5">
              {criterion.passed ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className={`text-sm ${criterion.passed ? "" : "text-red-600 dark:text-red-400"}`}>
                  {criterion.label}
                </span>
                {criterion.detail && <p className="text-xs text-muted-foreground mt-0.5">{criterion.detail}</p>}
              </div>
            </div>
          ))}
        </div>

        <Separator />

        <div className="rounded-lg border border-amber-300/60 bg-amber-50/50 p-3 dark:bg-amber-950/10">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium">Гипотеза удовольствия</span>
            <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300">
              Не проверено
            </Badge>
          </div>
          <p className="mt-2 text-sm">{(funHypothesis?.statement as string) || "Гипотеза ещё не сформирована."}</p>
          {protocol && (
            <div className="mt-3 space-y-2 text-xs text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Протокол:</span>{" "}
                {(protocol.duration_seconds as number) || 30} секунд, минимум {(protocol.minimum_participants as number) || 5} участников.
              </p>
              <p>{protocol.task as string}</p>
              <ul className="list-disc space-y-1 pl-5">
                {metrics.map((metric) => (
                  <li key={metric.id as string}>
                    {metric.description as string} Цель: {metric.comparator as string}{" "}
                    {Math.round(((metric.target as number) || 0) * 100)}%.
                  </li>
                ))}
              </ul>
              <p>{protocol.decision_rule as string}</p>
            </div>
          )}
        </div>

        <WarningsList warnings={warnings} />
      </CardContent>
    </Card>
  );
});
