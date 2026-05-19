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
import { Target } from "lucide-react";
import type { ProgressionDesignResponse } from "@/types/progression";
import { EmptyStateCard } from "@/components/gidede/shared";

interface MacroParamsTabProps {
  result: ProgressionDesignResponse | null;
}

export function MacroParamsTab({ result }: MacroParamsTabProps) {
  if (!result?.macro_model) {
    return (
      <EmptyStateCard
        icon={Target}
        title="Спроектируйте прогрессию для просмотра макро-параметров"
        description="Общие параметры модели прогрессии"
      />
    );
  }

  const macro = result.macro_model;
  const entries: Array<{ key: string; label: string; value: unknown }> = [
    { key: "total_levels", label: "Всего уровней", value: macro.total_levels },
    { key: "target_duration", label: "Целевая длительность (ч)", value: macro.target_duration },
    { key: "progression_type", label: "Тип прогрессии", value: macro.progression_type },
    { key: "content_requirements", label: "Требования к контенту", value: macro.content_requirements },
    { key: "emergence_ratio", label: "Коэффициент эмергентности", value: macro.emergence_ratio },
    { key: "lock_key_model", label: "Модель Lock-Key", value: macro.lock_key_model },
    { key: "monetization_model", label: "Модель монетизации", value: macro.monetization_model },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Макро-параметры прогрессии
          </CardTitle>
          <CardDescription>Ключевые параметры модели прогрессии</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {entries.map((entry) => (
              <div key={entry.key} className="flex items-center justify-between rounded-md border p-3">
                <span className="text-xs text-muted-foreground">{entry.label}</span>
                <Badge variant="outline" className="text-xs font-semibold">
                  {entry.value != null ? String(entry.value) : "—"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
