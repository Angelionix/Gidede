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
import { AlertTriangle, CheckCircle2, Wrench } from "lucide-react";
import { SEVERITY_STYLES } from "@/constants/coreloop";

export function PathologyPanel({ pathologies }: { pathologies: Record<string, unknown> }) {
  const pathologyList = (pathologies.pathologies as Record<string, unknown>[]) || [];
  const totalCount = (pathologies.total_count as number) || pathologyList.length;
  const criticalCount = (pathologies.critical_count as number) || pathologyList.filter(p => p.severity === "critical").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-primary" />
          Диагностика патологий (Этап 3)
        </CardTitle>
        <CardDescription>
          Алгоритм 3.2 Этап 3 — проверка 7 патологий: runaway, deadlock, stall, brittleness, oscillation, stagnation, triviality
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary */}
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs">Всего: {totalCount}</Badge>
          {criticalCount > 0 ? (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Критических: {criticalCount}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs border-green-400 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Нет критических
            </Badge>
          )}
        </div>

        {/* Pathologies list */}
        {pathologyList.length > 0 ? (
          <div className="space-y-2">
            {pathologyList.map((pathology, i) => {
              const name = (pathology.name as string) || `Патология ${i + 1}`;
              const type = (pathology.type as string) || "";
              const severity = (pathology.severity as string) || "info";
              const description = (pathology.description as string) || "";
              const correction = (pathology.correction as string) || "";
              const affectedResources = (pathology.affected_resources as string[]) || [];

              const severityStyle = SEVERITY_STYLES[severity] || SEVERITY_STYLES.info;
              const SeverityIcon = severityStyle.icon;

              return (
                <div key={i} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SeverityIcon className={`h-4 w-4 ${severity === "critical" ? "text-red-500" : severity === "warning" ? "text-yellow-500" : "text-blue-500"}`} />
                      <span className="text-sm font-medium">{name}</span>
                      {type && <Badge variant="outline" className="text-[10px]">{type}</Badge>}
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${severityStyle.color}`}>
                      {severity}
                    </span>
                  </div>
                  {description && (
                    <p className="text-xs text-muted-foreground">{description}</p>
                  )}
                  {affectedResources.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {affectedResources.map((r, ri) => (
                        <Badge key={ri} variant="outline" className="text-[10px]">{r}</Badge>
                      ))}
                    </div>
                  )}
                  {correction && (
                    <div className="flex items-start gap-1.5 text-xs text-green-700 dark:text-green-400">
                      <Wrench className="h-3 w-3 mt-0.5 shrink-0" />
                      <span>{correction}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-md border border-green-200 dark:border-green-800 p-4 text-center">
            <CheckCircle2 className="h-6 w-6 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-green-700 dark:text-green-400">Патологии не обнаружены</p>
            <p className="text-xs text-muted-foreground mt-1">Core Loop не содержит критических патологий</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
