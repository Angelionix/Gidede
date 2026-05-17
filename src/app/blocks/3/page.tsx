"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, Construction } from "lucide-react";
export default function Block3Page() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <FlaskConical className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">MDA Lab</h1>
          <p className="text-sm text-muted-foreground">Блок 3 • Алгоритм 3.3</p>
        </div>
        <Badge variant="outline" className="text-yellow-600 ml-auto">
          <Construction className="h-3 w-3 mr-1" />Скелет API
        </Badge>
      </div>
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        <FlaskConical className="h-12 w-12 mx-auto mb-3 opacity-20" />
        <p>MDA Lab будет доступен после реализации концепции и Core Loop</p>
        <p className="text-xs mt-1">Реализация — Фаза 4.B.9–4.B.11</p>
      </CardContent></Card>
    </div>
  );
}
