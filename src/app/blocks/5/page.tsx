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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TrendingUp,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Zap,
  Shield,
  Target,
  Brain,
  BarChart3,
  Activity,
  Lightbulb,
  Wrench,
  TrendingDown,
  CircleDot,
  Layers,
  RotateCcw,
  Flame,
  Gauge,
  Coins,
  Milestone,
  GitBranch,
  Sparkles,
  Package,
  Workflow,
  Stethoscope,
  LineChart as LineChartIcon,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { usePipeline } from "@/hooks/use-pipeline";

// ============================================================
// Constants
// ============================================================

import { API_BASE_URL, apiRoutes } from "@/config/api";

const GENRES = [
  { value: "action", label: "Action" },
  { value: "rpg", label: "RPG" },
  { value: "strategy", label: "Strategy" },
  { value: "shooter", label: "Shooter" },
  { value: "fighting", label: "Fighting" },
  { value: "moba", label: "MOBA" },
  { value: "rts", label: "RTS" },
  { value: "tbs", label: "TBS" },
  { value: "sandbox", label: "Sandbox" },
  { value: "roguelike", label: "Roguelike" },
];

const PROGRESSION_TYPES = [
  { value: "linear", label: "Linear" },
  { value: "exponential", label: "Exponential" },
  { value: "diminishing", label: "Diminishing" },
  { value: "s_curve", label: "S-Curve" },
  { value: "intermittent", label: "Intermittent" },
  { value: "custom", label: "Custom" },
];

const MONETIZATION_MODELS = [
  { value: "f2p", label: "Free-to-Play" },
  { value: "b2p", label: "Buy-to-Play" },
  { value: "subscription", label: "Subscription" },
  { value: "p2w", label: "Pay-to-Win" },
  { value: "cosmetic", label: "Cosmetic" },
  { value: "hybrid", label: "Hybrid" },
];

const PACING_OPTIONS = [
  { value: "relaxed", label: "Расслабленный" },
  { value: "balanced", label: "Сбалансированный" },
  { value: "intense", label: "Интенсивный" },
];

const OPENNESS_OPTIONS = [
  { value: "open", label: "Открытая" },
  { value: "closed", label: "Закрытая" },
  { value: "mixed", label: "Смешанная" },
];

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
  warning: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  info: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
};

const ECONOMIC_TYPE_COLORS: Record<string, string> = {
  Engine: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300",
  Economy: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-300",
  Ecology: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300",
};

