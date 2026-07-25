"use client";

/**
 * Gidede — "Loaded from DB" indicator (Task 14)
 *
 * Small badge shown when a block page displays a previously-generated
 * (stored) result rather than a freshly-generated one. Keeps the wording
 * consistent across all six blocks.
 */

import { Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function LoadedFromDbBadge() {
  return (
    <Badge
      variant="outline"
      className="text-[10px] border-amber-400 text-amber-700 dark:text-amber-300 gap-1"
      title="Данные загружены из базы данных, а не сгенерированы в текущей сессии"
    >
      <Database className="h-3 w-3" />
      Загружено из БД
    </Badge>
  );
}
