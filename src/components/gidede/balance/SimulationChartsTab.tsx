"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronUp,
  BarChart3,
  Activity,
  Layers,
  Target,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { FullBalanceResponse } from "@/types/balance";
import { VERDICT_STYLES } from "@/constants/balance";
import { WarningsList, SuggestionsList, EmptyStateCard } from "@/components/gidede/shared";

// Trophy icon (lucide doesn't have Trophy, use a substitute)
function Trophy({ className }: { className?: string }) {
  return <Target className={className} />;
}

interface SimulationChartsTabProps {
  result: FullBalanceResponse | null;
}

export const SimulationChartsTab = React.memo(function SimulationChartsTab({ result }: SimulationChartsTabProps) {
  const [showMatchup, setShowMatchup] = useState(false);

  if (!result?.monte_carlo_result) {
    return (
      <EmptyStateCard
        icon={BarChart3}
        title="Run the analysis with Monte Carlo to see simulation charts"
        description="Win rates, durations, and balance verdict"
      />
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
      <WarningsList warnings={warnings} />
      <SuggestionsList suggestions={suggestions} variant="inline" />
    </div>
  );
});
