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
import { Check, AlertTriangle, Shield, Info, Layers } from "lucide-react";
import { LOOP_TYPE_BADGES } from "@/constants/coreloop";

export function StructuralTypeCard({ structuralType }: { structuralType: Record<string, unknown> }) {
  const typeStr = (structuralType.type as string) || "hybrid";
  const subType = (structuralType.sub_type as string) || "";
  const hasBraking = structuralType.has_braking as boolean;
  const currencies = (structuralType.currencies as string[]) || [];
  const resources = (structuralType.resources as Record<string, unknown>[]) || [];
  const riskAssessment = structuralType.risk_assessment as Record<string, unknown> | undefined;
  const loops = (structuralType.loops as Record<string, unknown>[]) || [];

  const typeBadge = LOOP_TYPE_BADGES[typeStr] || LOOP_TYPE_BADGES.hybrid;
  const TypeIcon = typeBadge.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          Структурный тип (Этап 1)
        </CardTitle>
        <CardDescription>
          Алгоритм 3.2 Этап 1 — классификация структурного типа Core Loop
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Type & Subtype */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${typeBadge.color}`}>
            <TypeIcon className="h-4 w-4" />
            {typeBadge.label}
          </span>
          {subType && (
            <Badge variant="outline" className="text-xs">{subType.replace(/_/g, " ")}</Badge>
          )}
          {hasBraking ? (
            <Badge variant="outline" className="text-xs border-green-400 text-green-700 dark:text-green-400">
              <Check className="h-3 w-3 mr-1" />
              Торможение
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs border-yellow-400 text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Без торможения
            </Badge>
          )}
        </div>

        {/* Currencies */}
        {currencies.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Валюты</p>
            <div className="flex flex-wrap gap-1.5">
              {currencies.map((c, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Resources */}
        {resources.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">
              Ресурсы ({resources.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {resources.map((r, i) => {
                const name = (r.name as string) || `Ресурс ${i + 1}`;
                const class_ = (r.class_ as string) || (r.class as string) || "";
                return (
                  <Badge key={i} variant="outline" className="text-xs">
                    {name}
                    {class_ && <span className="ml-1 text-muted-foreground">({class_})</span>}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Loops overview */}
        {loops.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Петли</p>
            <div className="space-y-1.5">
              {loops.map((loop, i) => {
                const loopType = (loop.type as string) || "";
                const desc = (loop.description as string) || "";
                return (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="text-xs">{loopType}</Badge>
                    <span className="text-muted-foreground">{desc}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Risk Assessment */}
        {riskAssessment && (
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Оценка рисков</span>
              <Badge
                variant="outline"
                className={`text-xs ${
                  riskAssessment.risk_level === "high"
                    ? "border-red-400 text-red-700 dark:text-red-400"
                    : riskAssessment.risk_level === "medium"
                      ? "border-yellow-400 text-yellow-700 dark:text-yellow-400"
                      : "border-green-400 text-green-700 dark:text-green-400"
                }`}
              >
                {(riskAssessment.risk_level as string) || "low"}
              </Badge>
            </div>
            {Array.isArray(riskAssessment.likely_pathologies) && riskAssessment.likely_pathologies.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {(riskAssessment.likely_pathologies as string[]).map((p, i) => (
                  <Badge key={i} variant="outline" className="text-xs border-yellow-400 text-yellow-700 dark:text-yellow-400">
                    {p}
                  </Badge>
                ))}
              </div>
            )}
            {Array.isArray(riskAssessment.mitigation_suggestions) && riskAssessment.mitigation_suggestions.length > 0 && (
              <div className="space-y-1">
                {(riskAssessment.mitigation_suggestions as string[]).map((s, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Info className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
