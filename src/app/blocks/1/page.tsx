"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lightbulb, Construction } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const GENRES = [
  "Шутер", "Платформер", "RPG", "Стратегия", "Квест/Пазл",
  "Выживание", "Roguelike", "Симулятор", "MMO", "Хоррор",
  "Гонки", "Спорт", "Fighting", "Stealth", "Rhythm",
  "Party", "Educational", "Action-Adventure", "Sandbox", "Tower Defense",
];

export default function Block1Page() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Lightbulb className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Генератор концепции</h1>
          <p className="text-sm text-muted-foreground">
            Блок 1 • Алгоритм 3.1 • 7 этапов
          </p>
        </div>
        <Badge variant="outline" className="text-yellow-600 ml-auto">
          <Construction className="h-3 w-3 mr-1" />
          Скелет API
        </Badge>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Ввод идеи</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="idea">Опишите идею игры (1–5 предложений)</Label>
            <Textarea
              id="idea"
              placeholder="Например: Roguelike про алхимика, который варит зелья и сражается с монстрами в процедурно генерируемых подземельях..."
              className="mt-1.5 min-h-[100px]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Жанр</Label>
              <Select>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Определить автоматически" />
                </SelectTrigger>
                <SelectContent>
                  {GENRES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Платформа</Label>
              <Select>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Выберите платформу" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pc">PC</SelectItem>
                  <SelectItem value="mobile">Mobile</SelectItem>
                  <SelectItem value="console">Console</SelectItem>
                  <SelectItem value="multi">Мультиплатформа</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Референтные игры (через запятую)</Label>
            <Input
              placeholder="Hades, Binding of Isaac, Slay the Spire"
              className="mt-1.5"
            />
          </div>

          <Button className="w-full" disabled>
            Сгенерировать концепцию (доступно после 4.B.2)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-muted-foreground">
            Результат генерации
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>Введите идею и нажмите «Сгенерировать концепцию»</p>
            <p className="text-xs mt-1">
              Backend-реализация — Фаза 4.B.2–4.B.4
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