const CURVE_COLORS = ["#22c55e", "#ef4444", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6"];

// ============================================================
// Types
// ============================================================

interface ProgressionDesignResponse {
  id: string;
  macro_model: {
    total_levels: number;
    target_duration: number;
    progression_type: string;
    content_requirements: string;
    emergence_ratio: number;
    lock_key_model: string;
    monetization_model: string;
    [key: string]: unknown;
  };
  tier_model: {
    tiers: Array<{
      index: number;
      level_range: [number, number];
      level_count: number;
      scale: string;
      dominant_mechanic: string;
      balance_type: string;
      difficulty_curve: string;
      resource_state: string;
      transition_trigger: string;
    }>;
    num_tiers: number;
    total_levels: number;
    transition_map: Record<string, string>;
  };
  curves: {
    xp_to_level: { type: string; formula: string; parameters: Record<string, number>; points?: number[] };
    level_to_power: { type: string; formula: string; parameters: Record<string, number>; points?: number[] };
    level_to_cost: { type: string; formula: string; parameters: Record<string, number>; points?: number[] };
    difficulty: { type: string; formula: string; parameters: Record<string, number>; points?: number[] };
  };
  content_plan: {
    tier_plans: Array<{
      tier_index: number;
      enemies: number;
      rewards: number;
      abilities: number;
      milestones: number;
      pacing: string;
    }>;
    unlock_tree: Array<{
      level: number;
      unlock_name: string;
      unlock_type: string;
      description: string;
    }>;
    perceived_difficulty_table: Array<{
      level: number;
      target_perceived_difficulty: number;
      recommended_enemy_power: number;
      is_tier_boundary: boolean;
    }>;
  };
  validation: {
    issues: Array<{ severity: string; description: string }>;
    suggestions: string[];
    critical_count: number;
    warning_count: number;
    info_count: number;
    overall_score: number;
    checks: Record<string, boolean>;
  };
  summary: Record<string, string>;
  stages_completed: number[];
  latency_ms: number;
}

interface EconomyDesignResponse {
  id: string;
  inventory: {
    resources: Array<{
      name: string;
      resource_class: string;
      resource_type: string;
      initial_value: number;
      bounds: { min: number; max: number };
      is_consumable: boolean;
      is_catalytic: boolean;
      is_anchor: boolean;
    }>;
    anchor: string;
    core_count: number;
    subsidiary_count: number;
  };
  classification: {
    type: string;
    sub_type: string;
    dominant_loop: string;
    interaction_type: string;
    openness: string;
    pricing_type: string;
    risk_level: string;
    [key: string]: unknown;
  };
  machinations_model: {
    nodes: Array<{ id: string; name: string; node_type: string; initial_value: number; capacity: number | null; rate: number | null }>;
    resource_flows: Array<{ source_id: string; target_id: string; resource: string; rate: number }>;
    state_connections: Array<{ source_id: string; target_id: string; modifier: string; formula: string }>;
    feedback_loops: Array<{ nodes: string[]; loop_type: string; strength: number; description: string }>;
    economic_type: string;
    structural_patterns: string[];
    [key: string]: unknown;
  };
  conversion_graph: {
    chains: Array<{ inputs: string[]; outputs: string[]; profitability: number; tier: number; risk: string }>;
    avg_profitability: number;
    tier_coverage: Record<string, boolean>;
    warnings: string[];
  };
  diagnostics: {
    pathologies: Array<{ name: string; severity: string; description: string; affected_resources: string[]; correction: string }>;
    faucet_drain_ratios: Record<string, { faucet: number; drain: number; ratio: number }>;
    overall_severity: string;
  };
  balance: {
    adjustments: Array<{ resource: string; action: string; current_rate: number; new_rate: number; reason: string }>;
    phase: string;
    target_ratio: number;
  };
  sim_result: {
    config: Record<string, unknown>;
    aggregated: {
      avg_resource_curves: Record<string, number[]>;
      resource_ranges: Record<string, { min: number; max: number }>;
      runaway_frequency: number;
      stall_frequency: number;
      stability_index: number;
      build_gap: number;
    };
    quality: {
      resources_in_bounds: boolean;
      progression_pacing_ok: boolean;
      no_runaway_for_minmaxer: boolean;
      no_stall_for_casual: boolean;
      build_gap_acceptable: boolean;
      economy_stable: boolean;
      overall_pass: boolean;
      critical_issues: string[];
    };
    snapshots_count: number;
  };
  stages_completed: number[];
  latency_ms: number;
}

// ============================================================
// Sub-components — Progression
// ============================================================

// --- MacroParamsTab ---
function MacroParamsTab({ result }: { result: ProgressionDesignResponse | null }) {
  if (!result?.macro_model) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Target className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Спроектируйте прогрессию для просмотра макро-параметров</p>
          <p className="text-xs mt-1">Общие параметры модели прогрессии</p>
        </CardContent>
      </Card>
    );
  }

  const macro = result.macro_model;
  const entries: Array<{ key: string; label: string; value: unknown }> = [
    { key: "total_levels", label: "Всего уровней", value: macro.total_levels },
    { key: "target_duration", label: "Целевая длительность (ч)", value: macro.target_duration },
    { key: "progression_type", label: "Тип прогрессии", value: macro.progression_type },
    { key: "content_requirements", label: "Требования к контенту", value: macro.content_requirements },
    { key: "emergence_ratio", label: "Коэффициент эмергентности", value: macro.emergence_ratio },
    { key: "lock_key_model", label: "Модель Lock-Key", value: macro.lock_key_model },
    { key: "monetization_model", label: "Модель монетизации", value: macro.monetization_model },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Макро-параметры прогрессии
          </CardTitle>
          <CardDescription>Ключевые параметры модели прогрессии</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {entries.map((entry) => (
              <div key={entry.key} className="flex items-center justify-between rounded-md border p-3">
                <span className="text-xs text-muted-foreground">{entry.label}</span>
                <Badge variant="outline" className="text-xs font-semibold">
                  {entry.value != null ? String(entry.value) : "—"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- TiersTab ---
function TiersTab({ result }: { result: ProgressionDesignResponse | null }) {
  if (!result?.tier_model) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Milestone className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Спроектируйте прогрессию для просмотра этапов</p>
          <p className="text-xs mt-1">Структура этапов и переходов</p>
        </CardContent>
      </Card>
    );
  }

  const tiers = result.tier_model.tiers || [];
  const transitionMap = result.tier_model.transition_map || {};

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Milestone className="h-5 w-5 text-primary" />
            Этапы прогрессии ({tiers.length})
          </CardTitle>
          <CardDescription>Всего уровней: {result.tier_model.total_levels}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Этап</TableHead>
                  <TableHead>Диапазон уровней</TableHead>
                  <TableHead>Масштаб</TableHead>
                  <TableHead>Доминантная механика</TableHead>
                  <TableHead>Тип баланса</TableHead>
                  <TableHead>Кривая сложности</TableHead>
                  <TableHead>Состояние ресурсов</TableHead>
                  <TableHead>Триггер перехода</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiers.map((tier, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-sm">{tier.index}</TableCell>
                    <TableCell className="text-sm">
                      {tier.level_range ? `${tier.level_range[0]}–${tier.level_range[1]}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      <Badge variant="outline" className="text-xs">{tier.scale || "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{tier.dominant_mechanic || "—"}</TableCell>
                    <TableCell className="text-sm">{tier.balance_type || "—"}</TableCell>
                    <TableCell className="text-sm">{tier.difficulty_curve || "—"}</TableCell>
                    <TableCell className="text-sm">{tier.resource_state || "—"}</TableCell>
                    <TableCell className="text-sm">{tier.transition_trigger || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Transition Map */}
      {Object.keys(transitionMap).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-primary" />
              Карта переходов
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(transitionMap).map(([from, to]) => (
                <div key={from} className="flex items-center gap-1.5 text-xs rounded-md border p-2">
                  <Badge variant="outline" className="text-[10px]">{from}</Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="outline" className="text-[10px]">{to}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// --- CurvesTab ---
function CurvesTab({ result }: { result: ProgressionDesignResponse | null }) {
  if (!result?.curves) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Спроектируйте прогрессию для просмотра кривых</p>
          <p className="text-xs mt-1">XP→Level, Level→Power, Level→Cost, Difficulty</p>
        </CardContent>
      </Card>
    );
  }

  const curves = result.curves;
  const curveEntries = [
    { key: "xp_to_level", label: "XP → Уровень", data: curves.xp_to_level },
    { key: "level_to_power", label: "Уровень → Мощь", data: curves.level_to_power },
    { key: "level_to_cost", label: "Уровень → Стоимость", data: curves.level_to_cost },
    { key: "difficulty", label: "Сложность", data: curves.difficulty },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {curveEntries.map((entry) => {
          const curve = entry.data;
          const points = curve?.points || [];
          const chartData = points.map((val, i) => ({ level: i + 1, value: val }));
          const params = curve?.parameters || {};

          return (
            <Card key={entry.key}>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  {entry.label}
                </CardTitle>
                <CardDescription className="text-xs">
                  {curve?.type && <Badge variant="outline" className="text-[10px] mr-1">{curve.type}</Badge>}
                  {curve?.formula && <span className="font-mono text-[10px]">{curve.formula}</span>}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {chartData.length > 0 && (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <XAxis dataKey="level" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(value: number) => [value.toFixed(2), entry.label]} />
                        <Line type="monotone" dataKey="value" stroke="#22c55e" dot={false} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {Object.keys(params).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(params).map(([k, v]) => (
                      <Badge key={k} variant="secondary" className="text-[10px]">
                        {k}: {typeof v === "number" ? v.toFixed(4) : String(v)}
                      </Badge>
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

// --- ContentPlanTab ---
function ContentPlanTab({ result }: { result: ProgressionDesignResponse | null }) {
  if (!result?.content_plan) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Спроектируйте прогрессию для просмотра контент-плана</p>
          <p className="text-xs mt-1">Дерево разблокировок и воспринимаемая сложность</p>
        </CardContent>
      </Card>
    );
  }

  const cp = result.content_plan;
  const tierPlans = cp.tier_plans || [];
  const unlockTree = cp.unlock_tree || [];
  const difficultyTable = cp.perceived_difficulty_table || [];

  // Chart data for perceived difficulty
  const difficultyChartData = difficultyTable.map((d) => ({
    level: d.level,
    difficulty: d.target_perceived_difficulty,
    enemyPower: d.recommended_enemy_power,
  }));

  return (
    <div className="space-y-4">
      {/* Tier Plans */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Планы по этапам
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Этап</TableHead>
                  <TableHead className="text-right">Враги</TableHead>
                  <TableHead className="text-right">Награды</TableHead>
                  <TableHead className="text-right">Способности</TableHead>
                  <TableHead className="text-right">Вехи</TableHead>
                  <TableHead>Темп</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tierPlans.map((tp, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-sm">{tp.tier_index}</TableCell>
                    <TableCell className="text-right text-sm">{tp.enemies}</TableCell>
                    <TableCell className="text-right text-sm">{tp.rewards}</TableCell>
                    <TableCell className="text-right text-sm">{tp.abilities}</TableCell>
                    <TableCell className="text-right text-sm">{tp.milestones}</TableCell>
                    <TableCell className="text-sm">
                      <Badge variant="outline" className="text-xs">{tp.pacing || "—"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Unlock Tree */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Дерево разблокировок ({unlockTree.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-80 overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Уровень</TableHead>
                  <TableHead className="w-24">Тип</TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead>Описание</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unlockTree.map((unlock, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-sm">{unlock.level}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{unlock.unlock_type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{unlock.unlock_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{unlock.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Perceived Difficulty Chart */}
      {difficultyChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Воспринимаемая сложность
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={difficultyChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <XAxis dataKey="level" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="difficulty" stroke="#22c55e" name="Сложность" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="enemyPower" stroke="#ef4444" name="Мощь врагов" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// --- ValidationTab ---
function ValidationTab({ result }: { result: ProgressionDesignResponse | null }) {
  if (!result?.validation) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Shield className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Спроектируйте прогрессию для просмотра валидации</p>
          <p className="text-xs mt-1">Проверки качества и рекомендации</p>
        </CardContent>
      </Card>
    );
  }

  const v = result.validation;
  const checks = v.checks || {};
  const checkLabels: Record<string, string> = {
    no_grind: "Нет гринда",
    no_walls: "Нет стен",
    no_empty_levels: "Нет пустых уровней",
    no_runaway: "Нет убегающей сложности",
    no_build_gaps: "Нет разрывов в развитии",
    aesthetic_alignment: "Эстетическое соответствие",
  };

  const issues = v.issues || [];
  const suggestions = v.suggestions || [];

  return (
    <div className="space-y-4">
      {/* Overall Score */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="text-center flex-1">
              <p className="text-xs text-muted-foreground mb-1">Общая оценка</p>
              <p className="text-3xl font-bold">{typeof v.overall_score === "number" ? (v.overall_score * 100).toFixed(0) + "%" : "—"}</p>
              <Progress value={typeof v.overall_score === "number" ? v.overall_score * 100 : 0} className="h-2 mt-2" />
            </div>
            <Separator orientation="vertical" className="h-16" />
            <div className="flex gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Critical</p>
                <p className="text-lg font-bold text-red-600 dark:text-red-400">{v.critical_count || 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Warning</p>
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{v.warning_count || 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Info</p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{v.info_count || 0}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Checks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Проверки
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(checks).map(([key, passed]) => (
            <div key={key} className="flex items-center gap-2 text-xs">
              {passed ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
              )}
              <span className={passed ? "" : "text-red-600 dark:text-red-400"}>
                {checkLabels[key] || key}
              </span>
            </div>
          ))}
          {Object.keys(checks).length === 0 && (
            <p className="text-xs text-muted-foreground">Нет данных о проверках</p>
          )}
        </CardContent>
      </Card>

      {/* Issues */}
      {issues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Проблемы ({issues.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 max-h-48 overflow-y-auto">
            {issues.map((issue, i) => (
              <div key={i} className={`flex items-start gap-2 text-xs rounded-md border p-2 ${SEVERITY_COLORS[issue.severity] || SEVERITY_COLORS.info}`}>
                {issue.severity === "critical" ? (
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                ) : issue.severity === "warning" ? (
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                ) : (
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                )}
                <span>{issue.description}</span>
                <Badge variant="outline" className="text-[10px] ml-auto shrink-0">{issue.severity}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-blue-500" />
              Рекомендации
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 max-h-40 overflow-y-auto">
            {suggestions.map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-xs rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-2">
                <Info className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                <span>{s}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// Sub-components — Economy
// ============================================================

// Node type icon helper (same as Block 4)
function NodeTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "pool":
    case "resource":
      return <CircleDot className="h-4 w-4 text-blue-500" />;
    case "source":
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case "drain":
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    case "converter":
      return <RotateCcw className="h-4 w-4 text-amber-500" />;
    case "gate":
      return <Shield className="h-4 w-4 text-purple-500" />;
    case "trigger":
      return <Zap className="h-4 w-4 text-yellow-500" />;
    case "end_condition":
      return <Target className="h-4 w-4 text-rose-500" />;
    default:
      return <CircleDot className="h-4 w-4 text-muted-foreground" />;
  }
}

// --- ResourcesTab ---
function ResourcesTab({ result }: { result: EconomyDesignResponse | null }) {
  if (!result?.inventory) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Coins className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Спроектируйте экономику для просмотра ресурсов</p>
          <p className="text-xs mt-1">Инвентарь ресурсов и их свойства</p>
        </CardContent>
      </Card>
    );
  }

  const inv = result.inventory;
  const resources = inv.resources || [];
  const coreResources = resources.filter((r) => r.resource_class === "core");
  const subsidiaryResources = resources.filter((r) => r.resource_class !== "core");

  const renderResourceTable = (items: typeof resources, title: string) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          {title === "Core" ? <Sparkles className="h-4 w-4 text-primary" /> : <Package className="h-4 w-4 text-muted-foreground" />}
          {title} ресурсы ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Имя</TableHead>
                <TableHead>Класс</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead className="text-right">Нач. значение</TableHead>
                <TableHead>Границы</TableHead>
                <TableHead className="text-center">Расходуемый</TableHead>
                <TableHead className="text-center">Катализатор</TableHead>
                <TableHead className="text-center">Якорь</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-sm">{r.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">{r.resource_class}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{r.resource_type}</TableCell>
                  <TableCell className="text-right text-sm">{r.initial_value}</TableCell>
                  <TableCell className="text-xs">
                    [{r.bounds?.min ?? "—"}, {r.bounds?.max ?? "—"}]
                  </TableCell>
                  <TableCell className="text-center">
                    {r.is_consumable ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />}
                  </TableCell>
                  <TableCell className="text-center">
                    {r.is_catalytic ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />}
                  </TableCell>
                  <TableCell className="text-center">
                    {r.is_anchor ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Якоревой ресурс</p>
            <Badge variant="outline" className="text-sm font-semibold">{inv.anchor || "—"}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex justify-center gap-6">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Core</p>
                <p className="text-lg font-bold">{inv.core_count ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Subsidiary</p>
                <p className="text-lg font-bold">{inv.subsidiary_count ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      {coreResources.length > 0 && renderResourceTable(coreResources, "Core")}
      {subsidiaryResources.length > 0 && renderResourceTable(subsidiaryResources, "Дополнительные")}
    </div>
  );
}

// --- ClassificationTab ---
function ClassificationTab({ result }: { result: EconomyDesignResponse | null }) {
  if (!result?.classification) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Brain className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Спроектируйте экономику для просмотра классификации</p>
          <p className="text-xs mt-1">Тип экономики и её свойства</p>
        </CardContent>
      </Card>
    );
  }

  const cls = result.classification;
  const fields: Array<{ key: string; label: string; value: unknown; isBadge?: boolean }> = [
    { key: "type", label: "Экономический тип", value: cls.type, isBadge: true },
    { key: "sub_type", label: "Подтип", value: cls.sub_type },
    { key: "dominant_loop", label: "Доминантный цикл", value: cls.dominant_loop },
    { key: "interaction_type", label: "Тип взаимодействия", value: cls.interaction_type },
    { key: "openness", label: "Открытость", value: cls.openness },
    { key: "pricing_type", label: "Тип ценообразования", value: cls.pricing_type },
    { key: "risk_level", label: "Уровень риска", value: cls.risk_level },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Классификация экономики
          </CardTitle>
          <CardDescription>Тип и характеристики экономической системы</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fields.map((field) => {
              const typeColor = field.isBadge && ECONOMIC_TYPE_COLORS[String(field.value)] 
                ? ECONOMIC_TYPE_COLORS[String(field.value)]
                : "";
              return (
                <div key={field.key} className="flex items-center justify-between rounded-md border p-3">
                  <span className="text-xs text-muted-foreground">{field.label}</span>
                  {typeColor ? (
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${typeColor}`}>
                      {String(field.value ?? "—")}
                    </span>
                  ) : (
                    <Badge variant="outline" className="text-xs font-semibold">{String(field.value ?? "—")}</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- MachinationsEconomyTab ---
function MachinationsEconomyTab({ result }: { result: EconomyDesignResponse | null }) {
  if (!result?.machinations_model) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Спроектируйте экономику для просмотра Machinations</p>
          <p className="text-xs mt-1">Граф ресурсов, циклы обратной связи и паттерны</p>
        </CardContent>
      </Card>
    );
  }

  const mach = result.machinations_model;
  const nodes = mach.nodes || [];
  const flows = mach.resource_flows || [];
  const stateConns = mach.state_connections || [];
  const feedbackLoops = mach.feedback_loops || [];
  const structuralPatterns = mach.structural_patterns || [];

  return (
    <div className="space-y-4">
      {/* Economic Type */}
      {mach.economic_type && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Экономический тип Machinations:</span>
              <Badge className={`text-xs ${ECONOMIC_TYPE_COLORS[mach.economic_type] || "bg-gray-100 text-gray-800"}`}>
                {mach.economic_type}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Nodes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <CircleDot className="h-4 w-4 text-primary" />
            Узлы графа ({nodes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {nodes.map((node, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border p-2">
                <NodeTypeIcon type={node.node_type} />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{node.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {node.node_type}
                    {node.initial_value != null ? ` | ${node.initial_value}` : ""}
                    {node.capacity != null ? ` / ${node.capacity}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Resource Flows */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-primary" />
            Потоки ресурсов ({flows.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {flows.map((flow, i) => (
              <div key={i} className="flex items-center gap-2 text-xs rounded-md border p-2">
                <Badge variant="outline" className="text-[10px] shrink-0">{flow.source_id}</Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <Badge variant="outline" className="text-[10px] shrink-0">{flow.target_id}</Badge>
                <span className="text-[10px] text-muted-foreground">{flow.resource}</span>
                <Badge variant="secondary" className="text-[10px] ml-auto">rate: {flow.rate}</Badge>
              </div>
            ))}
            {flows.length === 0 && <p className="text-xs text-muted-foreground">Нет потоков ресурсов</p>}
          </div>
        </CardContent>
      </Card>

      {/* State Connections */}
      {stateConns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Связи состояний ({stateConns.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {stateConns.map((conn, i) => (
                <div key={i} className="flex items-center gap-2 text-xs rounded-md border border-dashed p-2">
                  <Badge variant="outline" className="text-[10px]">{conn.source_id}</Badge>
                  <span className="text-muted-foreground">--{conn.modifier}--&gt;</span>
                  <Badge variant="outline" className="text-[10px]">{conn.target_id}</Badge>
                  {conn.formula && <span className="text-[10px] text-muted-foreground ml-auto">{conn.formula}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feedback Loops */}
      {feedbackLoops.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-primary" />
              Циклы обратной связи ({feedbackLoops.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {feedbackLoops.map((loop, i) => {
                const isPositive = loop.loop_type === "positive" || loop.loop_type === "reinforcing";
                return (
                  <div key={i} className="flex items-center gap-2 text-xs rounded-md border p-2">
                    <Badge className={`text-[10px] ${isPositive ? "bg-green-600 text-white" : "bg-blue-600 text-white"}`}>
                      {isPositive ? "Reinforcing" : "Balancing"}
                    </Badge>
                    <span className="text-muted-foreground">
                      {(loop.nodes || []).join(" → ")}
                      {(loop.nodes || []).length > 0 && ` → ${loop.nodes[0]}`}
                    </span>
                    {loop.strength != null && (
                      <Badge variant="outline" className="text-[10px] ml-auto">
                        Strength: {loop.strength}
                      </Badge>
                    )}
                    {loop.description && (
                      <span className="text-[10px] text-muted-foreground ml-2">({loop.description})</span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Structural Patterns */}
      {structuralPatterns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Workflow className="h-4 w-4 text-primary" />
              Структурные паттерны
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {structuralPatterns.map((p, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{p}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// --- DiagnosticsTab ---
function DiagnosticsTab({ result }: { result: EconomyDesignResponse | null }) {
  if (!result?.diagnostics) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Stethoscope className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Спроектируйте экономику для просмотра диагностики</p>
          <p className="text-xs mt-1">Патологии и соотношения кранов/стоков</p>
        </CardContent>
      </Card>
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
}

// --- SimulationEconomyTab ---
function SimulationEconomyTab({ result }: { result: EconomyDesignResponse | null }) {
  if (!result?.sim_result) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <LineChartIcon className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Спроектируйте экономику для просмотра симуляции</p>
          <p className="text-xs mt-1">Кривые ресурсов, стабильность и качество</p>
        </CardContent>
      </Card>
    );
  }

  const sim = result.sim_result;
  const aggregated = sim.aggregated || {
    avg_resource_curves: {},
    resource_ranges: {},
    runaway_frequency: 0,
    stall_frequency: 0,
    stability_index: 0,
    build_gap: 0,
  };
  const quality = sim.quality || {
    resources_in_bounds: false,
    progression_pacing_ok: false,
    no_runaway_for_minmaxer: false,
    no_stall_for_casual: false,
    build_gap_acceptable: false,
    economy_stable: false,
    overall_pass: false,
    critical_issues: [],
  };

  const resourceCurves = aggregated.avg_resource_curves || {};
  const curveNames = Object.keys(resourceCurves);
  const maxLen = Math.max(...curveNames.map((n) => (resourceCurves[n] || []).length), 1);
  const curveChartData = Array.from({ length: maxLen }, (_, i) => {
    const point: Record<string, number | string> = { tick: i };
    curveNames.forEach((name) => {
      const arr = resourceCurves[name] || [];
      point[name] = arr[i] ?? 0;
    });
    return point;
  });

  const qualityChecks = [
    { key: "resources_in_bounds", label: "Ресурсы в границах" },
    { key: "progression_pacing_ok", label: "Темп прогрессии ОК" },
    { key: "no_runaway_for_minmaxer", label: "Нет убегания у минмаксера" },
    { key: "no_stall_for_casual", label: "Нет стагнации у казуала" },
    { key: "build_gap_acceptable", label: "Build Gap допустим" },
    { key: "economy_stable", label: "Экономика стабильна" },
  ];

  return (
    <div className="space-y-4">
      {/* Resource Curves */}
      {curveNames.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Кривые ресурсов
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={curveChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <XAxis dataKey="tick" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  {curveNames.map((name, i) => (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={CURVE_COLORS[i % CURVE_COLORS.length]}
                      dot={false}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quality Assessment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Оценка качества
          </CardTitle>
          <CardDescription className="text-xs">
            {quality.overall_pass ? "Все проверки пройдены" : "Некоторые проверки не пройдены"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {qualityChecks.map((check) => {
            const passed = quality[check.key as keyof typeof quality] as boolean;
            return (
              <div key={check.key} className="flex items-center gap-2 text-xs">
                {passed ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                )}
                <span className={passed ? "" : "text-red-600 dark:text-red-400"}>{check.label}</span>
              </div>
            );
          })}
          {(quality.critical_issues || []).length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs font-medium text-red-600 dark:text-red-400">Критические проблемы</p>
              {(quality.critical_issues || []).map((issue, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{issue}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stability & Build Gap */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Индекс стабильности</p>
            <p className="text-2xl font-bold">{typeof aggregated.stability_index === "number" ? aggregated.stability_index.toFixed(3) : "—"}</p>
            <Progress
              value={typeof aggregated.stability_index === "number" ? aggregated.stability_index * 100 : 0}
              className="h-2 mt-2"
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Build Gap</p>
            <p className="text-2xl font-bold">{typeof aggregated.build_gap === "number" ? aggregated.build_gap.toFixed(3) : "—"}</p>
            <Progress
              value={typeof aggregated.build_gap === "number" ? Math.min(aggregated.build_gap * 100, 100) : 0}
              className="h-2 mt-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Runaway & Stall frequencies */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Частота убегания</p>
            <p className="text-lg font-bold text-red-600 dark:text-red-400">
              {typeof aggregated.runaway_frequency === "number" ? (aggregated.runaway_frequency * 100).toFixed(1) + "%" : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Частота стагнации</p>
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
              {typeof aggregated.stall_frequency === "number" ? (aggregated.stall_frequency * 100).toFixed(1) + "%" : "—"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function Block5Page() {
  const { apiFetch } = useAuth();
  const { toast } = useToast();

  // --- Pipeline ---
  const projectId =
    typeof window !== "undefined"
      ? localStorage.getItem("gidede_active_project")
      : null;
  const pipeline = usePipeline(projectId);

  // --- Top-level tab ---
  const [mainTab, setMainTab] = useState("progression");

  // --- Progression form state ---
  const [progGenre, setProgGenre] = useState("rpg");
  const [progDuration, setProgDuration] = useState(40);
  const [progLevels, setProgLevels] = useState(50);
  const [progType, setProgType] = useState("exponential");
  const [progMonetization, setProgMonetization] = useState("f2p");
  const [progPacing, setProgPacing] = useState("balanced");

  // --- Economy form state ---
  const [ecoGenre, setEcoGenre] = useState("rpg");
  const [ecoMonetization, setEcoMonetization] = useState("f2p");
  const [ecoOpenness, setEcoOpenness] = useState("mixed");

  // --- Result state ---
  const [isProgLoading, setIsProgLoading] = useState(false);
  const [isEcoLoading, setIsEcoLoading] = useState(false);
  const [progResult, setProgResult] = useState<ProgressionDesignResponse | null>(null);
  const [ecoResult, setEcoResult] = useState<EconomyDesignResponse | null>(null);
  const [progError, setProgError] = useState<string | null>(null);
  const [ecoError, setEcoError] = useState<string | null>(null);

  // --- Progression sub-tab ---
  const [progSubTab, setProgSubTab] = useState("macro");
  // --- Economy sub-tab ---
  const [ecoSubTab, setEcoSubTab] = useState("resources");

  // --- Run Progression Design ---
  const handleRunProgression = useCallback(async () => {
    setIsProgLoading(true);
    setProgError(null);

    try {
      const payload = {
        genre: progGenre,
        target_duration: progDuration,
        target_levels: progLevels,
        progression_type: progType,
        monetization_model: progMonetization,
        pacing: progPacing,
        project_id: projectId || undefined,
      };

      const data = await apiFetch<ProgressionDesignResponse>("/progression/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setProgResult(data);

      if (projectId) {
        pipeline.notifyUpdated(5, {
          progression_id: data.id,
          progression_type: progType,
          overall_score: data.validation?.overall_score,
        });
      }

      toast({
        title: "Прогрессия спроектирована",
        description: `Завершено за ${data.latency_ms || 0} мс`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Неизвестная ошибка";
      setProgError(msg);
      toast({
        title: "Ошибка проектирования прогрессии",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsProgLoading(false);
    }
  }, [progGenre, progDuration, progLevels, progType, progMonetization, progPacing, projectId, apiFetch, pipeline, toast]);

  // --- Run Economy Design ---
  const handleRunEconomy = useCallback(async () => {
    setIsEcoLoading(true);
    setEcoError(null);

    try {
      const payload = {
        genre: ecoGenre,
        monetization_type: ecoMonetization,
        openness: ecoOpenness,
        project_id: projectId || undefined,
      };

      const data = await apiFetch<EconomyDesignResponse>("/economy/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setEcoResult(data);

      if (projectId) {
        pipeline.notifyUpdated(5, {
          economy_id: data.id,
          economic_type: data.classification?.type,
          overall_severity: data.diagnostics?.overall_severity,
        });
      }

      toast({
        title: "Экономика спроектирована",
        description: `Завершено за ${data.latency_ms || 0} мс`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Неизвестная ошибка";
      setEcoError(msg);
      toast({
        title: "Ошибка проектирования экономики",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsEcoLoading(false);
    }
  }, [ecoGenre, ecoMonetization, ecoOpenness, projectId, apiFetch, pipeline, toast]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <TrendingUp className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Экономика и прогрессия</h1>
          <p className="text-sm text-muted-foreground">Блок 5 • Алгоритмы 3.5–3.6</p>
        </div>
        {(progResult || ecoResult) && (
          <Badge variant="outline" className="ml-auto text-xs border-green-300 text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3 mr-1" />Спроектировано
          </Badge>
        )}
      </div>

      {/* Main Tabs */}
      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="progression" className="flex items-center gap-1.5">
            <Milestone className="h-4 w-4" />
            Прогрессия
          </TabsTrigger>
          <TabsTrigger value="economy" className="flex items-center gap-1.5">
            <Coins className="h-4 w-4" />
            Экономика
          </TabsTrigger>
        </TabsList>

        {/* ====================== PROGRESSION TAB ====================== */}
        <TabsContent value="progression" className="space-y-6 mt-4">
          {/* Input Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Milestone className="h-5 w-5 text-primary" />
                Параметры прогрессии
              </CardTitle>
              <CardDescription>Настройте параметры для проектирования прогрессии</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Genre */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Жанр</Label>
                  <Select value={progGenre} onValueChange={setProgGenre}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GENRES.map((g) => (
                        <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Target Duration */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Целевая длительность (часы)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={progDuration}
                    onChange={(e) => setProgDuration(Number(e.target.value) || 40)}
                    className="h-9 text-sm"
                  />
                </div>

                {/* Target Levels */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Целевые уровни</Label>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    value={progLevels}
                    onChange={(e) => setProgLevels(Number(e.target.value) || 50)}
                    className="h-9 text-sm"
                  />
                </div>

                {/* Progression Type */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Тип прогрессии</Label>
                  <Select value={progType} onValueChange={setProgType}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROGRESSION_TYPES.map((pt) => (
                        <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Monetization */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Модель монетизации</Label>
                  <Select value={progMonetization} onValueChange={setProgMonetization}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONETIZATION_MODELS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Pacing */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Темп</Label>
                  <Select value={progPacing} onValueChange={setProgPacing}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PACING_OPTIONS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Run button */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleRunProgression}
                  disabled={isProgLoading}
                  className="gap-1.5"
                >
                  {isProgLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  Спроектировать прогрессию
                </Button>
                {progResult?.latency_ms != null && !isProgLoading && (
                  <span className="text-xs text-muted-foreground">
                    Последний запуск: {progResult.latency_ms} мс
                  </span>
                )}
              </div>

              {/* Error */}
              {progError && (
                <div className="flex items-start gap-2 text-xs rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-3">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <span className="text-red-700 dark:text-red-300">{progError}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results */}
          {progResult && (
            <Tabs value={progSubTab} onValueChange={setProgSubTab}>
              <TabsList>
                <TabsTrigger value="macro">Макро-параметры</TabsTrigger>
                <TabsTrigger value="tiers">Этапы</TabsTrigger>
                <TabsTrigger value="curves">Кривые</TabsTrigger>
                <TabsTrigger value="content">Контент-план</TabsTrigger>
                <TabsTrigger value="validation">Валидация</TabsTrigger>
              </TabsList>
              <TabsContent value="macro" className="mt-4">
                <MacroParamsTab result={progResult} />
              </TabsContent>
              <TabsContent value="tiers" className="mt-4">
                <TiersTab result={progResult} />
              </TabsContent>
              <TabsContent value="curves" className="mt-4">
                <CurvesTab result={progResult} />
              </TabsContent>
              <TabsContent value="content" className="mt-4">
                <ContentPlanTab result={progResult} />
              </TabsContent>
              <TabsContent value="validation" className="mt-4">
                <ValidationTab result={progResult} />
              </TabsContent>
            </Tabs>
          )}
        </TabsContent>

        {/* ====================== ECONOMY TAB ====================== */}
        <TabsContent value="economy" className="space-y-6 mt-4">
          {/* Input Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Coins className="h-5 w-5 text-primary" />
                Параметры экономики
              </CardTitle>
              <CardDescription>Настройте параметры для проектирования экономики</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Genre */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Жанр</Label>
                  <Select value={ecoGenre} onValueChange={setEcoGenre}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GENRES.map((g) => (
                        <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Monetization Type */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Тип монетизации</Label>
                  <Select value={ecoMonetization} onValueChange={setEcoMonetization}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONETIZATION_MODELS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Openness */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Открытость</Label>
                  <Select value={ecoOpenness} onValueChange={setEcoOpenness}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPENNESS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Run button */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleRunEconomy}
                  disabled={isEcoLoading}
                  className="gap-1.5"
                >
                  {isEcoLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  Спроектировать экономику
                </Button>
                {ecoResult?.latency_ms != null && !isEcoLoading && (
                  <span className="text-xs text-muted-foreground">
                    Последний запуск: {ecoResult.latency_ms} мс
                  </span>
                )}
              </div>

              {/* Error */}
              {ecoError && (
                <div className="flex items-start gap-2 text-xs rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-3">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <span className="text-red-700 dark:text-red-300">{ecoError}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results */}
          {ecoResult && (
            <Tabs value={ecoSubTab} onValueChange={setEcoSubTab}>
              <TabsList>
                <TabsTrigger value="resources">Ресурсы</TabsTrigger>
                <TabsTrigger value="classification">Классификация</TabsTrigger>
                <TabsTrigger value="machinations">Machinations</TabsTrigger>
                <TabsTrigger value="diagnostics">Диагностика</TabsTrigger>
                <TabsTrigger value="simulation">Симуляция</TabsTrigger>
              </TabsList>
              <TabsContent value="resources" className="mt-4">
                <ResourcesTab result={ecoResult} />
              </TabsContent>
              <TabsContent value="classification" className="mt-4">
                <ClassificationTab result={ecoResult} />
              </TabsContent>
              <TabsContent value="machinations" className="mt-4">
                <MachinationsEconomyTab result={ecoResult} />
              </TabsContent>
              <TabsContent value="diagnostics" className="mt-4">
                <DiagnosticsTab result={ecoResult} />
              </TabsContent>
              <TabsContent value="simulation" className="mt-4">
                <SimulationEconomyTab result={ecoResult} />
              </TabsContent>
            </Tabs>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
