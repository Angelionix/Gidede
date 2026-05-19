"use client";

import {
  CircleDot,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Shield,
  Zap,
  Target,
} from "lucide-react";

/**
 * Иконка для типа узла Machinations.
 * Используется в блоках 4 (Баланс) и 5 (Экономика).
 */
export function NodeTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "pool":
    case "resource":
      return <CircleDot className="h-4 w-4 text-blue-500" />;
    case "source":
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case "drain":
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    case "converter":
      return <RotateCcw className="h-4 w-4 text-amber-500" />;
    case "gate":
      return <Shield className="h-4 w-4 text-purple-500" />;
    case "trigger":
      return <Zap className="h-4 w-4 text-yellow-500" />;
    case "end_condition":
      return <Target className="h-4 w-4 text-rose-500" />;
    default:
      return <CircleDot className="h-4 w-4 text-muted-foreground" />;
  }
}
