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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AlertTriangle, Zap } from "lucide-react";
import { MECHANIC_GROUPS } from "@/constants/concept";

export const MechanicSetView = React.memo(function MechanicSetView({ mechanicSet }: { mechanicSet: Record<string, unknown> }) {
  const compatibilityScore = typeof mechanicSet.compatibility_score === "number" ? mechanicSet.compatibility_score : 0;
  const conflictsResolved = Array.isArray(mechanicSet.conflicts_resolved) ? mechanicSet.conflicts_resolved as string[] : [];
  const synergiesDetected = Array.isArray(mechanicSet.synergies_detected) ? mechanicSet.synergies_detected as Record<string, unknown>[] : [];
  const warnings = Array.isArray(mechanicSet.warnings) ? mechanicSet.warnings as string[] : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Набор механик (MechanicsDB)</CardTitle>
        <CardDescription>
          Алгоритм 3.1 Этап 4 — выбор механик из базы
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Compatibility score */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-muted-foreground">Совместимость механик</span>
            <span className="text-sm font-semibold">{compatibilityScore}%</span>
          </div>
          <Progress value={compatibilityScore} className="h-2.5" />
        </div>

        {/* Conflicts & Synergies */}
        <div className="flex flex-wrap gap-2">
          {conflictsResolved.map((c, i) => (
            <Badge key={i} variant="outline" className="text-xs border-yellow-400 text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {c}
            </Badge>
          ))}
          {synergiesDetected.map((s, i) => {
            const label = typeof s === "string" ? s : ((s as Record<string, unknown>).name as unknown as string || s as unknown as string || `Синергия ${i + 1}`);
            return (
              <Badge key={i} variant="outline" className="text-xs border-green-400 text-green-700 dark:text-green-400">
                <Zap className="h-3 w-3 mr-1" />
                {label}
              </Badge>
            );
          })}
        </div>

        {/* Mechanic groups in accordion */}
        <Accordion type="multiple" className="w-full">
          {MECHANIC_GROUPS.map((group) => {
            const items = mechanicSet[group.key];
            if (!Array.isArray(items) || items.length === 0) return null;
            return (
              <AccordionItem key={group.key} value={group.key}>
                <AccordionTrigger className="text-sm">
                  <span className="flex items-center gap-2">
                    {group.label}
                    <Badge variant="secondary" className="text-xs ml-1">{items.length}</Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-1">
                    {items.map((mech, i) => {
                      const m = mech as Record<string, unknown>;
                      const name = (m.name as unknown as string) || (m as unknown as string) || `Механика ${i + 1}`;
                      const groupVal = (m.group as string) || group.key;
                      const description = (m.description as string) || "";
                      return (
                        <div key={i} className="rounded-md border p-3 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{name}</span>
                            <Badge variant="outline" className="text-xs">{groupVal}</Badge>
                          </div>
                          {description && (
                            <p className="text-xs text-muted-foreground">{description}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="space-y-1.5">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
