"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Layers } from "lucide-react";
import { HIERARCHY_LEVELS } from "@/constants/coreloop";

export function LoopHierarchyTree({ hierarchy }: { hierarchy: Record<string, unknown> }) {
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set(["small"]));

  const toggleLevel = (level: string) => {
    setExpandedLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          Иерархия петель (Этап 2)
        </CardTitle>
        <CardDescription>
          Алгоритм 3.2 Этап 2 — 6 уровней: микро → мета
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {HIERARCHY_LEVELS.map((level) => {
          const loops = hierarchy[level.key] as Record<string, unknown>[] | undefined;
          const loopCount = loops?.length || 0;
          const isExpanded = expandedLevels.has(level.key);
          const LevelIcon = level.icon;

          return (
            <div key={level.key} className="rounded-md border">
              <button
                className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                onClick={() => toggleLevel(level.key)}
              >
                <LevelIcon className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium flex-1">{level.label}</span>
                <span className="text-xs text-muted-foreground">{level.timeScale}</span>
                <Badge variant="secondary" className="text-xs">{loopCount}</Badge>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </button>
              {isExpanded && loops && loops.length > 0 && (
                <div className="border-t px-3 pb-3 pt-2 space-y-2">
                  {loops.map((loop, i) => {
                    const actions = (loop.actions as string[]) || [];
                    const parentStep = (loop.parent_step as string) || "";
                    return (
                      <div key={i} className="rounded-md bg-muted/30 p-2.5 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">Петля {i + 1}</span>
                          {parentStep && (
                            <Badge variant="outline" className="text-[10px]">
                              родитель: {parentStep}
                            </Badge>
                          )}
                        </div>
                        {actions.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {actions.map((a, ai) => (
                              <span key={ai} className="text-[11px] bg-background rounded px-1.5 py-0.5 border">
                                {a}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {isExpanded && (!loops || loops.length === 0) && (
                <div className="border-t px-3 py-3 text-xs text-muted-foreground text-center">
                  Нет петель на этом уровне
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
