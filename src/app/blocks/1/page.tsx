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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
  Lightbulb,
  Loader2,
  Sparkles,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  Star,
  Zap,
  Shield,
  ArrowRight,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  Eye,
  Play,
  GitBranch,
  Rocket,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { usePipeline } from "@/hooks/use-pipeline";
import { apiRoutes } from "@/config/api";
import { GENRES } from "@/config/genres";
import { AESTHETIC_MAP, YEE_MOTIVATIONS } from "@/config/aesthetics";
import {
  AestheticProfile,
  DynamicsProfile,
  ValidationReport,
} from "../../../../shared/types/typescript/interfaces";

const PLATFORMS = [
  { value: "pc", label: "PC" },
  { value: "mobile", label: "Mobile" },
  { value: "console", label: "Console" },
  { value: "vr", label: "VR" },
  { value: "web", label: "Web" },
];

const BUDGET_OPTIONS = [
  { value: "solo", label: "Solo-разработчик" },
  { value: "small", label: "Малая команда (2-5)" },
  { value: "medium", label: "Средняя команда (6-15)" },
  { value: "large", label: "Большая команда (16+)" },
];

const EXPERIENCE_LEVELS = [
  { value: "casual", label: "Казуальный" },
  { value: "midcore", label: "Мидкор" },
  { value: "hardcore", label: "Хардкор" },
];

// (AESTHETIC_MAP moved to @/config/aesthetics)

// ============================================================
// Типы
// ============================================================

interface ConceptFormState {
  idea: string;
  genreMode: "auto" | "explicit";
  genre: string;
  targetMotivations: string[];
  experienceLevel: string;
  platforms: string[];
  referenceGames: string;
  budget: string;
  forbiddenMechanics: string[];
  forbiddenInput: string;
}

interface ConceptGenerationResult {
  id: string;
  title: string;
  genre: string;
  target_audience: string;
  story_synopsis: string;
  gameplay_description: string;
  unique_features: string[];
  competitors: string[];
  rating?: string;
  aesthetic_profile: AestheticProfile | null;
  dynamics_profile: DynamicsProfile | null;
  mechanic_set: Record<string, unknown> | null;
  core_loop_candidates: Record<string, unknown>[];
  usp_candidates: Record<string, unknown>[];
  validation_report: ValidationReport | null;
  status: string;
  generation_metadata?: {
    stages_completed: number[];
    latency_ms: number;
    models_used: string[];
  };
}

// ============================================================
// OnePagerCard — отображение One-Pager с 8 полями
// ============================================================

