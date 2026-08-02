"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * R7-07: Algorithm trace UI component.
 *
 * Displays the algorithm_metadata (method, assumptions, evidence,
 * confidence) for each pipeline stage's scores. Users can see exactly
 * how each score was computed and what assumptions were made.
 */

export interface AlgorithmScoreTrace {
  path: string;
  method: string;
  assumptions: string[];
}

export interface AlgorithmStageTrace {
  stage: string;
  scores: AlgorithmScoreTrace[];
}

interface AlgorithmTracePanelProps {
  stages: AlgorithmStageTrace[];
}

const METHOD_COLORS: Record<string, string> = {
  template: "bg-gray-200 text-gray-800",
  heuristic: "bg-blue-100 text-blue-800",
  simulation: "bg-purple-100 text-purple-800",
  solver: "bg-green-100 text-green-800",
  playtest_evidence: "bg-orange-100 text-orange-800",
  llm_generated: "bg-pink-100 text-pink-800",
};

export function AlgorithmTracePanel({ stages }: AlgorithmTracePanelProps) {
  if (!stages || stages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Algorithm Trace</CardTitle>
          <CardDescription>Нет данных о provenance алгоритмов</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Algorithm Trace</CardTitle>
        <CardDescription>
          Provenance каждого score: method, assumptions и evidence
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-96">
          <div className="space-y-4">
            {stages.map((stage) => (
              <div key={stage.stage}>
                <h4 className="text-sm font-semibold capitalize mb-2">
                  {stage.stage.replace(/_/g, " ")}
                </h4>
                <div className="space-y-2">
                  {stage.scores.map((score) => (
                    <div
                      key={score.path}
                      className="border-l-2 border-muted pl-3 py-1"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-xs text-muted-foreground">
                          {score.path}
                        </code>
                        <Badge
                          variant="secondary"
                          className={`text-xs ${METHOD_COLORS[score.method] ?? "bg-gray-100 text-gray-800"}`}
                        >
                          {score.method}
                        </Badge>
                      </div>
                      {score.assumptions.length > 0 && (
                        <ul className="text-xs text-muted-foreground space-y-0.5">
                          {score.assumptions.map((assumption, i) => (
                            <li key={i}>• {assumption}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
                <Separator className="mt-3" />
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
