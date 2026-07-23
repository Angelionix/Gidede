"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DynamicsProfile } from "../../../../shared/types/typescript/interfaces";

export function DynamicsProfileCard({ dynamicsProfile }: { dynamicsProfile: DynamicsProfile }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Профиль динамик</CardTitle>
        <CardDescription>
          Алгоритм 3.1 Этап 3 — вывод динамик из эстетик
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Основные динамики</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {dynamicsProfile.core_dynamics?.map((d, i) => (
              <Badge key={i} variant="default">{d}</Badge>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Поддерживающие динамики</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {dynamicsProfile.supporting_dynamics?.map((d, i) => (
              <Badge key={i} variant="outline">{d}</Badge>
            ))}
          </div>
        </div>
        {dynamicsProfile.rationale && (
          <p className="text-sm text-muted-foreground">{dynamicsProfile.rationale}</p>
        )}
      </CardContent>
    </Card>
  );
}