function OnePagerCard({ result }: { result: ConceptGenerationResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          {result.title || "Концепция сгенерирована"}
        </CardTitle>
        {result.generation_metadata && (
          <CardDescription>
            Этапы:{" "}
            {result.generation_metadata.stages_completed
              .map((s) => `${s}`)
              .join(", ")}{" "}
            &bull; {result.generation_metadata.latency_ms} мс &bull;{" "}
            {result.generation_metadata.models_used.join(", ")}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Строка 1: Жанр, Аудитория, Рейтинг */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Жанр</p>
            <Badge variant="secondary" className="text-sm">{result.genre || "—"}</Badge>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Целевая аудитория</p>
            <p className="text-sm">{result.target_audience || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Возрастной рейтинг</p>
            <Badge variant="outline">{result.rating || "TBD"}</Badge>
          </div>
        </div>

        <Separator />

        {/* Синопсис */}
        {result.story_synopsis && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Синопсис сюжета</p>
            <p className="text-sm leading-relaxed">{result.story_synopsis}</p>
          </div>
        )}

        {/* Описание геймплея */}
        {result.gameplay_description && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Описание геймплея</p>
            <p className="text-sm leading-relaxed">{result.gameplay_description}</p>
          </div>
        )}

        <Separator />

        {/* Уникальные фичи */}
        {result.unique_features && result.unique_features.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Уникальные фичи</p>
            <ul className="space-y-1.5">
              {result.unique_features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Star className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Конкуренты */}
        {result.competitors && result.competitors.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Конкуренты</p>
            <div className="flex flex-wrap gap-2">
              {result.competitors.map((c, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {c}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// AestheticProfileView — цветные бейджи для 8 эстетик
// ============================================================

function AestheticBadge({ value, level }: { value: string; level: "primary" | "secondary" | "tertiary" }) {
  const key = (value || "").toLowerCase();
  const mapping = AESTHETIC_MAP[key];
  const sizeClass =
    level === "primary"
      ? "text-base px-4 py-2"
      : level === "secondary"
        ? "text-sm px-3 py-1.5"
        : "text-xs px-2.5 py-1";
  const boldClass = level === "primary" ? "font-bold" : level === "secondary" ? "font-semibold" : "font-medium";

  if (!mapping) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border ${sizeClass} ${boldClass} bg-muted text-muted-foreground`}>
        {value}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${mapping.color} ${sizeClass} ${boldClass}`}>
      <span>{mapping.emoji}</span>
      {mapping.label}
    </span>
  );
}

function AestheticProfileView({ profile }: { profile: AestheticProfile }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Эстетический профиль (Reverse MDA)</CardTitle>
        <CardDescription>
          Алгоритм 3.1 Этап 2 — определение целевых эстетических ценностей
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground w-16 shrink-0">Основная</span>
            <AestheticBadge value={profile.primary} level="primary" />
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground hidden sm:block shrink-0" />
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground w-16 shrink-0">Вторичная</span>
            <AestheticBadge value={profile.secondary} level="secondary" />
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground hidden sm:block shrink-0" />
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground w-16 shrink-0">Третичная</span>
            <AestheticBadge value={profile.tertiary} level="tertiary" />
          </div>
        </div>
        {profile.rationale && (
          <p className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
            {profile.rationale}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// MechanicSetView — механики по категориям с аккордеоном
// ============================================================

const MECHANIC_GROUPS: { key: string; label: string }[] = [
  { key: "base", label: "Базовые механики" },
  { key: "combat", label: "Боевые механики" },
  { key: "progression", label: "Прогрессионные механики" },
  { key: "spatial", label: "Пространственные механики" },
  { key: "social", label: "Социальные / информационные механики" },
];

function MechanicSetView({ mechanicSet }: { mechanicSet: Record<string, unknown> }) {
  const compatibilityScore = typeof mechanicSet.compatibility_score === "number" ? mechanicSet.compatibility_score : 0;
  const conflictsResolved = Array.isArray(mechanicSet.conflicts_resolved) ? mechanicSet.conflicts_resolved as string[] : [];
  const synergiesDetected = Array.isArray(mechanicSet.synergies_detected) ? mechanicSet.synergies_detected as Record<string, unknown>[] : [];
  const warnings = Array.isArray(mechanicSet.warnings) ? mechanicSet.warnings as string[] : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Набор механик (MechanicsDB)</CardTitle>
        <CardDescription>
          Алгоритм 3.1 Этап 4 — выбор механик из базы
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Compatibility score */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-muted-foreground">Совместимость механик</span>
            <span className="text-sm font-semibold">{compatibilityScore}%</span>
          </div>
          <Progress value={compatibilityScore} className="h-2.5" />
        </div>

        {/* Conflicts & Synergies */}
        <div className="flex flex-wrap gap-2">
          {conflictsResolved.map((c, i) => (
            <Badge key={i} variant="outline" className="text-xs border-yellow-400 text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {c}
            </Badge>
          ))}
          {synergiesDetected.map((s, i) => {
            const label = typeof s === "string" ? s : ((s as Record<string, unknown>).name as unknown as string || s as unknown as string || `Синергия ${i + 1}`);
            return (
              <Badge key={i} variant="outline" className="text-xs border-green-400 text-green-700 dark:text-green-400">
                <Zap className="h-3 w-3 mr-1" />
                {label}
              </Badge>
            );
          })}
        </div>

        {/* Mechanic groups in accordion */}
        <Accordion type="multiple" className="w-full">
          {MECHANIC_GROUPS.map((group) => {
            const items = mechanicSet[group.key];
            if (!Array.isArray(items) || items.length === 0) return null;
            return (
              <AccordionItem key={group.key} value={group.key}>
                <AccordionTrigger className="text-sm">
                  <span className="flex items-center gap-2">
                    {group.label}
                    <Badge variant="secondary" className="text-xs ml-1">{items.length}</Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-1">
                    {items.map((mech, i) => {
                      const m = mech as Record<string, unknown>;
                      const name = (m.name as unknown as string) || (m as unknown as string) || `Механика ${i + 1}`;
                      const groupVal = (m.group as string) || group.key;
                      const description = (m.description as string) || "";
                      return (
                        <div key={i} className="rounded-md border p-3 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{name}</span>
                            <Badge variant="outline" className="text-xs">{groupVal}</Badge>
                          </div>
                          {description && (
                            <p className="text-xs text-muted-foreground">{description}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="space-y-1.5">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
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

// ============================================================
// CoreLoopCandidates — 3 варианта с выбором
// ============================================================

const LOOP_TYPE_LABELS: Record<string, string> = {
  engine: "Двигатель",
  economy: "Экономика",
  ecology: "Экология",
  hybrid: "Гибрид",
};

function CoreLoopCandidates({
  candidates,
  selectedIndex,
  onSelect,
}: {
  candidates: Record<string, unknown>[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Кандидаты Core Loop</CardTitle>
        <CardDescription>
          Алгоритм 3.1 Этап 5 — выберите один вариант Core Loop
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {candidates.map((candidate, i) => {
          const name = (candidate.name as string) || `Вариант ${i + 1}`;
          const steps = Array.isArray(candidate.steps) ? candidate.steps : [];
          const loopType = (candidate.loop_type as string) || "hybrid";
          const funCheck = (candidate.fun_check as string) || (candidate.fun_check_reasoning as string) || "";
          const duration = (candidate.estimated_duration_seconds as number) ?? 30;
          const isSelected = selectedIndex === i;

          return (
            <div
              key={i}
              onClick={() => onSelect(i)}
              className={`rounded-lg border-2 p-4 cursor-pointer transition-all space-y-3 ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/40 hover:bg-muted/30"
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {LOOP_TYPE_LABELS[loopType] || loopType}
                  </Badge>
                  {isSelected && (
                    <Badge className="text-xs bg-primary text-primary-foreground">
                      <Check className="h-3 w-3 mr-1" />
                      Выбрано
                    </Badge>
                  )}
                </div>
              </div>

              {/* Steps */}
              {steps.length > 0 && (
                <ol className="space-y-1.5 pl-1">
                  {steps.map((step, si) => {
                    const stepText = typeof step === "string" ? step : ((step as Record<string, unknown>)?.action as string) || ((step as Record<string, unknown>)?.description as string) || JSON.stringify(step);
                    return (
                      <li key={si} className="flex items-start gap-2 text-sm">
                        <span className="flex items-center justify-center h-5 w-5 rounded-full bg-muted text-xs font-medium shrink-0 mt-0.5">
                          {si + 1}
                        </span>
                        <span>{stepText}</span>
                      </li>
                    );
                  })}
                </ol>
              )}

              {/* Fun check & duration */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {funCheck && (
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {funCheck}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  ~{duration} сек/цикл
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ============================================================
// USPCandidates — 3 варианта USP с выбором
// ============================================================

function USPCandidates({
  candidates,
  selectedIndex,
  onSelect,
}: {
  candidates: Record<string, unknown>[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Кандидаты USP</CardTitle>
        <CardDescription>
          Алгоритм 3.1 Этап 5 — выберите один вариант USP
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {candidates.map((candidate, i) => {
          const usp = (candidate.usp as string) || "";
          const triangleCheck = (candidate.triangle_check as Record<string, unknown>) || (candidate.triangle_of_weirdness_check as Record<string, unknown>) || {};
          const competitiveDiff = (candidate.competitive_differentiation as string) || "";
          const isSelected = selectedIndex === i;

          // Determine weird/appealing/credible from triangle_check
          const weird = triangleCheck.weird ?? triangleCheck.weirdness ?? null;
          const appealing = triangleCheck.appealing ?? null;
          const credible = triangleCheck.credible ?? null;

          const boolToIndicator = (val: unknown) => {
            if (val === true || val === "pass" || val === "yes") return "pass";
            if (val === false || val === "fail" || val === "no") return "fail";
            return "unknown";
          };

          return (
            <div
              key={i}
              onClick={() => onSelect(i)}
              className={`rounded-lg border-2 p-4 cursor-pointer transition-all space-y-3 ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/40 hover:bg-muted/30"
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium leading-relaxed">{usp || `USP вариант ${i + 1}`}</p>
                {isSelected && (
                  <Badge className="text-xs bg-primary text-primary-foreground shrink-0">
                    <Check className="h-3 w-3 mr-1" />
                    Выбрано
                  </Badge>
                )}
              </div>

              {/* Triangle check indicators */}
              {(weird !== null || appealing !== null || credible !== null) && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">Triangle:</span>
                  {weird !== null && (
                    <span className="flex items-center gap-1 text-xs">
                      {boolToIndicator(weird) === "pass" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      ) : boolToIndicator(weird) === "fail" ? (
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                      ) : (
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      Странность
                    </span>
                  )}
                  {appealing !== null && (
                    <span className="flex items-center gap-1 text-xs">
                      {boolToIndicator(appealing) === "pass" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      ) : boolToIndicator(appealing) === "fail" ? (
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                      ) : (
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      Привлекательность
                    </span>
                  )}
                  {credible !== null && (
                    <span className="flex items-center gap-1 text-xs">
                      {boolToIndicator(credible) === "pass" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      ) : boolToIndicator(credible) === "fail" ? (
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                      ) : (
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      Достоверность
                    </span>
                  )}
                </div>
              )}

              {/* Competitive differentiation */}
              {competitiveDiff && (
                <p className="text-xs text-muted-foreground">{competitiveDiff}</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ============================================================
// ValidationReportView — цветные скоры валидаторов
// ============================================================

function ScoreIndicator({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  let colorClass = "text-red-600 dark:text-red-400";
  let bgClass = "bg-red-100 dark:bg-red-950/40";
  if (score >= 0.8) {
    colorClass = "text-green-600 dark:text-green-400";
    bgClass = "bg-green-100 dark:bg-green-950/40";
  } else if (score >= 0.6) {
    colorClass = "text-yellow-600 dark:text-yellow-400";
    bgClass = "bg-yellow-100 dark:bg-yellow-950/40";
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold ${bgClass} ${colorClass}`}>
      {score >= 0.8 ? <CheckCircle2 className="h-3.5 w-3.5" /> : score >= 0.6 ? <AlertTriangle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {pct}%
    </span>
  );
}

function ValidationReportView({ report }: { report: ValidationReport }) {
  // Handle both shared/types structure and Python API structure
  const overallScore = report.overall_score ?? 0;
  const overallPassed = overallScore >= 0.6;

  // Warnings and suggestions can be strings[] or object[]
  const warnings = Array.isArray(report.warnings)
    ? report.warnings.map((w) => typeof w === "string" ? w : (w as Record<string, unknown>).message as string || JSON.stringify(w))
    : [];
  const suggestions = Array.isArray(report.suggestions)
    ? report.suggestions.map((s) => typeof s === "string" ? s : (s as Record<string, unknown>).suggestion as string || (s as Record<string, unknown>).message as string || JSON.stringify(s))
    : [];

  // Try to get the three validators from both possible structures
  const triangleCheck = (report as unknown as Record<string, unknown>).triangle_check ?? (report as unknown as Record<string, unknown>).triangle_of_weirdness;
  const coreQuestions = (report as unknown as Record<string, unknown>).core_questions ?? (report as unknown as Record<string, unknown>).five_questions;
  const ideaFilters = (report as unknown as Record<string, unknown>).idea_filters ?? (report as unknown as Record<string, unknown>).eight_filters;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Отчёт валидации</CardTitle>
        <CardDescription>
          Алгоритм 3.1 Этап 6 — проверка концепции (3 валидатора)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Overall score */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Общий результат:</span>
          <ScoreIndicator score={overallScore} />
          <Badge variant={overallPassed ? "default" : "destructive"} className="text-xs">
            {overallPassed ? "Пройдено" : "Не пройдено"}
          </Badge>
        </div>

        <Separator />

        {/* Validator 1: Triangle of Weirdness */}
        {Boolean(triangleCheck) && (
          <ValidatorSection
            title="Triangle of Weirdness"
            description="Кн. 8 — баланс странности, привлекательности и достоверности"
            data={triangleCheck}
          />
        )}

        {/* Validator 2: 5 Core Questions */}
        {Boolean(coreQuestions) && (
          <ValidatorSection
            title="5 вопросов кор-геймплея"
            description="Кн. 10 — проверка ядра геймплея"
            data={coreQuestions}
          />
        )}

        {/* Validator 3: 8 Idea Filters */}
        {Boolean(ideaFilters) && (
          <ValidatorSection
            title="8 фильтров идеи"
            description="Кн. 1 — фильтрация качества идеи"
            data={ideaFilters}
          />
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400">Предупреждения</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs rounded-md bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 p-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Предложения по улучшению</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {suggestions.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-xs rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-2">
                  <Info className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Helper: renders a single validator result, handles both object and dict structures */
function ValidatorSection({ title, description, data }: { title: string; description: string; data: unknown }) {
  const d = data as Record<string, unknown>;

  // If it's a ValidationResult-like object with score/passed
  if (typeof d.score === "number") {
    const details = d.details as string | undefined;
    const validatorWarnings = Array.isArray(d.warnings)
      ? d.warnings.map((w: unknown) => typeof w === "string" ? w : (w as Record<string, unknown>).message as string || JSON.stringify(w))
      : [];
    const validatorSuggestions = Array.isArray(d.suggestions)
      ? d.suggestions.map((s: unknown) => typeof s === "string" ? s : (s as Record<string, unknown>).suggestion as string || (s as Record<string, unknown>).message as string || JSON.stringify(s))
      : [];

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{title}</span>
          <ScoreIndicator score={d.score} />
          <Badge variant={d.passed ? "default" : "destructive"} className="text-xs">
            {d.passed ? "Пройдено" : "Не пройдено"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {details && <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">{details}</p>}
        {validatorWarnings.length > 0 && (
          <div className="space-y-1 pl-2">
            {validatorWarnings.map((w, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-yellow-600 dark:text-yellow-400">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                {w}
              </div>
            ))}
          </div>
        )}
        {validatorSuggestions.length > 0 && (
          <div className="space-y-1 pl-2">
            {validatorSuggestions.map((s, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                {s}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // If it's a dict of questions/filters (Record<string, boolean> or Record<string, FilterResult>)
  const entries = Object.entries(d);
  if (entries.length > 0) {
    return (
      <div className="space-y-2">
        <span className="text-sm font-medium">{title}</span>
        <p className="text-xs text-muted-foreground">{description}</p>
        <div className="space-y-1.5">
          {entries.map(([key, val]) => {
            // boolean pass/fail
            if (typeof val === "boolean") {
              return (
                <div key={key} className="flex items-center gap-2 text-xs">
                  {val ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  )}
                  <span className={val ? "" : "text-red-600 dark:text-red-400"}>{key}</span>
                </div>
              );
            }
            // FilterResult-like with score
            if (val && typeof val === "object" && "score" in (val as Record<string, unknown>)) {
              const fv = val as Record<string, unknown>;
              const score = fv.score as number;
              const reason = (fv.reason as string) || "";
              const improvement = (fv.improvement as string) || "";
              return (
                <div key={key} className="rounded-md border p-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{key}</span>
                    <ScoreIndicator score={score} />
                  </div>
                  {reason && <p className="text-xs text-muted-foreground">{reason}</p>}
                  {improvement && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 flex items-start gap-1">
                      <Info className="h-3 w-3 mt-0.5 shrink-0" />
                      {improvement}
                    </p>
                  )}
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    );
  }

  return null;
}

// ============================================================
// Компонент
// ============================================================

export default function Block1Page() {
  const { apiFetch } = useAuth();
  const { toast } = useToast();

  // --- Pipeline ---
  const projectId = typeof window !== "undefined" ? localStorage.getItem("gidede_active_project") : null;
  const pipeline = usePipeline(projectId);
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);

  // --- Состояние формы ---
  const [form, setForm] = useState<ConceptFormState>({
    idea: "",
    genreMode: "auto",
    genre: "",
    targetMotivations: [],
    experienceLevel: "midcore",
    platforms: ["pc"],
    referenceGames: "",
    budget: "small",
    forbiddenMechanics: [],
    forbiddenInput: "",
  });

  // --- Состояние генерации ---
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ConceptGenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // --- Состояние выбора ---
  const [selectedCoreLoopIndex, setSelectedCoreLoopIndex] = useState<number | null>(null);
  const [selectedUSPIndex, setSelectedUSPIndex] = useState<number | null>(null);

  // --- Валидация ---
  const ideaLength = form.idea.trim().length;
  const isIdeaValid = ideaLength >= 10 && ideaLength <= 1000;
  const isMotivationsValid = form.targetMotivations.length >= 1;
  const isFormValid = isIdeaValid && isMotivationsValid;

  // --- Запуск полного пайплайна 1→2→3 ---
  const handleRunFullPipeline = useCallback(async () => {
    if (!isFormValid) return;
    if (!projectId) {
      toast({ title: "Нет активного проекта", description: "Выберите проект в сайдбаре", variant: "destructive" });
      return;
    }

    setIsRunningPipeline(true);
    setError(null);
    setCurrentStage("Запуск полного пайплайна 1→2→3...");

    try {
      const payload = {
        idea: form.idea.trim(),
        genre: form.genreMode === "auto" ? null : form.genre,
        target_audience: form.targetMotivations.length > 0
          ? { primary: form.targetMotivations, experience: form.experienceLevel }
          : null,
        platform: form.platforms.length > 0 ? form.platforms : null,
        constraints: {
          team_size: form.budget === "solo" ? 1 : form.budget === "small" ? 3 : form.budget === "medium" ? 10 : 20,
          budget: form.budget === "solo" || form.budget === "small" ? "low" : form.budget === "medium" ? "medium" : "high",
        },
        reference_games: form.referenceGames ? form.referenceGames.split(",").map((g: string) => g.trim()).filter(Boolean) : null,
        forbidden_mechanics: form.forbiddenMechanics.length > 0 ? form.forbiddenMechanics : null,
      };

      const data = await apiFetch<{
        concept_result?: ConceptGenerationResult;
        stages_completed?: number[];
        detail?: string;
      }>(
        apiRoutes.pipeline.runPartial(projectId),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ concept_input: payload }),
        }
      );

      if (data.detail) {
        throw new Error(data.detail);
      }
      setCurrentStage(null);

      // Если вернулся результат концепции, показываем его
      if (data.concept_result) {
        setResult(data.concept_result as ConceptGenerationResult);
      }

      await pipeline.fetchState();

      toast({
        title: "Полный пайплайн завершён",
        description: `Блоки 1→2→3 выполнены. ${data.stages_completed?.length || 3} этапа.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка запуска пайплайна";
      setError(message);
      toast({ title: "Ошибка пайплайна", description: message, variant: "destructive" });
      setCurrentStage(null);
    } finally {
      setIsRunningPipeline(false);
    }
  }, [form, isFormValid, projectId, apiFetch, pipeline, toast]);

  // --- Обработчики формы ---
  const updateField = useCallback(
    <K extends keyof ConceptFormState>(field: K, value: ConceptFormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const toggleMotivation = useCallback((motivation: string) => {
    setForm((prev) => {
      const current = prev.targetMotivations;
      if (current.includes(motivation)) {
        return {
          ...prev,
          targetMotivations: current.filter((m) => m !== motivation),
        };
      }
      if (current.length >= 3) return prev; // Максимум 3 мотивации
      return {
        ...prev,
        targetMotivations: [...current, motivation],
      };
    });
  }, []);

  const togglePlatform = useCallback((platform: string) => {
    setForm((prev) => {
      const current = prev.platforms;
      if (current.includes(platform)) {
        return {
          ...prev,
          platforms: current.filter((p) => p !== platform),
        };
      }
      return { ...prev, platforms: [...current, platform] };
    });
  }, []);

  const addForbiddenMechanic = useCallback(() => {
    const val = form.forbiddenInput.trim();
    if (val && !form.forbiddenMechanics.includes(val)) {
      setForm((prev) => ({
        ...prev,
        forbiddenMechanics: [...prev.forbiddenMechanics, val],
        forbiddenInput: "",
      }));
    }
  }, [form.forbiddenInput, form.forbiddenMechanics]);

  const removeForbiddenMechanic = useCallback((mechanic: string) => {
    setForm((prev) => ({
      ...prev,
      forbiddenMechanics: prev.forbiddenMechanics.filter((m) => m !== mechanic),
    }));
  }, []);

  // --- Генерация концепции ---
  const handleGenerate = useCallback(async () => {
    if (!isFormValid) return;

    setIsGenerating(true);
    setError(null);
    setResult(null);
    setSelectedCoreLoopIndex(null);
    setSelectedUSPIndex(null);
    setCurrentStage("Этап 1: Анализ и определение жанра...");

    try {
      // Формируем payload для API
      const payload = {
        idea: form.idea.trim(),
        genre:
          form.genreMode === "auto"
            ? null
            : form.genre,
        target_audience:
          form.targetMotivations.length > 0
            ? {
                primary: form.targetMotivations,
                experience: form.experienceLevel,
              }
            : null,
        platform: form.platforms.length > 0 ? form.platforms : null,
        constraints: {
          team_size:
            form.budget === "solo"
              ? 1
              : form.budget === "small"
                ? 3
                : form.budget === "medium"
                  ? 10
                  : 20,
          budget:
            form.budget === "solo"
              ? "low"
              : form.budget === "small"
                ? "low"
                : form.budget === "medium"
                  ? "medium"
                  : "high",
        },
        reference_games: form.referenceGames
          ? form.referenceGames
              .split(",")
              .map((g) => g.trim())
              .filter(Boolean)
          : null,
        forbidden_mechanics:
          form.forbiddenMechanics.length > 0
            ? form.forbiddenMechanics
            : null,
      };

      setCurrentStage("Этап 1: Анализ и определение жанра...");

      const response = await apiFetch<ConceptGenerationResult>(
        "/concept/generate",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      setCurrentStage(null);
      setResult(response);

      // Уведомляем pipeline об обновлении Блока 1
      try {
        const projectId = typeof window !== "undefined" ? localStorage.getItem("gidede_active_project") : null;
        if (projectId) {
          await apiFetch(
            apiRoutes.pipeline.notify(),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ project_id: projectId, block_id: 1, metadata: { concept_id: response.id } }),
            }
          );
        }
      } catch {
        // Pipeline notification is non-critical
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Произошла ошибка при генерации концепции"
      );
      setCurrentStage(null);
    } finally {
      setIsGenerating(false);
    }
  }, [form, isFormValid, apiFetch]);

  // --- Сохранение выбора ---
  const handleSaveSelection = useCallback(() => {
    toast({
      title: "Выбор сохранён",
      description: `Core Loop: ${selectedCoreLoopIndex !== null ? `Вариант ${selectedCoreLoopIndex + 1}` : "не выбран"} · USP: ${selectedUSPIndex !== null ? `Вариант ${selectedUSPIndex + 1}` : "не выбран"}`,
    });
  }, [selectedCoreLoopIndex, selectedUSPIndex, toast]);

  // ============================================================
  // Рендер
  // ============================================================

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Заголовок */}
      <div className="flex items-center gap-3 mb-6">
        <Lightbulb className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Генератор концепции</h1>
          <p className="text-sm text-muted-foreground">
            Блок 1 &bull; Алгоритм 3.1 &bull; 7 этапов
          </p>
        </div>
        <Badge
          variant="outline"
          className={result ? "text-green-600 ml-auto" : "text-yellow-600 ml-auto"}
        >
          {result ? "Реализация 4.B.1–4.B.5" : "Реализация 4.B.1"}
        </Badge>
      </div>

      {/* Pipeline Data Flow Indicator */}
      {projectId && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Пайплайн:</span>
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-[10px] font-bold">Блок 1 ←</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="text-[10px]">Блок 2</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="text-[10px]">Блок 3</Badge>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRunFullPipeline}
              disabled={isRunningPipeline || !isFormValid}
              className="text-xs h-7"
            >
              {isRunningPipeline ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Rocket className="h-3 w-3 mr-1" />
              )}
              Запустить пайплайн 1→2→3
            </Button>
          </div>
        </div>
      )}

      {/* === ФОРМА ВВОДА === */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ввод идеи</CardTitle>
          <CardDescription>
            Опишите идею игры и задайте параметры. Минимум — текст идеи и
            мотивации аудитории. Остальное — опционально.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Идея */}
          <div>
            <Label htmlFor="idea">
              Опишите идею игры (1–5 предложений){" "}
              <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="idea"
              value={form.idea}
              onChange={(e) => updateField("idea", e.target.value)}
              placeholder="Например: Roguelike про алхимика, который варит зелья и сражается с монстрами в процедурно генерируемых подземельях..."
              className="mt-1.5 min-h-[120px]"
            />
            <div className="flex justify-between mt-1">
              <p className="text-xs text-muted-foreground">
                Минимум 10 символов. Чем подробнее — тем точнее результат.
              </p>
              <p
                className={`text-xs ${ideaLength < 10 ? "text-red-500" : "text-muted-foreground"}`}
              >
                {ideaLength}/1000
              </p>
            </div>
          </div>

          {/* Жанр */}
          <div>
            <Label>Жанр</Label>
            <div className="flex items-center gap-4 mt-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="genreMode"
                  checked={form.genreMode === "auto"}
                  onChange={() => updateField("genreMode", "auto")}
                  className="accent-primary"
                />
                <span className="text-sm">Определить автоматически</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="genreMode"
                  checked={form.genreMode === "explicit"}
                  onChange={() => updateField("genreMode", "explicit")}
                  className="accent-primary"
                />
                <span className="text-sm">Указать вручную</span>
              </label>
            </div>
            {form.genreMode === "explicit" && (
              <Select
                value={form.genre}
                onValueChange={(v) => updateField("genre", v)}
              >
                <SelectTrigger className="mt-2">
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
            )}
          </div>

          {/* Целевая аудитория — мотивации по модели Йи */}
          <div>
            <Label>
              Целевая аудитория — мотивации (модель Йи){" "}
              <span className="text-red-500">*</span>
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              Выберите 1–3 мотивации. Они определят эстетические ценности игры.
            </p>
            <div className="mt-3 space-y-4">
              {YEE_MOTIVATIONS.map((cluster) => (
                <div key={cluster.cluster}>
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    {cluster.cluster}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {cluster.items.map((motivation) => {
                      const isSelected =
                        form.targetMotivations.includes(motivation.value);
                      const isDisabled =
                        !isSelected && form.targetMotivations.length >= 3;
                      return (
                        <Badge
                          key={motivation.value}
                          variant={isSelected ? "default" : "outline"}
                          className={`cursor-pointer transition-colors ${
                            isDisabled
                              ? "opacity-40 cursor-not-allowed"
                              : "hover:bg-primary/10"
                          }`}
                          onClick={() => {
                            if (!isDisabled) toggleMotivation(motivation.value);
                          }}
                        >
                          {motivation.label}
                          {isSelected && (
                            <X className="h-3 w-3 ml-1" />
                          )}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {form.targetMotivations.length === 0 && (
              <p className="text-xs text-red-500 mt-1">
                Выберите хотя бы одну мотивацию
              </p>
            )}
          </div>

          {/* Уровень опыта */}
          <div>
            <Label>Уровень опыта аудитории</Label>
            <Select
              value={form.experienceLevel}
              onValueChange={(v) => updateField("experienceLevel", v)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPERIENCE_LEVELS.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    {level.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Платформа */}
          <div>
            <Label>Платформа</Label>
            <div className="flex flex-wrap gap-3 mt-2">
              {PLATFORMS.map((platform) => (
                <label
                  key={platform.value}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={form.platforms.includes(platform.value)}
                    onCheckedChange={() => togglePlatform(platform.value)}
                  />
                  <span className="text-sm">{platform.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Референтные игры */}
          <div>
            <Label htmlFor="references">Референтные игры (через запятую)</Label>
            <Input
              id="references"
              value={form.referenceGames}
              onChange={(e) => updateField("referenceGames", e.target.value)}
              placeholder="Hades, Binding of Isaac, Slay the Spire"
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Игры, на которые вы ориентируетесь. Помогает определить USP и
              конкурентное позиционирование.
            </p>
          </div>

          {/* Расширенные настройки */}
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="px-0 text-muted-foreground"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? (
                <ChevronUp className="h-4 w-4 mr-1" />
              ) : (
                <ChevronDown className="h-4 w-4 mr-1" />
              )}
              Расширенные настройки
            </Button>

            {showAdvanced && (
              <div className="space-y-4 mt-3 pl-2 border-l-2 border-muted">
                {/* Бюджет / Команда */}
                <div>
                  <Label>Бюджет / Размер команды</Label>
                  <Select
                    value={form.budget}
                    onValueChange={(v) => updateField("budget", v)}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BUDGET_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Запрещённые механики */}
                <div>
                  <Label>Запрещённые механики (теги)</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Input
                      value={form.forbiddenInput}
                      onChange={(e) =>
                        updateField("forbiddenInput", e.target.value)
                      }
                      placeholder="Например: PvP, микротранзакции"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addForbiddenMechanic();
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addForbiddenMechanic}
                    >
                      Добавить
                    </Button>
                  </div>
                  {form.forbiddenMechanics.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {form.forbiddenMechanics.map((mechanic) => (
                        <Badge
                          key={mechanic}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => removeForbiddenMechanic(mechanic)}
                        >
                          {mechanic}
                          <X className="h-3 w-3 ml-1" />
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Механики, которые AI не должен предлагать. Нажмите Enter
                    или кнопку для добавления.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Кнопка генерации */}
          <Button
            className="w-full"
            size="lg"
            disabled={!isFormValid || isGenerating}
            onClick={handleGenerate}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Генерация концепции...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Сгенерировать концепцию
              </>
            )}
          </Button>

          {/* Индикатор текущего этапа */}
          {currentStage && (
            <div className="text-center text-sm text-muted-foreground animate-pulse">
              {currentStage}
            </div>
          )}
        </CardContent>
      </Card>

      {/* === ОШИБКА === */}
      {error && (
        <Card className="border-red-300 bg-red-50 dark:bg-red-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <p className="font-medium text-red-700 dark:text-red-400">
                  Ошибка генерации
                </p>
                <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                  {error}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* === РЕЗУЛЬТАТ ГЕНЕРАЦИИ === */}
      {result && (
        <div className="space-y-4">
          {/* 1. One-Pager Card */}
          <OnePagerCard result={result} />

          {/* 2. Эстетический профиль */}
          {result.aesthetic_profile && (
            <AestheticProfileView profile={result.aesthetic_profile} />
          )}

          {/* Профиль динамик (Этап 3) — keep existing display */}
          {result.dynamics_profile && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Профиль динамик</CardTitle>
                <CardDescription>
                  Алгоритм 3.1 Этап 3 — вывод динамик из эстетик
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Основные динамики
                  </p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {result.dynamics_profile.core_dynamics?.map((d, i) => (
                      <Badge key={i} variant="default">
                        {d}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Поддерживающие динамики
                  </p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {result.dynamics_profile.supporting_dynamics?.map(
                      (d, i) => (
                        <Badge key={i} variant="outline">
                          {d}
                        </Badge>
                      )
                    )}
                  </div>
                </div>
                {result.dynamics_profile.rationale && (
                  <p className="text-sm text-muted-foreground">
                    {result.dynamics_profile.rationale}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* 3. Набор механик */}
          {result.mechanic_set && (
            <MechanicSetView mechanicSet={result.mechanic_set} />
          )}

          {/* 4. Core Loop кандидаты */}
          {result.core_loop_candidates &&
            result.core_loop_candidates.length > 0 && (
              <CoreLoopCandidates
                candidates={result.core_loop_candidates}
                selectedIndex={selectedCoreLoopIndex}
                onSelect={setSelectedCoreLoopIndex}
              />
            )}

          {/* 5. USP кандидаты */}
          {result.usp_candidates && result.usp_candidates.length > 0 && (
            <USPCandidates
              candidates={result.usp_candidates}
              selectedIndex={selectedUSPIndex}
              onSelect={setSelectedUSPIndex}
            />
          )}

          {/* 6. Валидация */}
          {result.validation_report && (
            <ValidationReportView report={result.validation_report} />
          )}

          {/* === ИТОГОВЫЙ ВЫБОР === */}
          {(selectedCoreLoopIndex !== null || selectedUSPIndex !== null) && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Итоговый выбор
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedCoreLoopIndex !== null && result.core_loop_candidates[selectedCoreLoopIndex] && (
                    <div className="rounded-md border p-3 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Core Loop</p>
                      <p className="text-sm font-semibold">
                        {result.core_loop_candidates[selectedCoreLoopIndex].name as string || `Вариант ${selectedCoreLoopIndex + 1}`}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {LOOP_TYPE_LABELS[(result.core_loop_candidates[selectedCoreLoopIndex].loop_type as string) || "hybrid"] || "Гибрид"}
                      </Badge>
                    </div>
                  )}
                  {selectedUSPIndex !== null && result.usp_candidates[selectedUSPIndex] && (
                    <div className="rounded-md border p-3 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">USP</p>
                      <p className="text-sm font-semibold">
                        {(result.usp_candidates[selectedUSPIndex].usp as string) || `Вариант ${selectedUSPIndex + 1}`}
                      </p>
                    </div>
                  )}
                </div>
                <Button onClick={handleSaveSelection} className="w-full sm:w-auto">
                  <Check className="h-4 w-4 mr-2" />
                  Сохранить выбор
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Пустое состояние */}
      {!result && !isGenerating && !error && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-muted-foreground">
              Результат генерации
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>
                Заполните форму и нажмите «Сгенерировать концепцию»
              </p>
              <p className="text-xs mt-1">
                Backend-реализация: Этапы 1–3 (4.B.2) &bull; Этапы 4–5
                (4.B.3) &bull; Этапы 6–7 (4.B.4) &bull; UI (4.B.5)
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
