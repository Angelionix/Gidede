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
import { Brain } from "lucide-react";
import type { EconomyDesignResponse } from "@/types/economy";
import { ECONOMIC_TYPE_COLORS } from "@/constants/economy";
import { EmptyStateCard } from "@/components/gidede/shared";

interface ClassificationTabProps {
  result: EconomyDesignResponse | null;
}

export const ClassificationTab = React.memo(function ClassificationTab({ result }: ClassificationTabProps) {
  if (!result?.classification) {
    return (
      <EmptyStateCard
        icon={Brain}
        title="Спроектируйте экономику для просмотра классификации"
        description="Тип экономики и её свойства"
      />
    );
  }

  const cls = result.classification;
  const fields: Array<{ key: string; label: string; value: unknown; isBadge?: boolean }> = [
    { key: "type", label: "Экономический тип", value: cls.type, isBadge: true },
    { key: "sub_type", label: "Подтип", value: cls.sub_type },
    { key: "dominant_loop", label: "Доминантный цикл", value: cls.dominant_loop },
    { key: "interaction_type", label: "Тип взаимодействия", value: cls.interaction_type },
    { key: "openness", label: "Открытость", value: cls.openness },
    { key: "pricing_type", label: "Тип ценообразования", value: cls.pricing_type },
    { key: "risk_level", label: "Уровень риска", value: cls.risk_level },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Классификация экономики
          </CardTitle>
          <CardDescription>Тип и характеристики экономической системы</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fields.map((field) => {
              const typeColor = field.isBadge && ECONOMIC_TYPE_COLORS[String(field.value)]
                ? ECONOMIC_TYPE_COLORS[String(field.value)]
                : "";
              return (
                <div key={field.key} className="flex items-center justify-between rounded-md border p-3">
                  <span className="text-xs text-muted-foreground">{field.label}</span>
                  {typeColor ? (
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${typeColor}`}>
                      {String(field.value ?? "—")}
                    </span>
                  ) : (
                    <Badge variant="outline" className="text-xs font-semibold">{String(field.value ?? "—")}</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
