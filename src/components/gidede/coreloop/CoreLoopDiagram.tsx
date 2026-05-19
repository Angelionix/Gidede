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
import { RefreshCw } from "lucide-react";
import { EmptyStateCard } from "@/components/gidede/shared";

export function CoreLoopDiagram({ steps }: { steps: Record<string, unknown>[] }) {
  if (!steps || steps.length === 0) {
    return (
      <EmptyStateCard
        icon={RefreshCw}
        title="Шаги Core Loop не определены"
      />
    );
  }

  const stepCount = steps.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" />
          Core Loop — диаграмма шагов
        </CardTitle>
        <CardDescription>
          Визуализация цикла из {stepCount} шагов. Последний шаг ведёт к первому.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Circular diagram using CSS */}
        <div className="flex justify-center mb-4">
          <div className="relative" style={{ width: 320, height: 320 }}>
            {steps.map((step, i) => {
              const action = (step.action as string) || `Шаг ${i + 1}`;
              const mechanics = (step.mechanics as string[]) || [];
              const feedbackType = (step.feedback_type as string) || "neutral";

              // Calculate position in circle
              const angle = (2 * Math.PI * i) / stepCount - Math.PI / 2;
              const radius = 120;
              const x = 160 + radius * Math.cos(angle) - 50;
              const y = 160 + radius * Math.sin(angle) - 30;

              const feedbackColor =
                feedbackType === "positive"
                  ? "border-green-400 bg-green-50 dark:bg-green-950/30"
                  : feedbackType === "negative"
                    ? "border-red-400 bg-red-50 dark:bg-red-950/30"
                    : "border-blue-400 bg-blue-50 dark:bg-blue-950/30";

              return (
                <div
                  key={i}
                  className={`absolute w-[100px] rounded-lg border-2 p-2 text-center shadow-sm ${feedbackColor}`}
                  style={{ left: x, top: y }}
                >
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                      {i + 1}
                    </span>
                  </div>
                  <p className="text-xs font-medium leading-tight">{action}</p>
                  {mechanics.length > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {mechanics.slice(0, 2).join(", ")}
                    </p>
                  )}
                </div>
              );
            })}
            {/* Center label */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <RefreshCw className="h-6 w-6 text-primary mx-auto mb-1 opacity-40" />
                <p className="text-xs text-muted-foreground">Core Loop</p>
                <p className="text-[10px] text-muted-foreground">{stepCount} шагов</p>
              </div>
            </div>
            {/* Arrows between steps (simplified as lines) */}
            <svg className="absolute inset-0 pointer-events-none" width="320" height="320">
              {steps.map((_, i) => {
                const fromAngle = (2 * Math.PI * i) / stepCount - Math.PI / 2;
                const toAngle = (2 * Math.PI * ((i + 1) % stepCount)) / stepCount - Math.PI / 2;
                const radius = 120;
                const fromX = 160 + radius * Math.cos(fromAngle);
                const fromY = 160 + radius * Math.sin(fromAngle);
                const toX = 160 + radius * Math.cos(toAngle);
                const toY = 160 + radius * Math.sin(toAngle);
                return (
                  <line
                    key={i}
                    x1={fromX}
                    y1={fromY}
                    x2={toX}
                    y2={toY}
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-muted-foreground/30"
                    markerEnd="url(#arrowhead)"
                  />
                );
              })}
              <defs>
                <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" className="fill-muted-foreground/30" />
                </marker>
              </defs>
            </svg>
          </div>
        </div>

        {/* Steps detail list */}
        <div className="space-y-2">
          {steps.map((step, i) => {
            const action = (step.action as string) || `Шаг ${i + 1}`;
            const mechanics = (step.mechanics as string[]) || [];
            const consumed = (step.resources_consumed as string[]) || [];
            const produced = (step.resources_produced as string[]) || [];
            const duration = (step.duration_estimate as number) || 0;
            return (
              <div key={i} className="rounded-md border p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium">{action}</span>
                  </div>
                  {duration > 0 && (
                    <span className="text-xs text-muted-foreground">~{duration}с</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 pl-7">
                  {mechanics.map((m, mi) => (
                    <Badge key={mi} variant="outline" className="text-[10px]">{m}</Badge>
                  ))}
                  {consumed.length > 0 && consumed.map((r, ri) => (
                    <Badge key={`c${ri}`} variant="outline" className="text-[10px] border-red-300 text-red-700 dark:text-red-400">
                      -{r}
                    </Badge>
                  ))}
                  {produced.length > 0 && produced.map((r, ri) => (
                    <Badge key={`p${ri}`} variant="outline" className="text-[10px] border-green-300 text-green-700 dark:text-green-400">
                      +{r}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
