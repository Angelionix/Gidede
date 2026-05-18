"use client";

import React, { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  FlaskConical,
  Loader2,
  Check,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  Eye,
  ArrowRight,
  Target,
  Search,
  Activity,
  Sparkles,
  BrainCircuit,
  Zap,
  Shield,
  Wrench,
  Layers,
  RotateCcw,
  Lightbulb,
  MessageSquare,
  ArrowDownToLine,
  GitBranch,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { usePipeline } from "@/hooks/use-pipeline";
import { apiRoutes } from "@/config/api";

// ============================================================
// Константы
// ============================================================

const AESTHETICS = [
  { value: "sensation", label: "Чувственное", icon: Zap, color: "bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800" },
  { value: "fantasy", label: "Фантазия", icon: Sparkles, color: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800" },
  { value: "narrative", label: "Нарратив", icon: MessageSquare, color: "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800" },
  { value: "challenge", label: "Вызов", icon: Shield, color: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800" },
  { value: "fellowship", label: "Товарищество", icon: BrainCircuit, color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800" },
  { value: "discovery", label: "Открытие", icon: Search, color: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800" },
  { value: "expression", label: "Выражение", icon: Lightbulb, color: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800" },
  { value: "submission", label: "Подчинение", icon: RotateCcw, color: "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-950/40 dark:text-gray-300 dark:border-gray-800" },
];

const GENRES = [
  { value: "action", label: "Action" },
  { value: "platformer", label: "Платформер" },
  { value: "shooter", label: "Шутер" },
  { value: "fighting", label: "Fighting" },
  { value: "stealth", label: "Stealth" },
  { value: "survival_horror", label: "Survival Horror" },
  { value: "rhythm", label: "Rhythm" },
  { value: "adventure", label: "Adventure" },
  { value: "rpg", label: "RPG" },
  { value: "action_rpg", label: "Action RPG" },
  { value: "mmorpg", label: "MMORPG" },
  { value: "roguelike", label: "Roguelike" },
  { value: "simulation", label: "Симулятор" },
  { value: "strategy", label: "Стратегия" },
  { value: "rts", label: "RTS" },
  { value: "tbs", label: "TBS" },
  { value: "tower_defense", label: "Tower Defense" },
  { value: "puzzle", label: "Квест/Пазл" },
  { value: "sandbox", label: "Sandbox" },
  { value: "horror", label: "Хоррор" },
  { value: "metroidvania", label: "Metroidvania" },
];

const PRIORITY_LENSES = [
  { id: 9, name: "Тетрада", focus: "Согласованность Механика/История/Эстетика/Технология", category: "целостность" },
  { id: 11, name: "Единство", focus: "Работают ли все элементы на общий замысел?", category: "целостность" },
  { id: 12, name: "Резонанс", focus: "Усиливают ли элементы друг друга?", category: "целостность" },
  { id: 30, name: "Эмерджентность", focus: "Сколько глаголов? Сколько результирующих действий?", category: "эмерджентность" },
  { id: 31, name: "Пространство действий", focus: "Совпадает ли воспринимаемое с реальным?", category: "эмерджентность" },
  { id: 40, name: "Треугольность", focus: "Осмысленный выбор риска vs безопасности", category: "баланс" },
  { id: 41, name: "Доминантная стратегия", focus: "Есть ли один очевидно лучший путь?", category: "баланс" },
  { id: 69, name: "Кривая интереса", focus: "Пики и спады интереса на протяжении игры", category: "интерес" },
  { id: 74, name: "Свобода vs управляемость", focus: "Баланс агентивности и замысла", category: "интерес" },
];

const BOND_ELEMENTS = ["Механика", "История", "Эстетика", "Технология"];
const BOND_LEVELS = ["Фиксированный", "Динамический", "Культурный"];

const SCORE_COLORS = {
  high: "text-green-600 dark:text-green-400",
  medium: "text-yellow-600 dark:text-yellow-400",
  low: "text-red-600 dark:text-red-400",
};

const CATEGORY_COLORS: Record<string, string> = {
  целостность: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  эмерджентность: "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300",
  баланс: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  интерес: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300",
};

const EMERGENCE_BADGES: Record<string, { label: string; color: string }> = {
  nominal: { label: "Номинальная", color: "bg-gray-100 text-gray-800 dark:bg-gray-950/40 dark:text-gray-300" },
  weak: { label: "Слабая", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300" },
  multiple: { label: "Множественная", color: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300" },
  strong: { label: "Сильная", color: "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300" },
};

// ============================================================
// Типы
// ============================================================

interface MDAFormState {
  conceptId: string;
  genre: string;
  primaryAesthetic: string;
  secondaryAesthetic: string;
  tertiaryAesthetic: string;
  idea: string;
  existingMechanics: string;
  requiredMechanics: string;
  forbiddenMechanics: string;
  maxMechanics: number;
  convergenceThreshold: number;
  fullAnalysis: boolean;
}

interface MDAAnalysisResult {
  aesthetic_profile: Record<string, unknown> | null;
  dynamics_target: Record<string, unknown> | null;
  mechanic_candidate_set: Record<string, unknown> | null;
  mechanic_set: Record<string, unknown> | null;
  classic_mda_result: Record<string, unknown> | null;
  lens_validation: Record<string, unknown> | null;
  bond_validation: Record<string, unknown> | null;
  genre: string;
  concept_id: string;
  iterations_done: number;
  stages_completed: number[];
  latency_ms: number;
  models_used: string[];
}

// ============================================================
// Sub-components
// ============================================================

// --- AestheticIcon — иконка эстетики с цветокодированием ---
function AestheticIcon({ value, selected, onClick }: { value: string; selected: boolean; onClick: () => void }) {
  const aesthetic = AESTHETICS.find((a) => a.value === value);
  if (!aesthetic) return null;
  const Icon = aesthetic.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${
        selected
          ? `${aesthetic.color} border-current shadow-sm`
          : "border-transparent bg-muted/30 hover:bg-muted/60"
      }`}
    >
      <Icon className="h-6 w-6" />
      <span className="text-[11px] font-medium">{aesthetic.label}</span>
    </button>
  );
}

// --- ReverseMDAPanel ---
function ReverseMDAPanel({
  result,
}: {
  result: MDAAnalysisResult | null;
}) {
  const dynamicsTarget = result?.dynamics_target;
  const mechanicSet = result?.mechanic_set;
  const mechanicCandidateSet = result?.mechanic_candidate_set;

  if (!result) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Target className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Запустите анализ, чтобы увидеть результаты Reverse MDA</p>
          <p className="text-xs mt-1">Этапы 1–3: Эстетика → Динамики → Механики</p>
        </CardContent>
      </Card>
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
}

// --- ClassicMDAPanel ---
function ClassicMDAPanel({
  result,
}: {
  result: MDAAnalysisResult | null;
}) {
  const classicMda = result?.classic_mda_result;

  if (!result || !classicMda) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Eye className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Запустите полный анализ, чтобы увидеть результаты Classic MDA</p>
          <p className="text-xs mt-1">Этап 4: Механики → Геймплей → Опыт</p>
        </CardContent>
      </Card>
    );
  }

  const gameplaySequence = (classicMda.gameplay_sequence as Record<string, unknown>[]) || [];
  const resourceFlows = (classicMda.resource_flows as Record<string, unknown>[]) || [];
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

// --- LensAuditPanel ---
function LensAuditPanel({
  result,
}: {
  result: MDAAnalysisResult | null;
}) {
  const lensValidation = result?.lens_validation;

  if (!result || !lensValidation) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Eye className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Запустите полный анализ, чтобы увидеть результаты Линз Шелла</p>
          <p className="text-xs mt-1">Этап 5: 9 приоритетных линз валидации</p>
        </CardContent>
      </Card>
    );
  }

  const lensResults = (lensValidation.results as Record<string, unknown>[]) || [];
  const criticalIssues = (lensValidation.critical_issues as Record<string, unknown>[]) || [];
  const lensWarnings = (lensValidation.warnings as Record<string, unknown>[]) || [];
  const passedCount = (lensValidation.passed_count as number) || 0;
  const totalCount = (lensValidation.total_count as number) || 9;
  const overallScore = (lensValidation.overall_score as number) || 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Валидация через Линзы Шелла (Этап 5)
          </CardTitle>
          <CardDescription>
            Алгоритм 3.3.7 — 9 приоритетных линз из книги «Арт Геймдизайна»
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Общий score:</span>
              <span className={`text-lg font-bold ${overallScore >= 0.7 ? SCORE_COLORS.high : overallScore >= 0.4 ? SCORE_COLORS.medium : SCORE_COLORS.low}`}>
                {Math.round(overallScore * 100)}%
              </span>
            </div>
            <Badge variant="outline" className="text-xs border-green-400 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-3 w-3 mr-1" />{passedCount}/{totalCount} пройдено
            </Badge>
            {criticalIssues.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />{criticalIssues.length} критических
              </Badge>
            )}
            {lensWarnings.length > 0 && (
              <Badge variant="outline" className="text-xs border-yellow-400 text-yellow-700 dark:text-yellow-400">
                <AlertCircle className="h-3 w-3 mr-1" />{lensWarnings.length} предупреждений
              </Badge>
            )}
          </div>
          <Progress value={overallScore * 100} className="h-3" />
        </CardContent>
      </Card>

      {/* Individual lens results */}
      <div className="space-y-3">
        {lensResults.map((lens, i) => {
          const lensName = (lens.lens_name as string) || `Линза ${(lens.lens_id as number) || i + 1}`;
          const score = (lens.score as number) || 0;
          const issues = (lens.issues_found as string[]) || [];
          const suggestions = (lens.suggestions as string[]) || [];
          const questions = (lens.questions_asked as string[]) || [];
          const answers = (lens.answers as string[]) || [];

          const lensMeta = PRIORITY_LENSES.find((l) => l.name === lensName);
          const category = lensMeta?.category || "";
          const categoryColor = CATEGORY_COLORS[category] || "";

          const scoreColorClass = score >= 0.7 ? SCORE_COLORS.high : score >= 0.4 ? SCORE_COLORS.medium : SCORE_COLORS.low;
          const scoreBgClass = score >= 0.7
            ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/10"
            : score >= 0.4
              ? "border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/10"
              : "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/10";

          return (
            <Card key={i} className={scoreBgClass}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium text-sm ${scoreColorClass}`}>
                      #{lens.lens_id as number} {lensName}
                    </span>
                    {category && (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${categoryColor}`}>
                        {category}
                      </span>
                    )}
                  </div>
                  <span className={`text-lg font-bold ${scoreColorClass}`}>
                    {Math.round(score * 100)}%
                  </span>
                </div>

                {/* Questions & answers */}
                {questions.length > 0 && (
                  <div className="space-y-1">
                    {questions.map((q, qi) => (
                      <div key={qi} className="text-xs">
                        <span className="text-muted-foreground">Q: {q}</span>
                        {answers[qi] && (
                          <span className="ml-1 font-medium">A: {answers[qi]}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Issues */}
                {issues.length > 0 && (
                  <div className="space-y-1">
                    {issues.map((issue, ii) => (
                      <div key={ii} className="flex items-start gap-1.5 text-xs text-red-700 dark:text-red-400">
                        <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>{issue}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Suggestions */}
                {suggestions.length > 0 && (
                  <div className="space-y-1">
                    {suggestions.map((s, si) => (
                      <div key={si} className="flex items-start gap-1.5 text-xs text-blue-700 dark:text-blue-400">
                        <Wrench className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// --- BondMatrixPanel ---
function BondMatrixPanel({
  result,
}: {
  result: MDAAnalysisResult | null;
}) {
  const bondValidation = result?.bond_validation;

  if (!result || !bondValidation) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Layers className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Запустите полный анализ, чтобы увидеть матрицу Бонда</p>
          <p className="text-xs mt-1">Этап 6: Матрица 4x3 + лудонарративный анализ</p>
        </CardContent>
      </Card>
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

// ============================================================
// Main Page Component
// ============================================================

export default function Block3Page() {
  const { apiFetch } = useAuth();
  const { toast } = useToast();

  // --- Pipeline ---
  const projectId = typeof window !== "undefined" ? localStorage.getItem("gidede_active_project") : null;
  const pipeline = usePipeline(projectId);
  const [pipelineLoaded, setPipelineLoaded] = useState(false);
  const [isLoadingPipeline, setIsLoadingPipeline] = useState(false);
  const [pipelineWarning, setPipelineWarning] = useState<string | null>(null);

  // --- Form state ---
  const [form, setForm] = useState<MDAFormState>({
    conceptId: "",
    genre: "rpg",
    primaryAesthetic: "challenge",
    secondaryAesthetic: "fantasy",
    tertiaryAesthetic: "discovery",
    idea: "",
    existingMechanics: "",
    requiredMechanics: "",
    forbiddenMechanics: "",
    maxMechanics: 18,
    convergenceThreshold: 0.8,
    fullAnalysis: true,
  });

  // --- Generation state ---
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<MDAAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("reverse");

  // --- Pipeline auto-fill handler ---
  const handleLoadFromPipeline = useCallback(async () => {
    if (!projectId) {
      toast({ title: "Нет активного проекта", description: "Выберите проект для загрузки данных из пайплайна", variant: "destructive" });
      return;
    }
    setIsLoadingPipeline(true);
    setPipelineWarning(null);
    try {
      const data = await pipeline.prepareInput(3);
      if (!data) {
        toast({ title: "Нет данных", description: "Не удалось загрузить данные из пайплайна. Убедитесь, что предыдущие блоки заполнены.", variant: "destructive" });
        return;
      }
      const updates: Partial<MDAFormState> = {};
      if (data.concept_id) updates.conceptId = data.concept_id;
      if (data.genre) updates.genre = data.genre;
      if (data.primary_aesthetic) updates.primaryAesthetic = data.primary_aesthetic;
      if (data.secondary_aesthetic) updates.secondaryAesthetic = data.secondary_aesthetic;
      if (data.tertiary_aesthetic) updates.tertiaryAesthetic = data.tertiary_aesthetic;
      if (data.idea) updates.idea = data.idea;
      if (Array.isArray(data.existing_mechanics) && data.existing_mechanics.length > 0) {
        updates.existingMechanics = data.existing_mechanics.join(", ");
      }
      if (data.warning) {
        setPipelineWarning(data.warning);
      }
      if (data.has_core_loop === false) {
        setPipelineWarning("Блок 2 (Core Loop) ещё не заполнен. Результаты могут быть неполными.");
      }
      if (Object.keys(updates).length > 0) {
        setForm((prev) => ({ ...prev, ...updates }));
        setPipelineLoaded(true);
        toast({
          title: "Данные загружены из пайплайна",
          description: `Загружено: ${Object.keys(updates).map((k) => {
            const labels: Record<string, string> = { conceptId: "ID концепции", genre: "Жанр", primaryAesthetic: "Основная эстетика", secondaryAesthetic: "Вторичная эстетика", tertiaryAesthetic: "Третичная эстетика", idea: "Идея", existingMechanics: "Механики" };
            return labels[k] || k;
          }).join(", ")}`,
        });
      } else {
        toast({ title: "Нет данных для загрузки", description: "Пайплайн не содержит данных для этого блока" });
      }
    } catch {
      toast({ title: "Ошибка загрузки", description: "Не удалось загрузить данные из пайплайна", variant: "destructive" });
    } finally {
      setIsLoadingPipeline(false);
    }
  }, [projectId, pipeline, toast]);

  // --- Validation ---
  const isFormValid = form.primaryAesthetic !== "" && form.genre !== "";

  // --- Handlers ---
  const updateField = useCallback(
    <K extends keyof MDAFormState>(field: K, value: MDAFormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleAnalyze = useCallback(async () => {
    if (!isFormValid) return;

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const mechanicsList = form.existingMechanics
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);

      const requiredList = form.requiredMechanics
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);

      const forbiddenList = form.forbiddenMechanics
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);

      const body: Record<string, unknown> = {
        concept_id: form.conceptId || "standalone",
        genre: form.genre,
        idea: form.idea,
        primary_aesthetic: form.primaryAesthetic,
        secondary_aesthetic: form.secondaryAesthetic,
        tertiary_aesthetic: form.tertiaryAesthetic,
        max_mechanics: form.maxMechanics,
        convergence_threshold: form.convergenceThreshold,
        full_analysis: form.fullAnalysis,
      };

      if (mechanicsList.length > 0) body.existing_mechanics = mechanicsList;
      if (requiredList.length > 0) body.required_mechanics = requiredList;
      if (forbiddenList.length > 0) body.forbidden_mechanics = forbiddenList;

      const response = await apiFetch("/api/v1/mda/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Ошибка сервера: ${response.status}`
        );
      }

      const data = await response.json();
      setResult(data as MDAAnalysisResult);

      // Уведомляем pipeline об обновлении Блока 3
      try {
        const projectId = typeof window !== "undefined" ? localStorage.getItem("gidede_active_project") : null;
        if (projectId) {
          await apiFetch(
            apiRoutes.pipeline.notify(),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ project_id: projectId, block_id: 3, metadata: {} }),
            }
          );
        }
      } catch {
        // Pipeline notification is non-critical
      }

      toast({
        title: "MDA-анализ завершён",
        description: `Этапы: ${data.stages_completed?.join(", ") || "1-3"}. ${data.latency_ms || 0} мс.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Неизвестная ошибка";
      setError(message);
      toast({
        title: "Ошибка MDA-анализа",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [form, isFormValid, apiFetch, toast]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <FlaskConical className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">MDA Lab</h1>
          <p className="text-sm text-muted-foreground">
            Блок 3 • Алгоритм 3.3 • 6 этапов
          </p>
        </div>
        <Badge variant="outline" className="text-green-600 ml-auto">
          <Check className="h-3 w-3 mr-1" />
          Активен
        </Badge>
      </div>

      {/* Pipeline Data Flow Indicator */}
      {projectId && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Пайплайн:</span>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-[10px]">Блок 1</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="text-[10px]">Блок 2</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="secondary" className="text-[10px] font-bold">Блок 3 ←</Badge>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {pipelineLoaded && (
              <Badge variant="outline" className="text-[10px] border-green-400 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Данные из пайплайна
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadFromPipeline}
              disabled={isLoadingPipeline}
              className="text-xs h-7"
            >
              {isLoadingPipeline ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <ArrowDownToLine className="h-3 w-3 mr-1" />
              )}
              Загрузить из пайплайна
            </Button>
          </div>
        </div>
      )}

      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Параметры MDA-анализа</CardTitle>
          <CardDescription>
            Укажите целевые эстетики и параметры. Алгоритм 3.3: Эстетика → Динамики → Механики → Геймплей → Валидация → Матрица Бонда.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Pipeline warning */}
          {pipelineWarning && (
            <div className="flex items-start gap-2 text-xs rounded-md bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 p-2">
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
              <span>{pipelineWarning}</span>
            </div>
          )}

          {/* Concept ID */}
          <div className="space-y-1.5">
            <Label htmlFor="conceptId" className="text-sm">ID концепции (из Блока 1)</Label>
            <Input
              id="conceptId"
              placeholder="Оставьте пустым для автономного анализа"
              value={form.conceptId}
              onChange={(e) => updateField("conceptId", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Если концепция создана в Блоке 1, укажите ID для привязки результатов.
            </p>
          </div>

          {/* Genre */}
          <div className="space-y-1.5">
            <Label className="text-sm">Жанр</Label>
            <Select value={form.genre} onValueChange={(v) => updateField("genre", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите жанр" />
              </SelectTrigger>
              <SelectContent>
                {GENRES.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Target Aesthetics */}
          <div className="space-y-2">
            <Label className="text-sm">Целевые эстетики (8 типов ЛеБланка)</Label>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
              {AESTHETICS.map((aesthetic) => (
                <AestheticIcon
                  key={aesthetic.value}
                  value={aesthetic.value}
                  selected={form.primaryAesthetic === aesthetic.value}
                  onClick={() => updateField("primaryAesthetic", aesthetic.value)}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Нажмите на иконку, чтобы выбрать основную эстетику
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Secondary aesthetic */}
            <div className="space-y-1.5">
              <Label className="text-sm">Вторичная эстетика</Label>
              <Select value={form.secondaryAesthetic} onValueChange={(v) => updateField("secondaryAesthetic", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AESTHETICS.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tertiary aesthetic */}
            <div className="space-y-1.5">
              <Label className="text-sm">Третичная эстетика</Label>
              <Select value={form.tertiaryAesthetic} onValueChange={(v) => updateField("tertiaryAesthetic", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AESTHETICS.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Idea description */}
          <div className="space-y-1.5">
            <Label htmlFor="idea" className="text-sm">Описание идеи игры</Label>
            <Textarea
              id="idea"
              placeholder="Опишите идею игры в 1-5 предложений..."
              value={form.idea}
              onChange={(e) => updateField("idea", e.target.value)}
              rows={3}
            />
          </div>

          <Separator />

          {/* Advanced parameters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="existingMechanics" className="text-sm">Существующие механики (через запятую)</Label>
              <Input
                id="existingMechanics"
                placeholder="Враги, Очки опыта, Уровни..."
                value={form.existingMechanics}
                onChange={(e) => updateField("existingMechanics", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="requiredMechanics" className="text-sm">Обязательные механики</Label>
              <Input
                id="requiredMechanics"
                placeholder="Механики, которые нельзя удалить"
                value={form.requiredMechanics}
                onChange={(e) => updateField("requiredMechanics", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="forbiddenMechanics" className="text-sm">Запрещённые механики</Label>
              <Input
                id="forbiddenMechanics"
                placeholder="Механики, которые будут исключены"
                value={form.forbiddenMechanics}
                onChange={(e) => updateField("forbiddenMechanics", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maxMechanics" className="text-sm">Максимум механик</Label>
              <Input
                id="maxMechanics"
                type="number"
                min={8}
                max={25}
                value={form.maxMechanics}
                onChange={(e) => updateField("maxMechanics", parseInt(e.target.value) || 18)}
              />
            </div>
          </div>

          <Separator />

          {/* Analysis mode toggle */}
          <div className="flex items-center gap-4">
            <Label className="text-sm font-medium">Режим анализа:</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={form.fullAnalysis ? "default" : "outline"}
                size="sm"
                onClick={() => updateField("fullAnalysis", true)}
              >
                Полный (Этапы 1–6)
              </Button>
              <Button
                type="button"
                variant={!form.fullAnalysis ? "default" : "outline"}
                size="sm"
                onClick={() => updateField("fullAnalysis", false)}
              >
                Краткий (Этапы 1–3)
              </Button>
            </div>
          </div>

          {/* Submit button */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleAnalyze}
              disabled={!isFormValid || isAnalyzing}
              className="min-w-[200px]"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Анализ...
                </>
              ) : (
                <>
                  <FlaskConical className="h-4 w-4 mr-2" />
                  Запустить MDA-анализ
                </>
              )}
            </Button>
            {result && (
              <span className="text-xs text-muted-foreground">
                Этапы {result.stages_completed.join(", ")} • {result.latency_ms} мс
                {result.models_used.length > 0 && ` • ${result.models_used.join(", ")}`}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4">
            <div className="flex items-start gap-2 text-destructive">
              <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Ошибка MDA-анализа</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results — Tabs */}
      {result && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="reverse" className="text-xs">
              <Target className="h-3.5 w-3.5 mr-1.5" />
              Reverse MDA
            </TabsTrigger>
            <TabsTrigger value="classic" className="text-xs">
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              Classic MDA
            </TabsTrigger>
            <TabsTrigger value="lenses" className="text-xs">
              <Activity className="h-3.5 w-3.5 mr-1.5" />
              Линзы Шелла
            </TabsTrigger>
            <TabsTrigger value="bond" className="text-xs">
              <Layers className="h-3.5 w-3.5 mr-1.5" />
              Матрица Бонда
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reverse" className="mt-4">
            <ReverseMDAPanel result={result} />
          </TabsContent>

          <TabsContent value="classic" className="mt-4">
            <ClassicMDAPanel result={result} />
          </TabsContent>

          <TabsContent value="lenses" className="mt-4">
            <LensAuditPanel result={result} />
          </TabsContent>

          <TabsContent value="bond" className="mt-4">
            <BondMatrixPanel result={result} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
