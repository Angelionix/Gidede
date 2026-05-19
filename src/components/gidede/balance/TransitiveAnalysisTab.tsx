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
import { Scale, Target } from "lucide-react";
import type { FullBalanceResponse } from "@/types/balance";
import { STATUS_COLORS, STATUS_DOT } from "@/constants/balance";
import { WarningsList, SuggestionsList, EmptyStateCard } from "@/components/gidede/shared";

interface TransitiveAnalysisTabProps {
  result: FullBalanceResponse | null;
}

export function TransitiveAnalysisTab({ result }: TransitiveAnalysisTabProps) {
  if (!result?.transitive_result) {
    return (
      <EmptyStateCard
        icon={Scale}
        title="Run the analysis to see transitive balance results"
        description="Cost-power ratio analysis and curve fitting"
      />
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
      <WarningsList warnings={warnings} />

      {/* Suggestions */}
      <SuggestionsList suggestions={suggestions} />
    </div>
  );
}
