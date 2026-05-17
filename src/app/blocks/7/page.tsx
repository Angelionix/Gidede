"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Construction } from "lucide-react";
export default function Block7Page() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Bot className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">AI-ассистент</h1>
          <p className="text-sm text-muted-foreground">Блок 7 • Спецификация 3.9</p>
        </div>
        <Badge variant="outline" className="text-yellow-600 ml-auto">
          <Construction className="h-3 w-3 mr-1" />Скелет API
        </Badge>
      </div>
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        <Bot className="h-12 w-12 mx-auto mb-3 opacity-20" />
        <p>AI-ассистент будет реализован в Фазе 4.D</p>
      </CardContent></Card>
    </div>
  );
}
