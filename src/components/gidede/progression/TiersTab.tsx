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
import { ArrowRight, Milestone } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProgressionDesignResponse } from "@/types/progression";
import { EmptyStateCard } from "@/components/gidede/shared";

interface TiersTabProps {
  result: ProgressionDesignResponse | null;
}

export const TiersTab = React.memo(function TiersTab({ result }: TiersTabProps) {
  if (!result?.tier_model) {
    return (
      <EmptyStateCard
        icon={Milestone}
        title="Спроектируйте прогрессию для просмотра этапов"
        description="Структура этапов и переходов"
      />
    );
  }

  const tiers = result.tier_model.tiers || [];
  const transitionMap = result.tier_model.transition_map || {};

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Milestone className="h-5 w-5 text-primary" />
            Этапы прогрессии ({tiers.length})
          </CardTitle>
          <CardDescription>Всего уровней: {result.tier_model.total_levels}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Этап</TableHead>
                  <TableHead>Диапазон уровней</TableHead>
                  <TableHead>Масштаб</TableHead>
                  <TableHead>Доминантная механика</TableHead>
                  <TableHead>Тип баланса</TableHead>
                  <TableHead>Кривая сложности</TableHead>
                  <TableHead>Состояние ресурсов</TableHead>
                  <TableHead>Триггер перехода</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiers.map((tier, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-sm">{tier.index}</TableCell>
                    <TableCell className="text-sm">
                      {tier.level_range ? `${tier.level_range[0]}–${tier.level_range[1]}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      <Badge variant="outline" className="text-xs">{tier.scale || "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{tier.dominant_mechanic || "—"}</TableCell>
                    <TableCell className="text-sm">{tier.balance_type || "—"}</TableCell>
                    <TableCell className="text-sm">{tier.difficulty_curve || "—"}</TableCell>
                    <TableCell className="text-sm">{tier.resource_state || "—"}</TableCell>
                    <TableCell className="text-sm">{tier.transition_trigger || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Transition Map */}
      {Object.keys(transitionMap).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-primary" />
              Карта переходов
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(transitionMap).map(([from, to]) => (
                <div key={from} className="flex items-center gap-1.5 text-xs rounded-md border p-2">
                  <Badge variant="outline" className="text-[10px]">{from}</Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="outline" className="text-[10px]">{to}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
});
