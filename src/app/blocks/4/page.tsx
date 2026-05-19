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
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Scale,
  Loader2,
  Check,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Zap,
  Shield,
  Swords,
  Heart,
  Target,
  Brain,
  ChevronDown,
  ChevronUp,
  Play,
  BarChart3,
  GitBranch,
  Activity,
  Lightbulb,
  Wrench,
  TrendingUp,
  TrendingDown,
  CircleDot,
  Layers,
  RotateCcw,
  Flame,
  Snowflake,
  Gauge,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  Cell,
} from "recharts";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { usePipeline } from "@/hooks/use-pipeline";

// ============================================================
// Constants
// ============================================================

import { API_BASE_URL, apiRoutes } from "@/config/api";
import { GENRES } from "@/config/genres";

const GAME_MODES = [
  { value: "PvP", label: "PvP" },
  { value: "PvE", label: "PvE" },
  { value: "PvPvE", label: "PvPvE" },
];

const BALANCE_TYPES = [
  { value: "transitive", label: "Transitive" },
  { value: "intransitive", label: "Intransitive" },
  { value: "situational", label: "Situational" },
  { value: "mixed", label: "Mixed" },
];

const STATUS_COLORS: Record<string, string> = {
  overpowered: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
  underpowered: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  balanced: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800",
  ideal_imbalance: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
};

const STATUS_DOT: Record<string, string> = {
  overpowered: "bg-red-500",
  underpowered: "bg-amber-500",
  balanced: "bg-green-500",
  ideal_imbalance: "bg-blue-500",
};

const VERDICT_STYLES: Record<string, string> = {
  GOOD: "bg-green-600 text-white",
  MODERATE: "bg-amber-600 text-white",
  POOR: "bg-red-600 text-white",
};

const DEFAULT_OBJECTS: BalanceObject[] = [
  { id: "1", name: "Warrior", type: "melee", attributes: { HP: 100, damage: 15, speed: 5, armor: 10 }, cost: 100, tier: 1 },
  { id: "2", name: "Mage", type: "ranged", attributes: { HP: 60, damage: 25, speed: 7, armor: 3 }, cost: 120, tier: 1 },
  { id: "3", name: "Rogue", type: "melee", attributes: { HP: 70, damage: 20, speed: 12, armor: 5 }, cost: 110, tier: 1 },
  { id: "4", name: "Tank", type: "melee", attributes: { HP: 200, damage: 8, speed: 3, armor: 20 }, cost: 150, tier: 2 },
  { id: "5", name: "Healer", type: "support", attributes: { HP: 80, damage: 10, speed: 6, armor: 8 }, cost: 90, tier: 1 },
];

// ============================================================
// Types
// ============================================================

interface BalanceObject {
  id: string;
  name: string;
  type: string;
  attributes: Record<string, number>;
  cost?: number;
  tier?: number;
  tags?: string[];
}

interface FullBalanceRequest {
  objects: BalanceObject[];
  resources?: Record<string, unknown>[];
  game_mode: "PvP" | "PvE" | "PvPvE";
  genre: string;
  balance_type: "transitive" | "intransitive" | "situational" | "mixed";
  anchor_resource?: string;
  target_duration?: number;
  target_levels?: number;
  mda_profile?: Record<string, unknown>;
  run_intransitive: boolean;
  run_situational: boolean;
  run_q_factor: boolean;
  run_monte_carlo: boolean;
  run_machinations: boolean;
}

interface TransitiveObject {
  name: string;
  power: number;
  effective_cost: number;
  cp_ratio: number;
  distance_from_curve: number;
  status: string;
}

interface TransitiveResult {
  attribute_weights: Record<string, number>;
  cost_curve_model: string;
  expected_cp: number;
  objects: TransitiveObject[];
  overpowered: string[];
  underpowered: string[];
  balanced: string[];
  ideal_imbalance: string[];
  warnings: string[];
  suggestions: string[];
}

interface IntransitiveResult {
  payoff_matrix: number[][];
  object_names: string[];
  nash_equilibrium: number[];
  is_intransitive: boolean;
  dominated_strategies: string[];
  strategy_balance: { entropy: number; max_share: number; gini: number };
  rps_cycles: { cycle: string[]; strength: number }[];
  has_dominant_strategy: boolean;
  warnings: string[];
  suggestions: string[];
}

interface MonteCarloResult {
  config: Record<string, unknown>;
  win_rates: Record<string, number>;
  avg_duration: Record<string, number>;
  matchup_matrix: Record<string, Record<string, number>>;
  win_rate_spread: number;
  ranking_correlation: number;
  balance_verdict: string;
  warnings: string[];
  suggestions: string[];
}

interface MachinationsNode {
  id: string;
  name: string;
  type: string;
  value?: number;
  capacity?: number;
}

interface ResourceFlow {
  from: string;
  to: string;
  rate: number | string;
  label?: string;
}

interface StateConnection {
  from: string;
  to: string;
  modifier: string;
}

interface FeedbackLoop {
  nodes: string[];
  type: string;
  strength?: number;
  description?: string;
}

interface MachinationsGraph {
  nodes: MachinationsNode[];
  resource_flows: ResourceFlow[];
  state_connections: StateConnection[];
  feedback_loops: FeedbackLoop[];
  [key: string]: unknown;
}

interface MachinationsQuality {
  resources_in_bounds: boolean;
  progression_pacing_ok: boolean;
  no_runaway_for_minmaxer: boolean;
  no_stall_for_casual: boolean;
  build_gap_acceptable: boolean;
  economy_stable: boolean;
  overall_pass: boolean;
  critical_issues: string[];
  warnings: string[];
}

