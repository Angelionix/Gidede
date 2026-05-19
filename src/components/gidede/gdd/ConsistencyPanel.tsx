"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, AlertTriangle, Info, CheckCircle2, ShieldAlert } from "lucide-react";
import type { ConsistencyReport, ConsistencyIssue } from "@/types/gdd";

interface ConsistencyPanelProps {
  report?: ConsistencyReport;
}

function severityIcon(severity: ConsistencyIssue["severity"]) {
  switch (severity) {
    case "error":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case "info":
      return <Info className="h-4 w-4 text-blue-500" />;
  }
}

function severityBadge(severity: ConsistencyIssue["severity"]) {
  const map = {
    error: { label: "Ошибка", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
    warning: { label: "Предупр.", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
    info: { label: "Инфо", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  };
  const info = map[severity];
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border-0 ${info.className}`}>
      {info.label}
    </Badge>
  );
}

export function ConsistencyPanel({ report }: ConsistencyPanelProps) {
  if (!report) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <ShieldAlert className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Сгенерируйте GDD для проверки согласованности</p>
        </CardContent>
      </Card>
    );
  }

  const { issues, error_count, warning_count, info_count, is_valid } = report;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            Отчёт о согласованности
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            {is_valid ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Документ согласован
              </Badge>
            ) : (
              <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-0">
                <AlertCircle className="h-3.5 w-3.5 mr-1" />
                Есть несоответствия
              </Badge>
            )}
            <div className="flex gap-2 text-xs">
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <AlertCircle className="h-3 w-3" /> {error_count} ошибок
              </span>
              <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                <AlertTriangle className="h-3 w-3" /> {warning_count} предупреждений
              </span>
              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                <Info className="h-3 w-3" /> {info_count} замечаний
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Issues list */}
      {issues.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Найденные проблемы</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-96 overflow-y-auto">
            {issues.map((issue, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 rounded-md border bg-card"
              >
                <div className="mt-0.5 shrink-0">{severityIcon(issue.severity)}</div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {severityBadge(issue.severity)}
                    <span className="text-xs font-medium text-muted-foreground">
                      {issue.issue_type}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{issue.section_a}</span>
                    {" ↔ "}
                    <span className="font-medium">{issue.section_b}</span>
                  </p>
                  <p className="text-sm">{issue.description}</p>
                  {issue.suggestion && (
                    <p className="text-xs text-muted-foreground italic">
                      💡 {issue.suggestion}
                    </p>
                  )}
                </div>
                <Button size="sm" variant="ghost" className="shrink-0 text-xs h-7" title="Исправить">
                  Исправить
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {issues.length === 0 && is_valid && (
        <Card>
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500" />
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              Все секции согласованы между собой
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
