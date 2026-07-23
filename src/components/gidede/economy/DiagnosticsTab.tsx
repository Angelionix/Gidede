"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Gauge, Stethoscope, Wrench } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EconomyDesignResponse } from "@/types/economy";
import { EmptyStateCard } from "@/components/gidede/shared";

interface DiagnosticsTabProps {
  result: EconomyDesignResponse | null;
}

export const DiagnosticsTab = React.memo(function DiagnosticsTab({ result }: DiagnosticsTabProps) {
  if (!result?.diagnostics) {
    return (
      <EmptyStateCard
        icon={Stethoscope}
        title="Спроектируйте экономику для просмотра диагностики"
        description="Патологии и соотношения кранов/стоков"
      />
    );
  }

  const diag = result.diagnostics;
  const pathologies = diag.pathologies || [];
  const ratios = diag.faucet_drain_ratios || {};
  const overallSeverity = diag.overall_severity || "unknown";

  return (
    <div className="space-y-4">
      {/* Overall Severity */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Общая серьёзность:</span>
            <Badge className={`text-xs ${
              overallSeverity === "critical" ? "bg-red-600 text-white" :
              overallSeverity === "warning" ? "bg-amber-600 text-white" :
              overallSeverity === "ok" ? "bg-green-600 text-white" :
              "bg-gray-600 text-white"
            }`}>
              {overallSeverity}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Pathologies */}
      {pathologies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Flame className="h-4 w-4 text-red-500" />
              Патологии ({pathologies.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-72 overflow-y-auto">
            {pathologies.map((p, i) => (
              <div key={i} className="rounded-md border p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Badge className={`text-[10px] ${
                    p.severity === "critical" ? "bg-red-600 text-white" :
                    p.severity === "warning" ? "bg-amber-600 text-white" :
                    "bg-blue-600 text-white"
                  }`}>
                    {p.severity}
                  </Badge>
                  <span className="text-xs font-medium">{p.name}</span>
                </div>
                <p className="text-xs text-muted-foreground">{p.description}</p>
                {p.affected_resources && p.affected_resources.length > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">Затронуты:</span>
                    {p.affected_resources.map((r, ri) => (
                      <Badge key={ri} variant="outline" className="text-[10px]">{r}</Badge>
                    ))}
                  </div>
                )}
                {p.correction && (
                  <div className="flex items-start gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                    <Wrench className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{p.correction}</span>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Faucet/Drain Ratios */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            Соотношения Кран/Сток
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ресурс</TableHead>
                  <TableHead className="text-right">Кран</TableHead>
                  <TableHead className="text-right">Сток</TableHead>
                  <TableHead className="text-right">Отношение</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(ratios).map(([name, data]) => (
                  <TableRow key={name}>
                    <TableCell className="font-medium text-sm">{name}</TableCell>
                    <TableCell className="text-right text-sm">{data.faucet?.toFixed(2) ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm">{data.drain?.toFixed(2) ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          data.ratio > 1.5 ? "border-green-300 text-green-700 dark:text-green-400" :
                          data.ratio < 0.7 ? "border-red-300 text-red-700 dark:text-red-400" :
                          "border-amber-300 text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {data.ratio?.toFixed(3) ?? "—"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