interface MachinationsResult {
  graph: MachinationsGraph;
  runs: number;
  aggregated: {
    avg_resource_curves: Record<string, number[]>;
    resource_ranges: Record<string, { min: number; max: number }>;
    runaway_frequency: number;
    stall_frequency: number;
    stability_index: number;
    build_gap: number;
    [key: string]: unknown;
  };
  quality: MachinationsQuality;
  detected_pathologies: string[];
  recommendations: string[];
}

interface FullBalanceResponse {
  id: string;
  balance_map: {
    primary_model: string;
    secondary_model: string;
    anchor: string;
    game_sum: string;
    feedback: string;
    applicable_balance_types: string[];
  };
  transitive_result: TransitiveResult;
  intransitive_result: IntransitiveResult;
  situational_result: Record<string, unknown>;
  q_factor_result: Record<string, unknown>;
  stability: {
    overall_stability: number;
    pathology_risks: string[];
    analysis: string;
    positive_loops: number;
    negative_loops: number;
    recommendations: string[];
  };
  monte_carlo_result: MonteCarloResult;
  machinations_result: MachinationsResult;
  stages_completed: number[];
  latency_ms: number;
  models_used: string[];
  warnings: string[];
  suggestions: string[];
}

// ============================================================
// Sub-components
// ============================================================

