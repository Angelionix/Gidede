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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Swords,
  Brain,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  TrendingDown,
  Gauge,
} from "lucide-react";
import type { FullBalanceResponse } from "@/types/balance";
import { WarningsList, SuggestionsList, EmptyStateCard } from "@/components/gidede/shared";

interface PayoffMatrixTabProps {
  result: FullBalanceResponse | null;
}

export const PayoffMatrixTab = React.memo(function PayoffMatrixTab({ result }: PayoffMatrixTabProps) {
  if (!result?.intransitive_result) {
    return (
      <EmptyStateCard
        icon={Swords}
        title="Run the analysis to see payoff matrix results"
        description="Intransitive analysis and Nash Equilibrium"
      />
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
      <WarningsList warnings={warnings} />
      <SuggestionsList suggestions={suggestions} variant="inline" />
    </div>
  );
});
