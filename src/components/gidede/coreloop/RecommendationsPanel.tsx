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
import { Wrench } from "lucide-react";
import { PRIORITY_STYLES } from "@/constants/coreloop";
import { EmptyStateCard } from "@/components/gidede/shared";

export function RecommendationsPanel({ recommendations }: { recommendations: Record<string, unknown>[] }) {
  if (!recommendations || recommendations.length === 0) {
    return (
      <EmptyStateCard
        icon={Wrench}
        title="Нет рекомендаций — Core Loop прошёл валидацию"
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          Рекомендации (Этап 5)
        </CardTitle>
        <CardDescription>
          Алгоритм 3.2 Этап 5 — формализованные + AI-рекомендации
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {recommendations.map((rec, i) => {
          const target = (rec.target as string) || "";
          const recommendation = (rec.recommendation as string) || (rec.description as string) || "";
          const priority = (rec.priority as string) || "medium";
          const category = (rec.category as string) || "";
          const source = (rec.source as string) || "formal";

          return (
            <div key={i} className="rounded-md border p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{target}</span>
                  {category && (
                    <Badge variant="outline" className="text-[10px]">{category}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_STYLES[priority] || PRIORITY_STYLES.medium}`}>
                    {priority}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {source === "ai" ? "AI" : "Формал."}
                  </Badge>
                </div>
              </div>
              {recommendation && (
                <p className="text-xs text-muted-foreground">{recommendation}</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
