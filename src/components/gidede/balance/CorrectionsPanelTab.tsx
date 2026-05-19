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
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Flame,
  Info,
  Lightbulb,
  Scale,
  Shield,
  Wrench,
  Activity,
} from "lucide-react";
import type { FullBalanceResponse } from "@/types/balance";
import { EmptyStateCard } from "@/components/gidede/shared";

interface CorrectionsPanelTabProps {
  result: FullBalanceResponse | null;
}

export function CorrectionsPanelTab({ result }: CorrectionsPanelTabProps) {
  if (!result) {
    return (
      <EmptyStateCard
        icon={Wrench}
        title="Run the analysis to see corrections and recommendations"
        description="Warnings, suggestions, and AI-generated fixes"
      />
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
