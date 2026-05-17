"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Construction } from "lucide-react";

export default function Block2Page() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <RefreshCw className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Core Loop Designer</h1>
          <p className="text-sm text-muted-foreground">
            Блок 2 • Алгоритм 3.2 • 5 этапов
          </p>
        </div>
        <Badge variant="outline" className="text-yellow-600 ml-auto">
          <Construction className="h-3 w-3 mr-1" />
          Скелет API
        </Badge>
      </div>

      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <RefreshCw className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Сначала создайте концепцию в Блоке 1</p>
          <p className="text-xs mt-1">Реализация — Фаза 4.B.6–4.B.8</p>
        </CardContent>
      </Card>
    </div>
  );
}
