"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Coins, Sparkles, Package } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EconomyDesignResponse } from "@/types/economy";
import { EmptyStateCard } from "@/components/gidede/shared";

interface ResourcesTabProps {
  result: EconomyDesignResponse | null;
}

export const ResourcesTab = React.memo(function ResourcesTab({ result }: ResourcesTabProps) {
  if (!result?.inventory) {
    return (
      <EmptyStateCard
        icon={Coins}
        title="Спроектируйте экономику для просмотра ресурсов"
        description="Инвентарь ресурсов и их свойства"
      />
    );
  }

  const inv = result.inventory;
  const resources = inv.resources || [];
  const coreResources = resources.filter((r) => r.resource_class === "core");
  const subsidiaryResources = resources.filter((r) => r.resource_class !== "core");

  const renderResourceTable = (items: typeof resources, title: string) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          {title === "Core" ? <Sparkles className="h-4 w-4 text-primary" /> : <Package className="h-4 w-4 text-muted-foreground" />}
          {title} ресурсы ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Имя</TableHead>
                <TableHead>Класс</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead className="text-right">Нач. значение</TableHead>
                <TableHead>Границы</TableHead>
                <TableHead className="text-center">Расходуемый</TableHead>
                <TableHead className="text-center">Катализатор</TableHead>
                <TableHead className="text-center">Якорь</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-sm">{r.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">{r.resource_class}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{r.resource_type}</TableCell>
                  <TableCell className="text-right text-sm">{r.initial_value}</TableCell>
                  <TableCell className="text-xs">
                    [{r.bounds?.min ?? "—"}, {r.bounds?.max ?? "—"}]
                  </TableCell>
                  <TableCell className="text-center">
                    {r.is_consumable ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />}
                  </TableCell>
                  <TableCell className="text-center">
                    {r.is_catalytic ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />}
                  </TableCell>
                  <TableCell className="text-center">
                    {r.is_anchor ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Якоревой ресурс</p>
            <Badge variant="outline" className="text-sm font-semibold">{inv.anchor || "—"}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex justify-center gap-6">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Core</p>
                <p className="text-lg font-bold">{inv.core_count ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Subsidiary</p>
                <p className="text-lg font-bold">{inv.subsidiary_count ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      {coreResources.length > 0 && renderResourceTable(coreResources, "Core")}
      {subsidiaryResources.length > 0 && renderResourceTable(subsidiaryResources, "Дополнительные")}
    </div>
  );
});
