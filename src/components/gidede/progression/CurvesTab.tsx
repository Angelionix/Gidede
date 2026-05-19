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
import { TrendingUp } from "lucide-react";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import type { ProgressionDesignResponse } from "@/types/progression";
import { EmptyStateCard } from "@/components/gidede/shared";

interface CurvesTabProps {
  result: ProgressionDesignResponse | null;
}

export function CurvesTab({ result }: CurvesTabProps) {
  if (!result?.curves) {
    return (
      <EmptyStateCard
        icon={TrendingUp}
        title="Спроектируйте прогрессию для просмотра кривых"
        description="XP→Level, Level→Power, Level→Cost, Difficulty"
      />
    );
  }

  const curves = result.curves;
  const curveEntries = [
    { key: "xp_to_level", label: "XP → Уровень", data: curves.xp_to_level },
    { key: "level_to_power", label: "Уровень → Мощь", data: curves.level_to_power },
    { key: "level_to_cost", label: "Уровень → Стоимость", data: curves.level_to_cost },
    { key: "difficulty", label: "Сложность", data: curves.difficulty },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {curveEntries.map((entry) => {
          const curve = entry.data;
          const points = curve?.points || [];
          const chartData = points.map((val, i) => ({ level: i + 1, value: val }));
          const params = curve?.parameters || {};

          return (
            <Card key={entry.key}>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  {entry.label}
                </CardTitle>
                <CardDescription className="text-xs">
                  {curve?.type && <Badge variant="outline" className="text-[10px] mr-1">{curve.type}</Badge>}
                  {curve?.formula && <span className="font-mono text-[10px]">{curve.formula}</span>}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {chartData.length > 0 && (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <XAxis dataKey="level" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(value) => [Number(value).toFixed(2), entry.label]} />
                        <Line type="monotone" dataKey="value" stroke="#22c55e" dot={false} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {Object.keys(params).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(params).map(([k, v]) => (
                      <Badge key={k} variant="secondary" className="text-[10px]">
                        {k}: {typeof v === "number" ? v.toFixed(4) : String(v)}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
