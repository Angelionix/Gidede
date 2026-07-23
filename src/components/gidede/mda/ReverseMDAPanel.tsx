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
  Info,
  CheckCircle2,
  XCircle,
  Target,
  Search,
  Layers,
} from "lucide-react";
import type { MDAAnalysisResult } from "@/types/mda";
import { EMERGENCE_BADGES } from "@/constants/mda";
import { EmptyStateCard } from "@/components/gidede/shared";

/**
 * Reverse MDA: Этапы 1–3 (Эстетика → Динамики → Механики).
 */
export const ReverseMDAPanel = React.memo(function ReverseMDAPanel({
  result,
}: {
  result: MDAAnalysisResult | null;
}) {
  const dynamicsTarget = result?.dynamics_target;
  const mechanicSet = result?.mechanic_set;
  const mechanicCandidateSet = result?.mechanic_candidate_set;

  if (!result) {
    return (
      <EmptyStateCard
        icon={Target}
        title="Запустите анализ, чтобы увидеть результаты Reverse MDA"
        description="Этапы 1–3: Эстетика → Динамики → Механики"
      />
    );
  }

  const coreDynamics = (dynamicsTarget?.core_dynamics as string[]) || [];
  const supportingDynamics = (dynamicsTarget?.supporting_dynamics as string[]) || [];
  const contextDynamics = (dynamicsTarget?.context_dynamics as Record<string, unknown>[]) || [];
  const emergenceLevel = (dynamicsTarget?.emergence_level as string) || "nominal";
  const emergenceDescription = (dynamicsTarget?.emergence_description as string) || "";
  const rationale = (dynamicsTarget?.rationale as string) || "";
  const dynamicsWarnings = (dynamicsTarget?.warnings as string[]) || [];

  const emergenceBadge = EMERGENCE_BADGES[emergenceLevel] || EMERGENCE_BADGES.nominal;

  // Механики по группам
  const baseMechanics = (mechanicSet?.base as Record<string, unknown>[]) || [];
  const combatMechanics = (mechanicSet?.combat as Record<string, unknown>[]) || [];
  const progressionMechanics = (mechanicSet?.progression as Record<string, unknown>[]) || [];
  const spatialMechanics = (mechanicSet?.spatial as Record<string, unknown>[]) || [];
  const socialMechanics = (mechanicSet?.social as Record<string, unknown>[]) || [];
  const aestheticCoverage = (mechanicSet?.aesthetic_coverage as Record<string, unknown>[]) || [];
  const patternsDetected = (mechanicSet?.patterns_detected as Record<string, unknown>[]) || [];
  const compatibilityScore = (mechanicSet?.compatibility_score as number) || 0;
  const synergyScore = (mechanicSet?.synergy_score as number) || 0;
  const mechanicSuggestions = (mechanicSet?.suggestions as string[]) || [];
  const mechanicWarnings = (mechanicSet?.warnings as string[]) || [];

  const mechanicGroups = [
    { label: "Базовые", items: baseMechanics, color: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300" },
    { label: "Боевые", items: combatMechanics, color: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300" },
    { label: "Прогрессия", items: progressionMechanics, color: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300" },
    { label: "Пространственные", items: spatialMechanics, color: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" },
    { label: "Социальные", items: socialMechanics, color: "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300" },
  ];

  const uncoveredDynamics = (mechanicCandidateSet?.uncovered_dynamics as string[]) || [];
  const synergyPairs = (mechanicCandidateSet?.synergy_pairs as Record<string, unknown>[]) || [];
  const conflictPairs = (mechanicCandidateSet?.conflict_pairs as Record<string, unknown>[]) || [];

  return (
    <div className="space-y-4">
      {/* Этап 1: Целевые динамики */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Целевые динамики (Этап 1)
          </CardTitle>
          <CardDescription>
            Алгоритм 3.3.3 — Эстетика → Динамики через формализованный маппинг и AI-обогащение
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Emergence level */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">Эмерджентность:</span>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border ${emergenceBadge.color}`}>
              {emergenceBadge.label}
            </span>
            {emergenceDescription && (
              <span className="text-xs text-muted-foreground">{emergenceDescription}</span>
            )}
          </div>

          {/* Core dynamics */}
          {coreDynamics.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Основные динамики ({coreDynamics.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {coreDynamics.map((d, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{d}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Supporting dynamics */}
          {supportingDynamics.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Поддерживающие динамики ({supportingDynamics.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {supportingDynamics.map((d, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{d}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* AI-suggested context dynamics */}
          {contextDynamics.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">AI-предложенные динамики ({contextDynamics.length})</p>
              <div className="space-y-1.5">
                {contextDynamics.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs rounded-md bg-muted/30 p-2">
                    <Badge variant="outline" className="text-[10px]">AI</Badge>
                    <span className="font-medium">{d.name as string}</span>
                    {(d.reasoning as string) && (
                      <span className="text-muted-foreground">— {d.reasoning as string}</span>
                    )}
                    {(d.warning as string) && (
                      <span className="text-yellow-600 dark:text-yellow-400">⚠ {d.warning as string}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rationale */}
          {rationale && (
            <div className="rounded-md border p-3 text-xs text-muted-foreground">
              <p className="font-medium mb-1">Обоснование</p>
              <p>{rationale}</p>
            </div>
          )}

          {/* Warnings */}
          {dynamicsWarnings.length > 0 && (
            <div className="space-y-1.5">
              {dynamicsWarnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs rounded-md bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 p-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Этап 2: Кандидаты механик */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Маппинг «Динамика → Механики» (Этап 2)
          </CardTitle>
          <CardDescription>
            Алгоритм 3.3.4 — кандидаты из MechanicsDB, Adams/Dormans, AI-расширение
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {uncoveredDynamics.length > 0 && (
            <div className="flex items-start gap-2 text-xs rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-2">
              <AlertCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-red-700 dark:text-red-400">Непокрытые динамики:</p>
                <p>{uncoveredDynamics.join(", ")}</p>
              </div>
            </div>
          )}

          {synergyPairs.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Синергии ({synergyPairs.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {synergyPairs.slice(0, 6).map((s, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] border-green-300 text-green-700 dark:text-green-400">
                    {(s.mechanic_a as string) || "?"} + {(s.mechanic_b as string) || "?"}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {conflictPairs.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Конфликты ({conflictPairs.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {conflictPairs.slice(0, 6).map((c, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] border-red-300 text-red-700 dark:text-red-400">
                    {(c.mechanic_a as string) || "?"} vs {(c.mechanic_b as string) || "?"}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Этап 3: Структурированный набор механик */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Структурированный набор механик (Этап 3)
          </CardTitle>
          <CardDescription>
            Алгоритм 3.3.5 — сборка, оптимизация, группировка по ролям
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Scores */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Совместимость:</span>
              <div className="flex items-center gap-1.5">
                <Progress value={compatibilityScore} className="w-20 h-2" />
                <span className="text-xs font-semibold">{Math.round(compatibilityScore)}%</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Синергия:</span>
              <div className="flex items-center gap-1.5">
                <Progress value={synergyScore} className="w-20 h-2" />
                <span className="text-xs font-semibold">{Math.round(synergyScore)}%</span>
              </div>
            </div>
          </div>

          {/* Mechanic groups */}
          {mechanicGroups.map((group) => {
            if (group.items.length === 0) return null;
            return (
              <div key={group.label}>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                  {group.label} ({group.items.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.items.map((m, i) => {
                    const name = (m.mechanic_name as string) || (m.name as string) || `Механика ${i + 1}`;
                    return (
                      <Badge key={i} variant="outline" className={`text-xs ${group.color}`}>
                        {name}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Aesthetic coverage */}
          {aestheticCoverage.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Покрытие эстетик</p>
              <div className="space-y-1.5">
                {aestheticCoverage.map((ac, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="font-medium w-24">{ac.aesthetic as string}</span>
                    <Progress value={(ac.count as number) / 3 * 100} className="flex-1 h-2" />
                    <span className="text-muted-foreground">{ac.count as number} мех.</span>
                    {(ac.sufficient as boolean) ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-red-500" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Adams/Dormans patterns */}
          {patternsDetected.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Паттерны Adams/Dormans</p>
              <div className="space-y-1.5">
                {patternsDetected.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs rounded-md border p-2">
                    {(p.present as boolean) ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                    )}
                    <span className="font-medium">{p.name as string}</span>
                    <Badge variant="outline" className="text-[10px]">{p.pattern_type as string}</Badge>
                    {(p.suggestion as string) && !(p.present as boolean) && (
                      <span className="text-muted-foreground">— {p.suggestion as string}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions & warnings */}
          {mechanicSuggestions.length > 0 && (
            <div className="space-y-1">
              {mechanicSuggestions.map((s, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-blue-700 dark:text-blue-400">
                  <Info className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          )}
          {mechanicWarnings.length > 0 && (
            <div className="space-y-1">
              {mechanicWarnings.map((w, i) => (
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
});
