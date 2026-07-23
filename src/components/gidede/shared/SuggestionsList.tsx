"use client";

import { Info, Lightbulb } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Переиспользуемый список предложений.
 * Используется во всех 5 блоках.
 */
export function SuggestionsList({
  suggestions,
  maxRows = 8,
  variant = "card",
}: {
  suggestions: string[];
  maxRows?: number;
  variant?: "card" | "inline";
}) {
  if (suggestions.length === 0) return null;

  if (variant === "inline") {
    return (
      <div className="space-y-1.5">
        {suggestions.slice(0, maxRows).map((s, i) => (
          <div
            key={i}
            className="flex items-start gap-2 text-xs rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-2"
          >
            <Info className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
            <span>{s}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-blue-500" />
          Suggestions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 max-h-40 overflow-y-auto">
        {suggestions.slice(0, maxRows).map((s, i) => (
          <div
            key={i}
            className="flex items-start gap-2 text-xs rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-2"
          >
            <Info className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
            <span>{s}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
