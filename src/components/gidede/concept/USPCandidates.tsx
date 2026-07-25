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
import { Check, CheckCircle2, XCircle, Info } from "lucide-react";

export const USPCandidates = React.memo(function USPCandidates({
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
        <CardTitle className="text-base">Кандидаты USP</CardTitle>
        <CardDescription>
          Алгоритм 3.1 Этап 5 — выберите один вариант USP
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {candidates.map((candidate, i) => {
          const usp = (candidate.usp as string) || "";
          const triangleCheck = (candidate.triangle_check as Record<string, unknown>) || (candidate.triangle_of_weirdness_check as Record<string, unknown>) || {};
          const competitiveDiff = (candidate.competitive_differentiation as string) || "";
          const isSelected = selectedIndex === i;

          // Determine weird/appealing/credible from triangle_check
          const weird = triangleCheck.weird ?? triangleCheck.weirdness ?? null;
          const appealing = triangleCheck.appealing ?? null;
          const credible = triangleCheck.credible ?? null;

          const boolToIndicator = (val: unknown) => {
            if (val === true || val === "pass" || val === "yes") return "pass";
            if (val === false || val === "fail" || val === "no") return "fail";
            return "unknown";
          };

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
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium leading-relaxed">{usp || `USP вариант ${i + 1}`}</p>
                {isSelected && (
                  <Badge className="text-xs bg-primary text-primary-foreground shrink-0">
                    <Check className="h-3 w-3 mr-1" />
                    Выбрано
                  </Badge>
                )}
              </div>

              {/* Triangle check indicators */}
              {(weird !== null || appealing !== null || credible !== null) && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">Triangle:</span>
                  {weird !== null && (
                    <span className="flex items-center gap-1 text-xs">
                      {boolToIndicator(weird) === "pass" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      ) : boolToIndicator(weird) === "fail" ? (
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                      ) : (
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      Странность
                    </span>
                  )}
                  {appealing !== null && (
                    <span className="flex items-center gap-1 text-xs">
                      {boolToIndicator(appealing) === "pass" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      ) : boolToIndicator(appealing) === "fail" ? (
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                      ) : (
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      Привлекательность
                    </span>
                  )}
                  {credible !== null && (
                    <span className="flex items-center gap-1 text-xs">
                      {boolToIndicator(credible) === "pass" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      ) : boolToIndicator(credible) === "fail" ? (
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                      ) : (
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      Достоверность
                    </span>
                  )}
                </div>
              )}

              {/* Competitive differentiation */}
              {competitiveDiff && (
                <p className="text-xs text-muted-foreground">{competitiveDiff}</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
});
