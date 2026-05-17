"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Construction } from "lucide-react";
export default function Block5Page() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <TrendingUp className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Экономика и прогрессия</h1>
          <p className="text-sm text-muted-foreground">Блок 5 • Алгоритмы 3.5–3.6</p>
        </div>
        <Badge variant="outline" className="text-yellow-600 ml-auto">
          <Construction className="h-3 w-3 mr-1" />Скелет API
        </Badge>
      </div>
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-20" />
        <p>Модуль экономики и прогрессии будет реализован в Фазе 4.C</p>
        <p className="text-xs mt-1">Реализация — Фаза 4.C.5–4.C.8</p>
      </CardContent></Card>
    </div>
  );
}
