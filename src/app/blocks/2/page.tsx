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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  RefreshCw,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Check,
  Zap,
  ArrowRight,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  Shield,
  Activity,
  Layers,
  Flame,
  BrainCircuit,
  Wrench,
  ArrowDownToLine,
  GitBranch,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { usePipeline } from "@/hooks/use-pipeline";
import { apiRoutes } from "@/config/api";
import { GENRES } from "@/config/genres";

// ============================================================
// Константы
// ============================================================

const LOOP_TYPES = [
  { value: "engine", label: "Engine (Двигатель)", description: "Усиливающие петли, один ресурс → рост. Action, Shooter, Platformer." },
  { value: "economy", label: "Economy (Экономика)", description: "Смешанные петли, конвертация ресурсов. RPG, Strategy, Simulation." },
  { value: "ecology", label: "Ecology (Экология)", description: "Балансирующие петли, равновесие. Horror, Survival, Sandbox." },
  { value: "hybrid", label: "Hybrid (Гибрид)", description: "Смешанная структура. Adventure, Roguelike, Tower Defense." },
];

const DEFAULT_MECHANICS = "Враги, Здоровье, Очки опыта, Уровни";

const LOOP_TYPE_BADGES: Record<string, { label: string; color: string; icon: typeof Flame }> = {
  engine: { label: "Двигатель", color: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800", icon: Flame },
  economy: { label: "Экономика", color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800", icon: Activity },
  ecology: { label: "Экология", color: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800", icon: Shield },
  hybrid: { label: "Гибрид", color: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800", icon: Layers },
};

const SEVERITY_STYLES: Record<string, { color: string; icon: typeof AlertTriangle }> = {
  critical: { color: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300", icon: AlertTriangle },
  warning: { color: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-300", icon: AlertCircle },
  info: { color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300", icon: Info },
};

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
};

const HIERARCHY_LEVELS: { key: string; label: string; timeScale: string; icon: typeof Activity }[] = [
  { key: "micro", label: "Микро", timeScale: "мс-секунды", icon: Zap },
  { key: "small", label: "Малая", timeScale: "1-2 мин", icon: RefreshCw },
  { key: "medium", label: "Средняя", timeScale: "5-10 мин", icon: Activity },
  { key: "large", label: "Большая", timeScale: "15-30 мин", icon: Layers },
  { key: "macro", label: "Макро", timeScale: "часы", icon: Shield },
  { key: "meta", label: "Мета", timeScale: "недели-месяцы", icon: BrainCircuit },
];

// ============================================================
// Типы
// ============================================================

interface CoreLoopFormState {
  conceptId: string;
  mechanics: string;
  genre: string;
  desiredLoopType: string;
  customSteps: string;
}

interface CoreLoopDesignResult {
  id: string;
  structural_type: Record<string, unknown>;
  steps: Record<string, unknown>[];
  inner_loops: Record<string, unknown>[];
  outer_loops: Record<string, unknown>[];
  meta_loop: Record<string, unknown> | null;
  pathologies: Record<string, unknown>;
  recommendations: Record<string, unknown>[];
  validation: Record<string, unknown> | null;
  loop_hierarchy: Record<string, unknown> | null;
  stages_completed: number[];
  latency_ms: number;
  models_used: string[];
}

// ============================================================
// Sub-components
// ============================================================

// --- StructuralTypeCard ---

function StructuralTypeCard({ structuralType }: { structuralType: Record<string, unknown> }) {
  const typeStr = (structuralType.type as string) || "hybrid";
  const subType = (structuralType.sub_type as string) || "";
  const hasBraking = structuralType.has_braking as boolean;
  const currencies = (structuralType.currencies as string[]) || [];
  const resources = (structuralType.resources as Record<string, unknown>[]) || [];
  const riskAssessment = structuralType.risk_assessment as Record<string, unknown> | undefined;
  const loops = (structuralType.loops as Record<string, unknown>[]) || [];

  const typeBadge = LOOP_TYPE_BADGES[typeStr] || LOOP_TYPE_BADGES.hybrid;
  const TypeIcon = typeBadge.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          Структурный тип (Этап 1)
        </CardTitle>
        <CardDescription>
          Алгоритм 3.2 Этап 1 — классификация структурного типа Core Loop
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Type & Subtype */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${typeBadge.color}`}>
            <TypeIcon className="h-4 w-4" />
            {typeBadge.label}
          </span>
          {subType && (
            <Badge variant="outline" className="text-xs">{subType.replace(/_/g, " ")}</Badge>
          )}
          {hasBraking ? (
            <Badge variant="outline" className="text-xs border-green-400 text-green-700 dark:text-green-400">
              <Check className="h-3 w-3 mr-1" />
              Торможение
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs border-yellow-400 text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Без торможения
            </Badge>
          )}
        </div>

        {/* Currencies */}
        {currencies.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Валюты</p>
            <div className="flex flex-wrap gap-1.5">
              {currencies.map((c, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Resources */}
        {resources.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">
              Ресурсы ({resources.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {resources.map((r, i) => {
                const name = (r.name as string) || `Ресурс ${i + 1}`;
                const class_ = (r.class_ as string) || (r.class as string) || "";
                return (
                  <Badge key={i} variant="outline" className="text-xs">
                    {name}
                    {class_ && <span className="ml-1 text-muted-foreground">({class_})</span>}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Loops overview */}
        {loops.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Петли</p>
            <div className="space-y-1.5">
              {loops.map((loop, i) => {
                const loopType = (loop.type as string) || "";
                const desc = (loop.description as string) || "";
                return (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="text-xs">{loopType}</Badge>
                    <span className="text-muted-foreground">{desc}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Risk Assessment */}
        {riskAssessment && (
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Оценка рисков</span>
              <Badge
                variant="outline"
                className={`text-xs ${
                  riskAssessment.risk_level === "high"
                    ? "border-red-400 text-red-700 dark:text-red-400"
                    : riskAssessment.risk_level === "medium"
                      ? "border-yellow-400 text-yellow-700 dark:text-yellow-400"
                      : "border-green-400 text-green-700 dark:text-green-400"
                }`}
              >
                {(riskAssessment.risk_level as string) || "low"}
              </Badge>
            </div>
            {Array.isArray(riskAssessment.likely_pathologies) && riskAssessment.likely_pathologies.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {(riskAssessment.likely_pathologies as string[]).map((p, i) => (
                  <Badge key={i} variant="outline" className="text-xs border-yellow-400 text-yellow-700 dark:text-yellow-400">
                    {p}
                  </Badge>
                ))}
              </div>
            )}
            {Array.isArray(riskAssessment.mitigation_suggestions) && riskAssessment.mitigation_suggestions.length > 0 && (
              <div className="space-y-1">
                {(riskAssessment.mitigation_suggestions as string[]).map((s, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Info className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- CoreLoopDiagram — визуальная круговая диаграмма шагов ---

function CoreLoopDiagram({ steps }: { steps: Record<string, unknown>[] }) {
  if (!steps || steps.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <RefreshCw className="h-10 w-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm">Шаги Core Loop не определены</p>
        </CardContent>
      </Card>
    );
  }

  const stepCount = steps.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" />
          Core Loop — диаграмма шагов
        </CardTitle>
        <CardDescription>
          Визуализация цикла из {stepCount} шагов. Последний шаг ведёт к первому.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Circular diagram using CSS */}
        <div className="flex justify-center mb-4">
          <div className="relative" style={{ width: 320, height: 320 }}>
            {steps.map((step, i) => {
              const action = (step.action as string) || `Шаг ${i + 1}`;
              const mechanics = (step.mechanics as string[]) || [];
              const consumed = (step.resources_consumed as string[]) || [];
              const produced = (step.resources_produced as string[]) || [];
              const feedbackType = (step.feedback_type as string) || "neutral";

              // Calculate position in circle
              const angle = (2 * Math.PI * i) / stepCount - Math.PI / 2;
              const radius = 120;
              const x = 160 + radius * Math.cos(angle) - 50;
              const y = 160 + radius * Math.sin(angle) - 30;

              const feedbackColor =
                feedbackType === "positive"
                  ? "border-green-400 bg-green-50 dark:bg-green-950/30"
                  : feedbackType === "negative"
                    ? "border-red-400 bg-red-50 dark:bg-red-950/30"
                    : "border-blue-400 bg-blue-50 dark:bg-blue-950/30";

              return (
                <div
                  key={i}
                  className={`absolute w-[100px] rounded-lg border-2 p-2 text-center shadow-sm ${feedbackColor}`}
                  style={{ left: x, top: y }}
                >
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                      {i + 1}
                    </span>
                  </div>
                  <p className="text-xs font-medium leading-tight">{action}</p>
                  {mechanics.length > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {mechanics.slice(0, 2).join(", ")}
                    </p>
                  )}
                </div>
              );
            })}
            {/* Center label */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <RefreshCw className="h-6 w-6 text-primary mx-auto mb-1 opacity-40" />
                <p className="text-xs text-muted-foreground">Core Loop</p>
                <p className="text-[10px] text-muted-foreground">{stepCount} шагов</p>
              </div>
            </div>
            {/* Arrows between steps (simplified as lines) */}
            <svg className="absolute inset-0 pointer-events-none" width="320" height="320">
              {steps.map((_, i) => {
                const fromAngle = (2 * Math.PI * i) / stepCount - Math.PI / 2;
                const toAngle = (2 * Math.PI * ((i + 1) % stepCount)) / stepCount - Math.PI / 2;
                const radius = 120;
                const fromX = 160 + radius * Math.cos(fromAngle);
                const fromY = 160 + radius * Math.sin(fromAngle);
                const toX = 160 + radius * Math.cos(toAngle);
                const toY = 160 + radius * Math.sin(toAngle);
                return (
                  <line
                    key={i}
                    x1={fromX}
                    y1={fromY}
                    x2={toX}
                    y2={toY}
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-muted-foreground/30"
                    markerEnd="url(#arrowhead)"
                  />
                );
              })}
              <defs>
                <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" className="fill-muted-foreground/30" />
                </marker>
              </defs>
            </svg>
          </div>
        </div>

        {/* Steps detail list */}
        <div className="space-y-2">
          {steps.map((step, i) => {
            const action = (step.action as string) || `Шаг ${i + 1}`;
            const mechanics = (step.mechanics as string[]) || [];
            const consumed = (step.resources_consumed as string[]) || [];
            const produced = (step.resources_produced as string[]) || [];
            const duration = (step.duration_estimate as number) || 0;
            return (
              <div key={i} className="rounded-md border p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium">{action}</span>
                  </div>
                  {duration > 0 && (
                    <span className="text-xs text-muted-foreground">~{duration}с</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 pl-7">
                  {mechanics.map((m, mi) => (
                    <Badge key={mi} variant="outline" className="text-[10px]">{m}</Badge>
                  ))}
                  {consumed.length > 0 && consumed.map((r, ri) => (
                    <Badge key={`c${ri}`} variant="outline" className="text-[10px] border-red-300 text-red-700 dark:text-red-400">
                      -{r}
                    </Badge>
                  ))}
                  {produced.length > 0 && produced.map((r, ri) => (
                    <Badge key={`p${ri}`} variant="outline" className="text-[10px] border-green-300 text-green-700 dark:text-green-400">
                      +{r}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// --- LoopHierarchyTree — сворачиваемое дерево иерархии петель ---

function LoopHierarchyTree({ hierarchy }: { hierarchy: Record<string, unknown> }) {
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set(["small"]));

  const toggleLevel = (level: string) => {
    setExpandedLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          Иерархия петель (Этап 2)
        </CardTitle>
        <CardDescription>
          Алгоритм 3.2 Этап 2 — 6 уровней: микро → мета
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {HIERARCHY_LEVELS.map((level) => {
          const loops = hierarchy[level.key] as Record<string, unknown>[] | undefined;
          const loopCount = loops?.length || 0;
          const isExpanded = expandedLevels.has(level.key);
          const LevelIcon = level.icon;

          return (
            <div key={level.key} className="rounded-md border">
              <button
                className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                onClick={() => toggleLevel(level.key)}
              >
                <LevelIcon className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium flex-1">{level.label}</span>
                <span className="text-xs text-muted-foreground">{level.timeScale}</span>
                <Badge variant="secondary" className="text-xs">{loopCount}</Badge>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </button>
              {isExpanded && loops && loops.length > 0 && (
                <div className="border-t px-3 pb-3 pt-2 space-y-2">
                  {loops.map((loop, i) => {
                    const actions = (loop.actions as string[]) || [];
                    const parentStep = (loop.parent_step as string) || "";
                    return (
                      <div key={i} className="rounded-md bg-muted/30 p-2.5 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">Петля {i + 1}</span>
                          {parentStep && (
                            <Badge variant="outline" className="text-[10px]">
                              родитель: {parentStep}
                            </Badge>
                          )}
                        </div>
                        {actions.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {actions.map((a, ai) => (
                              <span key={ai} className="text-[11px] bg-background rounded px-1.5 py-0.5 border">
                                {a}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {isExpanded && (!loops || loops.length === 0) && (
                <div className="border-t px-3 py-3 text-xs text-muted-foreground text-center">
                  Нет петель на этом уровне
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// --- PathologyPanel ---

function PathologyPanel({ pathologies }: { pathologies: Record<string, unknown> }) {
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

// --- ValidationPanel ---

function ValidationPanel({ validation }: { validation: Record<string, unknown> }) {
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

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400">Предупреждения</p>
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-xs rounded-md bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 p-2">
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- RecommendationsPanel ---

function RecommendationsPanel({ recommendations }: { recommendations: Record<string, unknown>[] }) {
  if (!recommendations || recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Рекомендации (Этап 5)</CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-center text-muted-foreground text-sm">
          Нет рекомендаций — Core Loop прошёл валидацию
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          Рекомендации (Этап 5)
        </CardTitle>
        <CardDescription>
          Алгоритм 3.2 Этап 5 — формализованные + AI-рекомендации
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {recommendations.map((rec, i) => {
          const target = (rec.target as string) || "";
          const recommendation = (rec.recommendation as string) || (rec.description as string) || "";
          const priority = (rec.priority as string) || "medium";
          const category = (rec.category as string) || "";
          const source = (rec.source as string) || "formal";

          return (
            <div key={i} className="rounded-md border p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{target}</span>
                  {category && (
                    <Badge variant="outline" className="text-[10px]">{category}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_STYLES[priority] || PRIORITY_STYLES.medium}`}>
                    {priority}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {source === "ai" ? "AI" : "Формал."}
                  </Badge>
                </div>
              </div>
              {recommendation && (
                <p className="text-xs text-muted-foreground">{recommendation}</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Main Page Component
// ============================================================

export default function Block2Page() {
  const { apiFetch } = useAuth();
  const { toast } = useToast();

  // --- Pipeline ---
  const projectId = typeof window !== "undefined" ? localStorage.getItem("gidede_active_project") : null;
  const pipeline = usePipeline(projectId);
  const [pipelineLoaded, setPipelineLoaded] = useState(false);
  const [isLoadingPipeline, setIsLoadingPipeline] = useState(false);

  // --- Form state ---
  const [form, setForm] = useState<CoreLoopFormState>({
    conceptId: "",
    mechanics: DEFAULT_MECHANICS,
    genre: "rpg",
    desiredLoopType: "",
    customSteps: "",
  });

  // --- Generation state ---
  const [isDesigning, setIsDesigning] = useState(false);
  const [result, setResult] = useState<CoreLoopDesignResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- Pipeline auto-fill handler ---
  const handleLoadFromPipeline = useCallback(async () => {
    if (!projectId) {
      toast({ title: "Нет активного проекта", description: "Выберите проект для загрузки данных из пайплайна", variant: "destructive" });
      return;
    }
    setIsLoadingPipeline(true);
    try {
      const data = await pipeline.prepareInput(2) as Record<string, unknown> | null;
      if (!data) {
        toast({ title: "Нет данных", description: "Не удалось загрузить данные из пайплайна. Убедитесь, что Блок 1 заполнен.", variant: "destructive" });
        return;
      }
      const updates: Partial<CoreLoopFormState> = {};
      if (data.concept_id) updates.conceptId = data.concept_id as string;
      if (data.genre) updates.genre = data.genre as string;
      if (Array.isArray(data.mechanics) && data.mechanics.length > 0) {
        updates.mechanics = (data.mechanics as string[]).join(", ");
      }
      if (Object.keys(updates).length > 0) {
        setForm((prev) => ({ ...prev, ...updates }));
        setPipelineLoaded(true);
        toast({
          title: "Данные загружены из пайплайна",
          description: `Загружено: ${Object.keys(updates).map((k) => {
            const labels: Record<string, string> = { conceptId: "ID концепции", mechanics: "Механики", genre: "Жанр" };
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
  const mechanicsLength = form.mechanics.trim().length;
  const isFormValid = mechanicsLength >= 3;

  // --- Handlers ---
  const updateField = useCallback(
    <K extends keyof CoreLoopFormState>(field: K, value: CoreLoopFormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleDesign = useCallback(async () => {
    if (!isFormValid) return;

    setIsDesigning(true);
    setError(null);
    setResult(null);

    try {
      const mechanicsList = form.mechanics
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);

      const customStepsList = form.customSteps
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const body: Record<string, unknown> = {
        concept_id: form.conceptId || "standalone",
        mechanics: mechanicsList,
        genre: form.genre,
      };

      if (form.desiredLoopType) {
        body.desired_loop_type = form.desiredLoopType;
      }
      if (customStepsList.length > 0) {
        body.custom_steps = customStepsList;
      }

      const data = await apiFetch<CoreLoopDesignResult>("/api/v1/coreloop/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      setResult(data);

      // Уведомляем pipeline об обновлении Блока 2
      try {
        const projectId = typeof window !== "undefined" ? localStorage.getItem("gidede_active_project") : null;
        if (projectId) {
          await apiFetch(
            apiRoutes.pipeline.notify(),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ project_id: projectId, block_id: 2, metadata: {} }),
            }
          );
        }
      } catch {
        // Pipeline notification is non-critical
      }

      toast({
        title: "Core Loop спроектирован",
        description: `Этапы: ${data.stages_completed?.join(", ") || "1-5"}. ${data.pathologies?.total_count || 0} патологий.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Неизвестная ошибка";
      setError(message);
      toast({
        title: "Ошибка проектирования",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsDesigning(false);
    }
  }, [form, isFormValid, apiFetch, toast]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <RefreshCw className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Core Loop Designer</h1>
          <p className="text-sm text-muted-foreground">
            Блок 2 • Алгоритм 3.2 • 5 этапов
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
            <Badge variant="secondary" className="text-[10px] font-bold">Блок 2 ←</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="text-[10px]">Блок 3</Badge>
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
          <CardTitle className="text-base">Параметры проектирования</CardTitle>
          <CardDescription>
            Укажите данные для проектирования Core Loop. Алгоритм 3.2: классификация → иерархия → патологии → валидация → рекомендации.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Concept ID */}
          <div className="space-y-1.5">
            <Label htmlFor="conceptId" className="text-sm">ID концепции (из Блока 1)</Label>
            <Input
              id="conceptId"
              placeholder="Оставьте пустым для автономного проектирования"
              value={form.conceptId}
              onChange={(e) => updateField("conceptId", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Если концепция создана в Блоке 1, укажите её ID для автоматической загрузки данных.
            </p>
          </div>

          {/* Mechanics */}
          <div className="space-y-1.5">
            <Label htmlFor="mechanics" className="text-sm">Механики (через запятую) *</Label>
            <Input
              id="mechanics"
              placeholder={DEFAULT_MECHANICS}
              value={form.mechanics}
              onChange={(e) => updateField("mechanics", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Механики из MechanicsDB, которые определяют Core Loop. Минимум 2-3 механики.
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
            <p className="text-xs text-muted-foreground">
              Жанр влияет на определение структурного типа Core Loop.
            </p>
          </div>

          {/* Desired Loop Type */}
          <div className="space-y-1.5">
            <Label className="text-sm">Желаемый тип петли</Label>
            <Select value={form.desiredLoopType} onValueChange={(v) => updateField("desiredLoopType", v === "auto" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Определить автоматически" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Определить автоматически</SelectItem>
                {LOOP_TYPES.map((lt) => (
                  <SelectItem key={lt.value} value={lt.value}>
                    {lt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Loop type descriptions */}
          {form.desiredLoopType && form.desiredLoopType !== "auto" && (
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">
                {LOOP_TYPES.find(lt => lt.value === form.desiredLoopType)?.description}
              </p>
            </div>
          )}

          {/* Custom Steps */}
          <div className="space-y-1.5">
            <Label htmlFor="customSteps" className="text-sm">Пользовательские шаги (по строкам)</Label>
            <Textarea
              id="customSteps"
              placeholder={"Найти врага\nСразиться\nПолучить награду\nУлучшить экипировку"}
              value={form.customSteps}
              onChange={(e) => updateField("customSteps", e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Необязательно. Каждый шаг на отдельной строке. Если не указаны, шаги генерируются автоматически.
            </p>
          </div>

          {/* Submit button */}
          <Button
            onClick={handleDesign}
            disabled={!isFormValid || isDesigning}
            className="w-full"
            size="lg"
          >
            {isDesigning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Проектирование Core Loop...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Проектировать Core Loop
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="py-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">Ошибка проектирования</p>
                <p className="text-xs text-muted-foreground mt-1">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-6">
          {/* Meta info */}
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-xs">
                    Этапы: {result.stages_completed.join(", ")}
                  </Badge>
                  {result.latency_ms > 0 && (
                    <Badge variant="outline" className="text-xs">{result.latency_ms} мс</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {result.models_used.map((m, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">{m}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 1. Structural Type */}
          {result.structural_type && Object.keys(result.structural_type).length > 0 && (
            <StructuralTypeCard structuralType={result.structural_type} />
          )}

          {/* 2. Core Loop Diagram */}
          {result.steps && result.steps.length > 0 && (
            <CoreLoopDiagram steps={result.steps} />
          )}

          {/* 3. Loop Hierarchy */}
          {result.loop_hierarchy && Object.keys(result.loop_hierarchy).length > 0 && (
            <LoopHierarchyTree hierarchy={result.loop_hierarchy} />
          )}

          {/* 4. Pathologies */}
          {result.pathologies && Object.keys(result.pathologies).length > 0 && (
            <PathologyPanel pathologies={result.pathologies} />
          )}

          {/* 5. Validation */}
          {result.validation && Object.keys(result.validation).length > 0 && (
            <ValidationPanel validation={result.validation} />
          )}

          {/* 6. Recommendations */}
          {result.recommendations && result.recommendations.length > 0 && (
            <RecommendationsPanel recommendations={result.recommendations} />
          )}
        </div>
      )}
    </div>
  );
}
