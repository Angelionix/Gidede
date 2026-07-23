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
import { Check, Eye, Zap } from "lucide-react";
import { LOOP_TYPE_LABELS } from "@/constants/concept";

export const CoreLoopCandidates = React.memo(function CoreLoopCandidates({
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
});
