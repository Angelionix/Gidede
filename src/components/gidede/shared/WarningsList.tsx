"use client";

import { AlertTriangle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Переиспользуемый список предупреждений.
 * Используется во всех 5 блоках.
 */
export function WarningsList({
  warnings,
  maxRows = 8,
}: {
  warnings: string[];
  maxRows?: number;
}) {
  if (warnings.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          Warnings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 max-h-40 overflow-y-auto">
        {warnings.slice(0, maxRows).map((w, i) => (
          <div
            key={i}
            className="flex items-start gap-2 text-xs rounded-md bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 p-2"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
            <span>{w}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
