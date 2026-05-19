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
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  Eye,
  Activity,
  FlaskConical,
  Shield,
  Wrench,
} from "lucide-react";
import type { MDAAnalysisResult } from "@/types/mda";
import { SCORE_COLORS } from "@/constants/mda";
import { AESTHETICS } from "@/config/aesthetics";
import { EmptyStateCard } from "@/components/gidede/shared";

/**
 * Classic MDA: Этап 4 (Механики → Геймплей → Опыт).
 */
export function ClassicMDAPanel({
  result,
}: {
  result: MDAAnalysisResult | null;
}) {
  const classicMda = result?.classic_mda_result;

  if (!result || !classicMda) {
    return (
      <EmptyStateCard
        icon={Eye}
        title="Запустите полный анализ, чтобы увидеть результаты Classic MDA"
        description="Этап 4: Механики → Геймплей → Опыт"
      />
    );
  }

  const gameplaySequence = (classicMda.gameplay_sequence as Record<string, unknown>[]) || [];
  const feedbackLoops = (classicMda.feedback_loops as Record<string, unknown>[]) || [];
  const observedDynamics = (classicMda.observed_dynamics as string[]) || [];
  const predictedAesthetics = (classicMda.predicted_aesthetics as Record<string, number>) || {};
  const matchScores = (classicMda.match_scores as Record<string, number>) || {};
  const overallMatch = (classicMda.overall_match as number) || 0;
  const converged = (classicMda.converged as boolean) || false;
  const stability = classicMda.stability as Record<string, unknown> | null;
  const iterations = (classicMda.iterations as number) || 1;
  const gameplayScript = (classicMda.gameplay_script as string) || "";
  const mdaSuggestions = (classicMda.suggestions as string[]) || [];
  const mdaWarnings = (classicMda.warnings as string[]) || [];

  return (
    <div className="space-y-4">
      {/* Сходимость */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Сходимость эстетик
          </CardTitle>
          <CardDescription>
            Сравнение предсказанной и целевой эстетик (порог сходимости 0.8)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Результат:</span>
            {converged ? (
              <Badge className="text-xs bg-green-600 text-white">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Сходимость достигнута
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-xs">
                <XCircle className="h-3 w-3 mr-1" />
                Сходимость не достигнута
              </Badge>
            )}
            <span className="text-sm font-semibold">
              {Math.round(overallMatch * 100)}%
            </span>
            <span className="text-xs text-muted-foreground">({iterations} итер.)</span>
          </div>

          <Progress value={overallMatch * 100} className="h-3" />

          {/* Match scores per aesthetic */}
          {Object.keys(matchScores).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Совпадение по эстетикам</p>
              {Object.entries(matchScores).map(([aesthetic, score]) => {
                const s = score as number;
                const colorClass = s >= 0.8 ? SCORE_COLORS.high : s >= 0.5 ? SCORE_COLORS.medium : SCORE_COLORS.low;
                const aestheticInfo = AESTHETICS.find((a) => a.value === aesthetic);
                return (
                  <div key={aesthetic} className="flex items-center gap-2 text-xs">
                    <span className={`font-medium w-24 ${colorClass}`}>
                      {aestheticInfo?.label || aesthetic}
                    </span>
                    <Progress value={s * 100} className="flex-1 h-2" />
                    <span className={`font-semibold ${colorClass}`}>{Math.round(s * 100)}%</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Predicted aesthetics map */}
          {Object.keys(predictedAesthetics).length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Карта эстетических ценностей (предсказанная)</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(predictedAesthetics)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([aesthetic, confidence]) => {
                    const c = confidence as number;
                    const aestheticInfo = AESTHETICS.find((a) => a.value === aesthetic);
                    return (
                      <Badge key={aesthetic} variant="outline" className={`text-xs ${aestheticInfo?.color || ""}`}>
                        {aestheticInfo?.label || aesthetic}: {Math.round(c * 100)}%
                      </Badge>
                    );
                  })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Смоделированный геймплей */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            Смоделированный геймплей
          </CardTitle>
          <CardDescription>
            Последовательность действий игрока из Machinations-симуляции
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {gameplayScript && (
            <div className="rounded-md border p-3 text-xs text-muted-foreground">
              <p className="font-medium mb-1">Сценарий геймплея</p>
              <p>{gameplayScript}</p>
            </div>
          )}

          {/* Gameplay steps */}
          {gameplaySequence.length > 0 && (
            <div className="space-y-2">
              {gameplaySequence.map((step, i) => {
                const action = (step.action as string) || `Шаг ${i + 1}`;
                const mechanicsUsed = (step.mechanics_used as string[]) || [];
                const consumed = (step.resources_consumed as string[]) || [];
                const produced = (step.resources_produced as string[]) || [];
                return (
                  <div key={i} className="rounded-md border p-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium">{action}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-7">
                      {mechanicsUsed.map((m, mi) => (
                        <Badge key={mi} variant="outline" className="text-[10px]">{m}</Badge>
                      ))}
                      {consumed.map((r, ri) => (
                        <Badge key={`c${ri}`} variant="outline" className="text-[10px] border-red-300 text-red-700 dark:text-red-400">-{r}</Badge>
                      ))}
                      {produced.map((r, ri) => (
                        <Badge key={`p${ri}`} variant="outline" className="text-[10px] border-green-300 text-green-700 dark:text-green-400">+{r}</Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Observed dynamics */}
          {observedDynamics.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Наблюдаемые динамики</p>
              <div className="flex flex-wrap gap-1.5">
                {observedDynamics.map((d, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{d}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Feedback loops */}
          {feedbackLoops.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Петли обратной связи</p>
              <div className="space-y-1.5">
                {feedbackLoops.map((fl, i) => {
                  const loopType = (fl.loop_type as string) || "";
                  const desc = (fl.description as string) || "";
                  const stability_ = (fl.stability as string) || "stable";
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs rounded-md border p-2">
                      <Badge variant="outline" className={`text-[10px] ${loopType === "positive" ? "border-green-300 text-green-700 dark:text-green-400" : "border-blue-300 text-blue-700 dark:text-blue-400"}`}>
                        {loopType === "positive" ? "Усиливающая" : "Балансирующая"}
                      </Badge>
                      <span className="flex-1">{desc}</span>
                      <Badge variant="outline" className={`text-[10px] ${stability_ === "stable" ? "border-green-300 text-green-700 dark:text-green-400" : "border-yellow-300 text-yellow-700 dark:text-yellow-400"}`}>
                        {stability_}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stability check */}
          {stability && (
            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Устойчивость симуляции</span>
                {(stability.stable as boolean) ? (
                  <Badge variant="outline" className="text-xs border-green-400 text-green-700 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3 mr-1" />Стабильна
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {(stability.pathology as string) || "Нестабильна"}
                  </Badge>
                )}
              </div>
              {(stability.correction as string) && (
                <div className="flex items-start gap-1.5 text-xs text-green-700 dark:text-green-400">
                  <Wrench className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{stability.correction as string}</span>
                </div>
              )}
            </div>
          )}

          {/* Suggestions & warnings */}
          {mdaSuggestions.length > 0 && (
            <div className="space-y-1">
              {mdaSuggestions.map((s, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-blue-700 dark:text-blue-400">
                  <Info className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          )}
          {mdaWarnings.length > 0 && (
            <div className="space-y-1">
              {mdaWarnings.map((w, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-yellow-700 dark:text-yellow-400">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
