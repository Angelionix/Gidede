"use client";

import type { LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

/**
 * Переиспользуемая карточка «пустого состояния».
 * Показывается, когда анализ ещё не запущен.
 */
export function EmptyStateCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <Card>
      <CardContent className="py-12 text-center text-muted-foreground">
        <Icon className="h-12 w-12 mx-auto mb-3 opacity-20" />
        <p>{title}</p>
        {description && <p className="text-xs mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}
