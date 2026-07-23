"use client";

import type { LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

/**
 * Переиспользуемая карточка «пустого состояния».
 * Показывается, когда анализ ещё не запущен.
 *
 * Enhancements (4.E.5):
 * - Fade-in animation on appear
 * - Larger icon for better visual hierarchy
 * - Subtle call-to-action styling
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
    <Card className="animate-fade-in">
      <CardContent className="py-14 text-center text-muted-foreground">
        <Icon className="h-16 w-16 mx-auto mb-4 opacity-20" />
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="text-xs mt-2 max-w-md mx-auto leading-relaxed opacity-80">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
