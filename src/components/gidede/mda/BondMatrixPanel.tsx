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
  ArrowRight,
  Layers,
  MessageSquare,
  Wrench,
} from "lucide-react";
import type { MDAAnalysisResult } from "@/types/mda";
import { BOND_ELEMENTS, BOND_LEVELS, SCORE_COLORS } from "@/constants/mda";
import { EmptyStateCard } from "@/components/gidede/shared";

/**
 * Bond Matrix: Этап 6 (Матрица 4x3 + лудонарративный анализ).
 */
export function BondMatrixPanel({
  result,
}: {
  result: MDAAnalysisResult | null;
}) {
  const bondValidation = result?.bond_validation;

  if (!result || !bondValidation) {
    return (
      <EmptyStateCard
        icon={Layers}
        title="Запустите полный анализ, чтобы увидеть матрицу Бонда"
        description="Этап 6: Матрица 4x3 + лудонарративный анализ"
      />
    );
  }

  const matrix = (bondValidation.matrix as Record<string, unknown>[]) || [];
  const rowConsistency = (bondValidation.row_consistency as Record<string, unknown>[]) || [];
  const colConsistency = (bondValidation.col_consistency as Record<string, unknown>[]) || [];
  const ludonarrative = bondValidation.ludonarrative as Record<string, unknown> | null;
  const overallConsistency = (bondValidation.overall_consistency as number) || 0;

  // Build matrix grid (4 elements x 3 levels)
  const matrixGrid: Record<string, Record<string, string>> = {};
  for (const cell of matrix) {
    const element = (cell.element as string) || "";
    const level = (cell.level as string) || "";
    const content = (cell.content as string) || "";
    if (!matrixGrid[element]) matrixGrid[element] = {};
    matrixGrid[element][level] = content;
  }

  const ludonarrativeResult = (ludonarrative?.result as string) || "Гармония";
  const ludonarrativeDescription = (ludonarrative?.description as string) || "";
  const ludonarrativePairs = (ludonarrative?.mechanic_narrative_pairs as Record<string, unknown>[]) || [];
  const ludonarrativeCorrection = (ludonarrative?.correction as string) || "";

  const ludonarrativeColorClass =
    ludonarrativeResult === "Гармония"
      ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-300"
      : ludonarrativeResult === "Ирония"
        ? "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-300"
        : "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300";

  return (
    <div className="space-y-4">
      {/* Overall consistency */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Матрица 4x3 Бонда (Этап 6)
          </CardTitle>
          <CardDescription>
            Алгоритм 3.3.8 — Механика/История/Эстетика/Технология × Фиксированный/Динамический/Культурный
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-muted-foreground">Общая согласованность:</span>
            <span className={`text-lg font-bold ${overallConsistency >= 0.7 ? SCORE_COLORS.high : overallConsistency >= 0.4 ? SCORE_COLORS.medium : SCORE_COLORS.low}`}>
              {Math.round(overallConsistency * 100)}%
            </span>
            <Progress value={overallConsistency * 100} className="flex-1 h-3 max-w-48" />
          </div>

          {/* Interactive 4×3 table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="border p-2 bg-muted/50 text-left font-medium min-w-[100px]">Элемент</th>
                  {BOND_LEVELS.map((level) => (
                    <th key={level} className="border p-2 bg-muted/50 text-left font-medium min-w-[180px]">{level}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BOND_ELEMENTS.map((element) => (
                  <tr key={element}>
                    <td className="border p-2 font-medium bg-muted/30">{element}</td>
                    {BOND_LEVELS.map((level) => (
                      <td key={level} className="border p-2 align-top">
                        <span className="text-muted-foreground">
                          {matrixGrid[element]?.[level] || "—"}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Row consistency (horizontal) */}
          {rowConsistency.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Горизонтальная согласованность (по строкам)</p>
              <div className="space-y-1.5">
                {rowConsistency.map((rc, i) => {
                  const level = (rc.level as string) || "";
                  const score = (rc.score as number) || 0;
                  const dissonances = (rc.dissonances as Record<string, unknown>[]) || [];
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="font-medium w-32">{level}</span>
                      <Progress value={score * 100} className="flex-1 h-2" />
                      <span className={`font-semibold ${score >= 0.7 ? SCORE_COLORS.high : score >= 0.4 ? SCORE_COLORS.medium : SCORE_COLORS.low}`}>
                        {Math.round(score * 100)}%
                      </span>
                      {dissonances.length > 0 && (
                        <Badge variant="outline" className="text-[10px] border-red-300 text-red-700 dark:text-red-400">
                          {dissonances.length} расст.
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Column consistency (vertical) */}
          {colConsistency.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Вертикальная согласованность (по столбцам)</p>
              <div className="space-y-1.5">
                {colConsistency.map((cc, i) => {
                  const element = (cc.element as string) || "";
                  const score = (cc.score as number) || 0;
                  const description = (cc.description as string) || "";
                  return (
                    <div key={i} className="space-y-0.5">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium w-32">{element}</span>
                        <Progress value={score * 100} className="flex-1 h-2" />
                        <span className={`font-semibold ${score >= 0.7 ? SCORE_COLORS.high : score >= 0.4 ? SCORE_COLORS.medium : SCORE_COLORS.low}`}>
                          {Math.round(score * 100)}%
                        </span>
                      </div>
                      {description && (
                        <p className="text-[10px] text-muted-foreground pl-32">{description}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ludonarrative check */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Лудонарративный анализ
          </CardTitle>
          <CardDescription>
            Проверка согласованности механики и нарратива (Механика ↔ История)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Результат:</span>
            <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-semibold ${ludonarrativeColorClass}`}>
              {ludonarrativeResult}
            </span>
          </div>

          {ludonarrativeDescription && (
            <p className="text-sm text-muted-foreground">{ludonarrativeDescription}</p>
          )}

          {/* Mechanic-narrative pairs */}
          {ludonarrativePairs.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Пары «механика ↔ нарратив»</p>
              {ludonarrativePairs.map((pair, i) => {
                const mechanic = (pair.mechanic as string) || "";
                const narrative = (pair.narrative as string) || "";
                const consistency = (pair.consistency as number) || 0;
                return (
                  <div key={i} className="flex items-center gap-2 text-xs rounded-md border p-2">
                    <Badge variant="outline" className="text-[10px]">{mechanic}</Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <Badge variant="outline" className="text-[10px]">{narrative}</Badge>
                    <span className={`ml-auto font-semibold ${consistency >= 0.7 ? SCORE_COLORS.high : consistency >= 0.4 ? SCORE_COLORS.medium : SCORE_COLORS.low}`}>
                      {Math.round(consistency * 100)}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {ludonarrativeCorrection && (
            <div className="flex items-start gap-1.5 text-xs text-green-700 dark:text-green-400 rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-2">
              <Wrench className="h-3 w-3 mt-0.5 shrink-0" />
              <span>{ludonarrativeCorrection}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
