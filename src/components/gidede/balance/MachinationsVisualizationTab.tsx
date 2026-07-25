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
  CircleDot,
  Activity,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Flame,
  TrendingUp,
  Lightbulb,
  Wrench,
  GitBranch,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import type { FullBalanceResponse, MachinationsGraph, MachinationsQuality } from "@/types/balance";
import { NodeTypeIcon, EmptyStateCard, WarningsList, SuggestionsList } from "@/components/gidede/shared";

interface MachinationsVisualizationTabProps {
  result: FullBalanceResponse | null;
}

export const MachinationsVisualizationTab = React.memo(function MachinationsVisualizationTab({ result }: MachinationsVisualizationTabProps) {
  if (!result?.machinations_result) {
    return (
      <EmptyStateCard
        icon={GitBranch}
        title="Run the analysis with Machinations to see graph visualization"
        description="Resource flow graph, feedback loops, and quality assessment"
      />
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

      {/* Warnings */}
      <WarningsList warnings={quality.warnings || []} />

      {/* Recommendations */}
      <SuggestionsList suggestions={recommendations} />
    </div>
  );
});
