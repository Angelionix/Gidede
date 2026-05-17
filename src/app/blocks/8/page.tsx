"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Puzzle } from "lucide-react";
export default function Block8Page() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Puzzle className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Интеграция GBE</h1>
          <p className="text-sm text-muted-foreground">Блок 8</p>
        </div>
        <Badge variant="outline" className="text-gray-400 ml-auto">Запланирован</Badge>
      </div>
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        <Puzzle className="h-12 w-12 mx-auto mb-3 opacity-20" />
        <p>Интеграция с GDCombine будет реализована в Фазе 4.E</p>
      </CardContent></Card>
    </div>
  );
}