// --- ObjectForm: Add/Edit balance objects ---
function ObjectForm({
  objects,
  onObjectsChange,
}: {
  objects: BalanceObject[];
  onObjectsChange: (objs: BalanceObject[]) => void;
}) {
  const [newAttrKey, setNewAttrKey] = useState("");
  const [newAttrVal, setNewAttrVal] = useState("");

  const addAttribute = (objIndex: number) => {
    if (!newAttrKey.trim() || !newAttrVal) return;
    const updated = [...objects];
    updated[objIndex] = {
      ...updated[objIndex],
      attributes: { ...updated[objIndex].attributes, [newAttrKey.trim()]: Number(newAttrVal) },
    };
    onObjectsChange(updated);
    setNewAttrKey("");
    setNewAttrVal("");
  };

  const removeAttribute = (objIndex: number, key: string) => {
    const updated = [...objects];
    const attrs = { ...updated[objIndex].attributes };
    delete attrs[key];
    updated[objIndex] = { ...updated[objIndex], attributes: attrs };
    onObjectsChange(updated);
  };

  const addObject = () => {
    const id = String(objects.length + 1 + Math.random()).slice(0, 8);
    onObjectsChange([
      ...objects,
      { id, name: "", type: "melee", attributes: {}, cost: 100, tier: 1 },
    ]);
  };

  const removeObject = (index: number) => {
    onObjectsChange(objects.filter((_, i) => i !== index));
  };

  const updateObject = (index: number, field: string, value: unknown) => {
    const updated = [...objects];
    updated[index] = { ...updated[index], [field]: value };
    onObjectsChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          Balance Objects ({objects.length})
        </p>
        <Button variant="outline" size="sm" onClick={addObject}>
          <Zap className="h-3.5 w-3.5 mr-1.5" />
          Add Object
        </Button>
      </div>

      <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
        {objects.map((obj, oi) => (
          <Card key={obj.id} className="border-dashed">
            <CardContent className="p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Name"
                  value={obj.name}
                  onChange={(e) => updateObject(oi, "name", e.target.value)}
                  className="h-8 text-sm flex-1"
                />
                <Select
                  value={obj.type}
                  onValueChange={(v) => updateObject(oi, "type", v)}
                >
                  <SelectTrigger className="h-8 text-sm w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="melee">Melee</SelectItem>
                    <SelectItem value="ranged">Ranged</SelectItem>
                    <SelectItem value="support">Support</SelectItem>
                    <SelectItem value="tank">Tank</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Cost"
                  value={obj.cost ?? ""}
                  onChange={(e) => updateObject(oi, "cost", Number(e.target.value) || undefined)}
                  className="h-8 text-sm w-20"
                />
                <Input
                  type="number"
                  placeholder="Tier"
                  value={obj.tier ?? ""}
                  onChange={(e) => updateObject(oi, "tier", Number(e.target.value) || undefined)}
                  className="h-8 text-sm w-16"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeObject(oi)}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>

              {/* Attributes */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Attributes</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {Object.entries(obj.attributes).map(([key, val]) => (
                    <Badge key={key} variant="outline" className="text-xs pr-1">
                      {key}: {val}
                      <button
                        type="button"
                        className="ml-1 text-muted-foreground hover:text-destructive"
                        onClick={() => removeAttribute(oi, key)}
                      >
                        <XCircle className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <Input
                    placeholder="Key"
                    value={newAttrKey}
                    onChange={(e) => setNewAttrKey(e.target.value)}
                    className="h-7 text-xs w-24"
                  />
                  <Input
                    type="number"
                    placeholder="Value"
                    value={newAttrVal}
                    onChange={(e) => setNewAttrVal(e.target.value)}
                    className="h-7 text-xs w-20"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => addAttribute(oi)}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// --- TransitiveAnalysisTab ---
function TransitiveAnalysisTab({ result }: { result: FullBalanceResponse | null }) {
  if (!result?.transitive_result) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Scale className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Run the analysis to see transitive balance results</p>
          <p className="text-xs mt-1">Cost-power ratio analysis and curve fitting</p>
        </CardContent>
      </Card>
    );
  }

  const tr = result.transitive_result;
  const attributeWeights = tr.attribute_weights || {};
  const warnings = tr.warnings || [];
  const suggestions = tr.suggestions || [];

  return (
    <div className="space-y-4">
      {/* Balance table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Transitive Balance Analysis
          </CardTitle>
          <CardDescription>
            Cost-Power ratio analysis with curve fitting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Element</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Power</TableHead>
                  <TableHead className="text-right">C/P Ratio</TableHead>
                  <TableHead className="text-right">Dist. from Curve</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(tr.objects || []).map((obj, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-sm">{obj.name}</TableCell>
                    <TableCell className="text-right text-sm">
                      {typeof obj.effective_cost === "number" ? obj.effective_cost.toFixed(1) : "-"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {typeof obj.power === "number" ? obj.power.toFixed(2) : "-"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {typeof obj.cp_ratio === "number" ? obj.cp_ratio.toFixed(3) : "-"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {typeof obj.distance_from_curve === "number"
                        ? obj.distance_from_curve.toFixed(3)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                          STATUS_COLORS[obj.status] || STATUS_COLORS.balanced
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${STATUS_DOT[obj.status] || STATUS_DOT.balanced}`} />
                        {obj.status?.replace("_", " ") || "unknown"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Attribute weights & model */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Attribute Weights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(attributeWeights).map(([attr, weight]) => {
              const w = weight as number;
              return (
                <div key={attr} className="flex items-center gap-2 text-xs">
                  <span className="font-medium w-24">{attr}</span>
                  <Progress value={w * 100} className="flex-1 h-2" />
                  <span className="text-muted-foreground w-12 text-right">{(w * 100).toFixed(1)}%</span>
                </div>
              );
            })}
            {Object.keys(attributeWeights).length === 0 && (
              <p className="text-xs text-muted-foreground">No attribute weights available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Cost Curve Model</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className="text-xs">{tr.cost_curve_model || "N/A"}</Badge>
            </div>
            {typeof tr.expected_cp === "number" && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Expected C/P:</span>
                <span className="font-semibold">{tr.expected_cp.toFixed(3)}</span>
              </div>
            )}
            {/* Summary counts */}
            <div className="flex flex-wrap gap-2">
              {(tr.overpowered || []).length > 0 && (
                <Badge variant="outline" className="text-xs border-red-300 text-red-700 dark:text-red-400">
                  {tr.overpowered.length} overpowered
                </Badge>
              )}
              {(tr.underpowered || []).length > 0 && (
                <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 dark:text-amber-400">
                  {tr.underpowered.length} underpowered
                </Badge>
              )}
              {(tr.balanced || []).length > 0 && (
                <Badge variant="outline" className="text-xs border-green-300 text-green-700 dark:text-green-400">
                  {tr.balanced.length} balanced
                </Badge>
              )}
              {(tr.ideal_imbalance || []).length > 0 && (
                <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 dark:text-blue-400">
                  {tr.ideal_imbalance.length} ideal imbalance
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Warnings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 max-h-40 overflow-y-auto">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-xs rounded-md bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 p-2">
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
                <span>{w}</span>
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
              Suggestions
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

// --- PayoffMatrixTab ---
function PayoffMatrixTab({ result }: { result: FullBalanceResponse | null }) {
  if (!result?.intransitive_result) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Swords className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Run the analysis to see payoff matrix results</p>
          <p className="text-xs mt-1">Intransitive analysis and Nash Equilibrium</p>
        </CardContent>
      </Card>
    );
  }

  const ir = result.intransitive_result;
  const names = ir.object_names || [];
  const matrix = ir.payoff_matrix || [];
  const nash = ir.nash_equilibrium || [];
  const dominated = ir.dominated_strategies || [];
  const strategyBalance = ir.strategy_balance || { entropy: 0, max_share: 0, gini: 0 };
  const rpsCycles = ir.rps_cycles || [];
  const warnings = ir.warnings || [];
  const suggestions = ir.suggestions || [];

  // Heatmap color: positive for row = green, negative for row = red
  const getCellColor = (value: number) => {
    if (value > 0.3) return "bg-green-200 dark:bg-green-900/50 text-green-900 dark:text-green-100";
    if (value > 0.1) return "bg-green-100 dark:bg-green-950/30 text-green-800 dark:text-green-200";
    if (value > -0.1) return "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300";
    if (value > -0.3) return "bg-red-100 dark:bg-red-950/30 text-red-800 dark:text-red-200";
    return "bg-red-200 dark:bg-red-900/50 text-red-900 dark:text-red-100";
  };

  return (
    <div className="space-y-4">
      {/* Payoff Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Swords className="h-5 w-5 text-primary" />
            Payoff Matrix
          </CardTitle>
          <CardDescription>
            Row player payoff values (green = favorable, red = unfavorable)
            {ir.is_intransitive && (
              <Badge variant="outline" className="ml-2 text-xs border-blue-300 text-blue-700 dark:text-blue-400">
                Intransitive detected
              </Badge>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24"></TableHead>
                  {names.map((name, i) => (
                    <TableHead key={i} className="text-center text-xs">{name}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {matrix.map((row, ri) => (
                  <TableRow key={ri}>
                    <TableCell className="font-medium text-sm">{names[ri] || `P${ri + 1}`}</TableCell>
                    {(row as number[]).map((val, ci) => (
                      <TableCell key={ci} className="text-center">
                        <span className={`inline-flex items-center justify-center rounded px-2 py-1 text-xs font-semibold ${getCellColor(val)}`}>
                          {typeof val === "number" ? val.toFixed(2) : "-"}
                        </span>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Nash Equilibrium */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            Nash Equilibrium Probabilities
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {names.map((name, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="font-medium w-24">{name}</span>
              <Progress value={(nash[i] || 0) * 100} className="flex-1 h-2" />
              <span className="text-muted-foreground w-14 text-right">
                {((nash[i] || 0) * 100).toFixed(1)}%
              </span>
            </div>
          ))}
          {ir.has_dominant_strategy && (
            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 mt-2">
              <AlertTriangle className="h-3.5 w-3.5" />
              A dominant strategy exists
            </div>
          )}
        </CardContent>
      </Card>

      {/* RPS Cycles */}
      {rpsCycles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-primary" />
              Rock-Paper-Scissors Cycles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {rpsCycles.map((cycle, i) => (
              <div key={i} className="flex items-center gap-2 text-xs rounded-md border p-2">
                <div className="flex items-center gap-1">
                  {(cycle.cycle || []).map((c, ci) => (
                    <React.Fragment key={ci}>
                      <Badge variant="outline" className="text-xs">{c}</Badge>
                      {ci < (cycle.cycle || []).length - 1 && (
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
                <Badge variant="secondary" className="text-xs ml-auto">
                  Strength: {typeof cycle.strength === "number" ? cycle.strength.toFixed(2) : "-"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Dominated Strategies */}
      {dominated.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-amber-500" />
              Dominated Strategies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {dominated.map((d, i) => (
                <Badge key={i} variant="outline" className="text-xs border-amber-300 text-amber-700 dark:text-amber-400">
                  {d}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strategy Balance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            Strategy Balance Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-md border">
              <p className="text-xs text-muted-foreground mb-1">Entropy</p>
              <p className="text-lg font-bold">{typeof strategyBalance.entropy === "number" ? strategyBalance.entropy.toFixed(3) : "-"}</p>
            </div>
            <div className="text-center p-3 rounded-md border">
              <p className="text-xs text-muted-foreground mb-1">Max Share</p>
              <p className="text-lg font-bold">{typeof strategyBalance.max_share === "number" ? (strategyBalance.max_share * 100).toFixed(1) + "%" : "-"}</p>
            </div>
            <div className="text-center p-3 rounded-md border">
              <p className="text-xs text-muted-foreground mb-1">Gini Coefficient</p>
              <p className="text-lg font-bold">{typeof strategyBalance.gini === "number" ? strategyBalance.gini.toFixed(3) : "-"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warnings & Suggestions */}
      {warnings.length > 0 && (
        <div className="space-y-1.5">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs rounded-md bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 p-2">
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
      {suggestions.length > 0 && (
        <div className="space-y-1.5">
          {suggestions.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-xs rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-2">
              <Info className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- SimulationChartsTab ---
function SimulationChartsTab({ result }: { result: FullBalanceResponse | null }) {
  const [showMatchup, setShowMatchup] = useState(false);

  if (!result?.monte_carlo_result) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Run the analysis with Monte Carlo to see simulation charts</p>
          <p className="text-xs mt-1">Win rates, durations, and balance verdict</p>
        </CardContent>
      </Card>
    );
  }

  const mc = result.monte_carlo_result;
  const winRates = mc.win_rates || {};
  const avgDuration = mc.avg_duration || {};
  const matchupMatrix = mc.matchup_matrix || {};
  const verdict = mc.balance_verdict || "N/A";
  const spread = mc.win_rate_spread;
  const correlation = mc.ranking_correlation;
  const warnings = mc.warnings || [];
  const suggestions = mc.suggestions || [];

  // Prepare chart data
  const winRateData = Object.entries(winRates).map(([name, rate]) => ({
    name,
    winRate: typeof rate === "number" ? Math.round(rate * 1000) / 10 : 0,
  }));

  const durationData = Object.entries(avgDuration).map(([name, dur]) => ({
    name,
    duration: typeof dur === "number" ? Math.round(dur * 10) / 10 : 0,
  }));

  const getBarColor = (winRate: number) => {
    if (winRate >= 55) return "#ef4444";
    if (winRate >= 45) return "#22c55e";
    return "#f59e0b";
  };

  return (
    <div className="space-y-4">
      {/* Summary indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Win Rate Spread</p>
            <p className="text-2xl font-bold">{typeof spread === "number" ? spread.toFixed(1) + "%" : "-"}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Lower is more balanced</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Ranking Correlation (Spearman)</p>
            <p className="text-2xl font-bold">{typeof correlation === "number" ? correlation.toFixed(3) : "-"}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Higher means transitive order holds</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Balance Verdict</p>
            <span className={`inline-flex items-center rounded-full px-4 py-1.5 text-sm font-bold ${VERDICT_STYLES[verdict] || "bg-gray-600 text-white"}`}>
              {verdict}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Win Rate Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            Win Rate per Object
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={winRateData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} unit="%" />
                <Tooltip
                  formatter={(value) => [`${Number(value).toFixed(1)}%`, "Win Rate"]}
                />
                <Bar dataKey="winRate" radius={[4, 4, 0, 0]}>
                  {winRateData.map((entry, index) => (
                    <Cell key={index} fill={getBarColor(entry.winRate)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Average Duration Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Average Duration per Object
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={durationData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => [`${Number(value).toFixed(1)}`, "Avg Duration"]}
                />
                <Bar dataKey="duration" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Matchup Matrix (Collapsible) */}
      <Collapsible open={showMatchup} onOpenChange={setShowMatchup}>
        <Card>
          <CardHeader>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
              <CardTitle className="text-sm flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Matchup Matrix
              </CardTitle>
              {showMatchup ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />
              )}
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24"></TableHead>
                      {Object.keys(matchupMatrix).map((name, i) => (
                        <TableHead key={i} className="text-center text-xs">{name}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(matchupMatrix).map(([rowName, rowOpponents], ri) => (
                      <TableRow key={ri}>
                        <TableCell className="font-medium text-sm">{rowName}</TableCell>
                        {Object.entries(rowOpponents as Record<string, number>).map(([colName, val], ci) => (
                          <TableCell key={ci} className="text-center text-xs">
                            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
                              val > 0.55
                                ? "bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300"
                                : val < 0.45
                                  ? "bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-300"
                                  : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                            }`}>
                              {(val * 100).toFixed(1)}%
                            </span>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Warnings & Suggestions */}
      {warnings.length > 0 && (
        <div className="space-y-1.5">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs rounded-md bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 p-2">
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
      {suggestions.length > 0 && (
        <div className="space-y-1.5">
          {suggestions.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-xs rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-2">
              <Info className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Simple icon component for Machinations node types
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

// --- MachinationsVisualizationTab ---
function MachinationsVisualizationTab({ result }: { result: FullBalanceResponse | null }) {
  if (!result?.machinations_result) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Run the analysis with Machinations to see graph visualization</p>
          <p className="text-xs mt-1">Resource flow graph, feedback loops, and quality assessment</p>
        </CardContent>
      </Card>
    );
  }

  const mach = result.machinations_result;
  const graph = mach.graph || {} as MachinationsGraph;
  const nodes = graph.nodes || [];
  const flows = graph.resource_flows || [];
  const stateConns = graph.state_connections || [];
  const feedbackLoops = graph.feedback_loops || [];
  const aggregated = mach.aggregated || {
    avg_resource_curves: {},
    resource_ranges: {},
    runaway_frequency: 0,
    stall_frequency: 0,
    stability_index: 0,
    build_gap: 0,
  };
  const quality = mach.quality || {
    resources_in_bounds: false,
    progression_pacing_ok: false,
    no_runaway_for_minmaxer: false,
    no_stall_for_casual: false,
    build_gap_acceptable: false,
    economy_stable: false,
    overall_pass: false,
    critical_issues: [],
    warnings: [],
  };
  const pathologies = mach.detected_pathologies || [];
  const recommendations = mach.recommendations || [];

  const qualityChecks = [
    { key: "resources_in_bounds", label: "Resources in Bounds" },
    { key: "progression_pacing_ok", label: "Progression Pacing OK" },
    { key: "no_runaway_for_minmaxer", label: "No Runaway for Min-Maxer" },
    { key: "no_stall_for_casual", label: "No Stall for Casual" },
    { key: "build_gap_acceptable", label: "Build Gap Acceptable" },
    { key: "economy_stable", label: "Economy Stable" },
  ];

  // Resource curves chart data
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

  const CURVE_COLORS = ["#22c55e", "#ef4444", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6"];

  return (
    <div className="space-y-4">
      {/* Nodes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <CircleDot className="h-4 w-4 text-primary" />
            Graph Nodes ({nodes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {nodes.map((node, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border p-2">
                <NodeTypeIcon type={node.type} />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{node.name}</p>
                  <p className="text-[10px] text-muted-foreground">{node.type}{node.value != null ? ` | ${node.value}` : ""}{node.capacity != null ? ` / ${node.capacity}` : ""}</p>
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
            Resource Flows ({flows.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {flows.map((flow, i) => (
              <div key={i} className="flex items-center gap-2 text-xs rounded-md border p-2">
                <Badge variant="outline" className="text-[10px] shrink-0">{flow.from}</Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <Badge variant="outline" className="text-[10px] shrink-0">{flow.to}</Badge>
                <Badge variant="secondary" className="text-[10px] ml-auto">
                  rate: {flow.rate}
                </Badge>
                {flow.label && (
                  <span className="text-muted-foreground text-[10px]">({flow.label})</span>
                )}
              </div>
            ))}
            {flows.length === 0 && <p className="text-xs text-muted-foreground">No resource flows defined</p>}
          </div>
        </CardContent>
      </Card>

      {/* State Connections */}
      {stateConns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              State Connections ({stateConns.length})
            </CardTitle>
            <CardDescription className="text-xs">Dashed arrows modifying flow rates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {stateConns.map((conn, i) => (
                <div key={i} className="flex items-center gap-2 text-xs rounded-md border border-dashed p-2">
                  <Badge variant="outline" className="text-[10px]">{conn.from}</Badge>
                  <span className="text-muted-foreground">--{conn.modifier}--&gt;</span>
                  <Badge variant="outline" className="text-[10px]">{conn.to}</Badge>
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
              Feedback Loops ({feedbackLoops.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {feedbackLoops.map((loop, i) => {
                const loopType = loop.type || "unknown";
                const isPositive = loopType === "positive" || loopType === "reinforcing";
                return (
                  <div key={i} className="flex items-center gap-2 text-xs rounded-md border p-2">
                    <Badge className={`text-[10px] ${isPositive ? "bg-green-600 text-white" : "bg-blue-600 text-white"}`}>
                      {isPositive ? "Reinforcing" : "Balancing"}
                    </Badge>
                    <span className="text-muted-foreground">
                      {(loop.nodes || []).join(" -> ")}
                      {(loop.nodes || []).length > 0 && " -> " + loop.nodes[0]}
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

      {/* Quality Assessment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Quality Assessment
          </CardTitle>
          <CardDescription className="text-xs">
            {quality.overall_pass ? "All checks passed" : "Some checks failed"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {qualityChecks.map((check) => {
            const passed = quality[check.key as keyof MachinationsQuality] as boolean;
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

          {/* Critical issues */}
          {(quality.critical_issues || []).length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs font-medium text-red-600 dark:text-red-400">Critical Issues</p>
              {(quality.critical_issues || []).map((issue, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{issue}</span>
                </div>
              ))}
            </div>
          )}
          {(quality.warnings || []).length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400">Quality Warnings</p>
              {(quality.warnings || []).map((w, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-yellow-600 dark:text-yellow-400">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detected Pathologies */}
      {pathologies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Flame className="h-4 w-4 text-red-500" />
              Detected Pathologies ({pathologies.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {pathologies.map((p, i) => (
                <Badge key={i} variant="outline" className="text-xs border-red-300 text-red-700 dark:text-red-400">
                  {p}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resource Curves Chart */}
      {curveNames.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Aggregated Resource Curves
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

      {/* Stability Index & Build Gap */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Stability Index</p>
            <p className="text-2xl font-bold">{typeof aggregated.stability_index === "number" ? aggregated.stability_index.toFixed(3) : "-"}</p>
            <Progress
              value={typeof aggregated.stability_index === "number" ? aggregated.stability_index * 100 : 0}
              className="h-2 mt-2"
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Build Gap</p>
            <p className="text-2xl font-bold">{typeof aggregated.build_gap === "number" ? aggregated.build_gap.toFixed(3) : "-"}</p>
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
            <p className="text-xs text-muted-foreground mb-1">Runaway Frequency</p>
            <p className="text-lg font-bold text-red-600 dark:text-red-400">
              {typeof aggregated.runaway_frequency === "number" ? (aggregated.runaway_frequency * 100).toFixed(1) + "%" : "-"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Stall Frequency</p>
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
              {typeof aggregated.stall_frequency === "number" ? (aggregated.stall_frequency * 100).toFixed(1) + "%" : "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 max-h-40 overflow-y-auto">
            {recommendations.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-2">
                <Lightbulb className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                <span>{r}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// --- CorrectionsPanelTab ---
function CorrectionsPanelTab({ result }: { result: FullBalanceResponse | null }) {
  if (!result) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Wrench className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Run the analysis to see corrections and recommendations</p>
          <p className="text-xs mt-1">Warnings, suggestions, and AI-generated fixes</p>
        </CardContent>
      </Card>
    );
  }

  const allWarnings = result.warnings || [];
  const allSuggestions = result.suggestions || [];
  const stagesCompleted = result.stages_completed || [];
  const latencyMs = result.latency_ms || 0;
  const modelsUsed = result.models_used || [];

  // Collect warnings from sub-results
  const trWarnings = result.transitive_result?.warnings || [];
  const irWarnings = result.intransitive_result?.warnings || [];
  const mcWarnings = result.monte_carlo_result?.warnings || [];
  const machPathologies = result.machinations_result?.detected_pathologies || [];

  // Categorize: critical = pathologies + dominated strategy, warning = all warnings, info = suggestions
  const criticalItems: { text: string; source: string }[] = [];
  const warningItems: { text: string; source: string }[] = [];
  const infoItems: { text: string; source: string }[] = [];

  machPathologies.forEach((p) => criticalItems.push({ text: p, source: "Machinations" }));
  if (result.intransitive_result?.has_dominant_strategy) {
    criticalItems.push({ text: "A dominant strategy exists in the payoff matrix", source: "Intransitive" });
  }

  allWarnings.forEach((w) => warningItems.push({ text: w, source: "General" }));
  trWarnings.forEach((w) => warningItems.push({ text: w, source: "Transitive" }));
  irWarnings.forEach((w) => warningItems.push({ text: w, source: "Intransitive" }));
  mcWarnings.forEach((w) => warningItems.push({ text: w, source: "Monte Carlo" }));

  allSuggestions.forEach((s) => infoItems.push({ text: s, source: "General" }));
  (result.transitive_result?.suggestions || []).forEach((s) => infoItems.push({ text: s, source: "Transitive" }));
  (result.intransitive_result?.suggestions || []).forEach((s) => infoItems.push({ text: s, source: "Intransitive" }));
  (result.monte_carlo_result?.suggestions || []).forEach((s) => infoItems.push({ text: s, source: "Monte Carlo" }));
  (result.machinations_result?.recommendations || []).forEach((s) => infoItems.push({ text: s, source: "Machinations" }));

  // AI recommendations derived from suggestions
  const aiRecommendations = infoItems.slice(0, 8).map((item, i) => ({
    id: i,
    text: item.text,
    source: item.source,
    severity: criticalItems.length > 0 ? "critical" : warningItems.length > 0 ? "warning" : "info" as string,
  }));

  return (
    <div className="space-y-4">
      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Analysis Metadata
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Stages Completed</p>
              <div className="flex flex-wrap gap-1.5">
                {stagesCompleted.map((s, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Latency</p>
              <p className="text-sm font-semibold">{latencyMs} ms</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Models Used</p>
              <div className="flex flex-wrap gap-1.5">
                {modelsUsed.map((m, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{m}</Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical */}
      {criticalItems.length > 0 && (
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-red-600 dark:text-red-400">
              <Flame className="h-4 w-4" />
              Critical ({criticalItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 max-h-40 overflow-y-auto">
            {criticalItems.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-xs rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-2">
                <AlertCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                <span className="flex-1">{item.text}</span>
                <Badge variant="outline" className="text-[10px] shrink-0 border-red-300 text-red-600 dark:text-red-400">{item.source}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Warnings */}
      {warningItems.length > 0 && (
        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="h-4 w-4" />
              Warnings ({warningItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 max-h-48 overflow-y-auto">
            {warningItems.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-xs rounded-md bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 p-2">
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
                <span className="flex-1">{item.text}</span>
                <Badge variant="outline" className="text-[10px] shrink-0 border-yellow-300 text-yellow-600 dark:text-yellow-400">{item.source}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Info / Suggestions */}
      {infoItems.length > 0 && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <Info className="h-4 w-4" />
              Info / Suggestions ({infoItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 max-h-48 overflow-y-auto">
            {infoItems.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-xs rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-2">
                <Info className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                <span className="flex-1">{item.text}</span>
                <Badge variant="outline" className="text-[10px] shrink-0 border-blue-300 text-blue-600 dark:text-blue-400">{item.source}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* AI Recommendations with Apply buttons */}
      {aiRecommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              AI-Generated Recommendations
            </CardTitle>
            <CardDescription className="text-xs">
              Suggested corrections based on analysis results
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {aiRecommendations.map((rec) => (
              <div key={rec.id} className="flex items-start gap-3 rounded-md border p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        rec.severity === "critical"
                          ? "border-red-300 text-red-600 dark:text-red-400"
                          : rec.severity === "warning"
                            ? "border-yellow-300 text-yellow-600 dark:text-yellow-400"
                            : "border-blue-300 text-blue-600 dark:text-blue-400"
                      }`}
                    >
                      {rec.severity}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">{rec.source}</Badge>
                  </div>
                  <p className="text-xs">{rec.text}</p>
                </div>
                <Button variant="outline" size="sm" className="shrink-0 h-7 text-xs">
                  <Check className="h-3 w-3 mr-1" />
                  Apply
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Balance Map Summary */}
      {result.balance_map && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" />
              Balance Map Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Primary Model</p>
                <Badge variant="outline" className="text-xs mt-1">{result.balance_map.primary_model || "-"}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Secondary Model</p>
                <Badge variant="outline" className="text-xs mt-1">{result.balance_map.secondary_model || "-"}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Anchor</p>
                <Badge variant="outline" className="text-xs mt-1">{result.balance_map.anchor || "-"}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Game Sum</p>
                <Badge variant="outline" className="text-xs mt-1">{result.balance_map.game_sum || "-"}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Feedback</p>
                <Badge variant="outline" className="text-xs mt-1">{result.balance_map.feedback || "-"}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Applicable Types</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(result.balance_map.applicable_balance_types || []).map((t, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stability */}
      {result.stability && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Stability Assessment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Overall Stability:</span>
              <span className="text-sm font-semibold">{typeof result.stability.overall_stability === "number" ? (result.stability.overall_stability * 100).toFixed(1) + "%" : "-"}</span>
              <Progress
                value={typeof result.stability.overall_stability === "number" ? result.stability.overall_stability * 100 : 0}
                className="flex-1 h-2"
              />
            </div>
            {(result.stability.pathology_risks || []).length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Pathology Risks</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.stability.pathology_risks.map((r, i) => (
                    <Badge key={i} variant="outline" className="text-xs border-red-300 text-red-700 dark:text-red-400">{r}</Badge>
                  ))}
                </div>
              </div>
            )}
            {result.stability.analysis && (
              <p className="text-xs text-muted-foreground rounded-md border p-2">{result.stability.analysis}</p>
            )}
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground">Positive Loops: {result.stability.positive_loops || 0}</span>
              <span className="text-xs text-muted-foreground">Negative Loops: {result.stability.negative_loops || 0}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// Trophy icon (lucide doesn't have Trophy, use a substitute)
// ============================================================
function Trophy({ className }: { className?: string }) {
  return <Target className={className} />;
}

// ============================================================
// Main Component
// ============================================================

export default function Block4Page() {
  const { apiFetch } = useAuth();
  const { toast } = useToast();

  // --- Pipeline ---
  const projectId =
    typeof window !== "undefined"
      ? localStorage.getItem("gidede_active_project")
      : null;
  const pipeline = usePipeline(projectId);

  // --- Form State ---
  const [objects, setObjects] = useState<BalanceObject[]>(DEFAULT_OBJECTS);
  const [gameMode, setGameMode] = useState<"PvP" | "PvE" | "PvPvE">("PvP");
  const [genre, setGenre] = useState("rpg");
  const [balanceType, setBalanceType] = useState<
    "transitive" | "intransitive" | "situational" | "mixed"
  >("mixed");
  const [runIntransitive, setRunIntransitive] = useState(true);
  const [runSituational, setRunSituational] = useState(false);
  const [runQFactor, setRunQFactor] = useState(false);
  const [runMonteCarlo, setRunMonteCarlo] = useState(true);
  const [runMachinations, setRunMachinations] = useState(true);
  const [activeTab, setActiveTab] = useState("transitive");

  // --- Result State ---
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<FullBalanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- Validation ---
  const isValid = objects.every((o) => o.name.trim() !== "") && objects.length >= 2;

  // --- Run Analysis ---
  const handleRunAnalysis = useCallback(async () => {
    if (!isValid) {
      toast({
        title: "Validation error",
        description: "All objects must have names and at least 2 objects are required",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const payload: FullBalanceRequest = {
        objects: objects.map((o) => ({
          id: o.id,
          name: o.name.trim(),
          type: o.type,
          attributes: o.attributes,
          cost: o.cost,
          tier: o.tier,
          tags: o.tags,
        })),
        game_mode: gameMode,
        genre,
        balance_type: balanceType,
        run_intransitive: runIntransitive,
        run_situational: runSituational,
        run_q_factor: runQFactor,
        run_monte_carlo: runMonteCarlo,
        run_machinations: runMachinations,
      };

      const data = await apiFetch<FullBalanceResponse>("/balance/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setResult(data);

      // Notify pipeline
      if (projectId) {
        pipeline.notifyUpdated(4, {
          balance_id: data.id,
          balance_type: balanceType,
          verdict: data.monte_carlo_result?.balance_verdict,
        });
      }

      toast({
        title: "Analysis complete",
        description: `Balance analysis finished in ${data.latency_ms || 0} ms`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      toast({
        title: "Analysis failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [
    isValid,
    objects,
    gameMode,
    genre,
    balanceType,
    runIntransitive,
    runSituational,
    runQFactor,
    runMonteCarlo,
    runMachinations,
    apiFetch,
    projectId,
    pipeline,
    toast,
  ]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Scale className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Balance and Simulation</h1>
          <p className="text-sm text-muted-foreground">Block 4 - Algorithm 3.4</p>
        </div>
        {result && (
          <Badge variant="outline" className="ml-auto text-xs border-green-300 text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Analysis loaded
          </Badge>
        )}
      </div>

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Configuration
          </CardTitle>
          <CardDescription>
            Define balance objects and analysis parameters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Game settings row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Game Mode</Label>
              <Select value={gameMode} onValueChange={(v) => setGameMode(v as "PvP" | "PvE" | "PvPvE")}>
                <SelectTrigger className="h-9 text-sm mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GAME_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Genre</Label>
              <Select value={genre} onValueChange={setGenre}>
                <SelectTrigger className="h-9 text-sm mt-1">
                  <SelectValue />
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
            <div>
              <Label className="text-xs">Balance Type</Label>
              <Select value={balanceType} onValueChange={(v) => setBalanceType(v as typeof balanceType)}>
                <SelectTrigger className="h-9 text-sm mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BALANCE_TYPES.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Analysis flags */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Analysis Modules</p>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Checkbox id="run-intransitive" checked={runIntransitive} onCheckedChange={(v) => setRunIntransitive(!!v)} />
                <Label htmlFor="run-intransitive" className="text-xs cursor-pointer">Intransitive</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="run-situational" checked={runSituational} onCheckedChange={(v) => setRunSituational(!!v)} />
                <Label htmlFor="run-situational" className="text-xs cursor-pointer">Situational</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="run-qfactor" checked={runQFactor} onCheckedChange={(v) => setRunQFactor(!!v)} />
                <Label htmlFor="run-qfactor" className="text-xs cursor-pointer">Q-Factor</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="run-montecarlo" checked={runMonteCarlo} onCheckedChange={(v) => setRunMonteCarlo(!!v)} />
                <Label htmlFor="run-montecarlo" className="text-xs cursor-pointer">Monte Carlo</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="run-machinations" checked={runMachinations} onCheckedChange={(v) => setRunMachinations(!!v)} />
                <Label htmlFor="run-machinations" className="text-xs cursor-pointer">Machinations</Label>
              </div>
            </div>
          </div>

          <Separator />

          {/* Objects form */}
          <ObjectForm objects={objects} onObjectsChange={setObjects} />

          {/* Run button */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleRunAnalysis}
              disabled={isAnalyzing || !isValid}
              className="min-w-[180px]"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Analysis
                </>
              )}
            </Button>
            {!isValid && (
              <p className="text-xs text-destructive">
                All objects must have names, at least 2 required
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">Analysis Error</p>
                <p className="text-xs mt-1">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Tabs */}
      {result && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="transitive" className="text-xs sm:text-sm">
              <Target className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
              Transitive
            </TabsTrigger>
            <TabsTrigger value="payoff" className="text-xs sm:text-sm">
              <Swords className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
              Payoff
            </TabsTrigger>
            <TabsTrigger value="simulation" className="text-xs sm:text-sm">
              <BarChart3 className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
              Simulation
            </TabsTrigger>
            <TabsTrigger value="machinations" className="text-xs sm:text-sm">
              <GitBranch className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
              Machinations
            </TabsTrigger>
            <TabsTrigger value="corrections" className="text-xs sm:text-sm">
              <Wrench className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
              Corrections
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="transitive">
              <TransitiveAnalysisTab result={result} />
            </TabsContent>

            <TabsContent value="payoff">
              <PayoffMatrixTab result={result} />
            </TabsContent>

            <TabsContent value="simulation">
              <SimulationChartsTab result={result} />
            </TabsContent>

            <TabsContent value="machinations">
              <MachinationsVisualizationTab result={result} />
            </TabsContent>

            <TabsContent value="corrections">
              <CorrectionsPanelTab result={result} />
            </TabsContent>
          </div>
        </Tabs>
      )}
    </div>
  );
}
