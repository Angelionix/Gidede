"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import type { AestheticProfile } from "../../../../shared/types/typescript/interfaces";
import { AestheticBadge } from "./AestheticBadge";

export const AestheticProfileView = React.memo(function AestheticProfileView({ profile }: { profile: AestheticProfile }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Эстетический профиль (Reverse MDA)</CardTitle>
        <CardDescription>
          Алгоритм 3.1 Этап 2 — определение целевых эстетических ценностей
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground w-16 shrink-0">Основная</span>
            <AestheticBadge value={profile.primary} level="primary" />
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground hidden sm:block shrink-0" />
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground w-16 shrink-0">Вторичная</span>
            <AestheticBadge value={profile.secondary} level="secondary" />
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground hidden sm:block shrink-0" />
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground w-16 shrink-0">Третичная</span>
            <AestheticBadge value={profile.tertiary} level="tertiary" />
          </div>
        </div>
        {profile.rationale && (
          <p className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
            {profile.rationale}
          </p>
        )}
      </CardContent>
    </Card>
  );
});
