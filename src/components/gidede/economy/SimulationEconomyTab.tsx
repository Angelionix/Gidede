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
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle2, XCircle, TrendingUp } from "lucide-react";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import type { EconomyDesignResponse } from "@/types/economy";
import { CURVE_COLORS } from "@/constants/economy";
import { EmptyStateCard } from "@/components/gidede/shared";
import { LineChart as LineChartIcon } from "lucide-react";

interface SimulationEconomyTabProps {
  result: EconomyDesignResponse | null;
}

export function SimulationEconomyTab({ result }: SimulationEconomyTabProps) {
  if (!result?.sim_result) {
    return (
      <EmptyStateCard
        icon={LineChartIcon}
        title="Спроектируйте экономику для просмотра симуляции"
        description="Кривые ресурсов, стабильность и качество"
      />
    );
  }

  const sim = result.sim_result;
  const aggregated = sim.aggregated || {
    avg_resource_curves: {},
    resource_ranges: {},
    runaway_frequency: 0,
    stall_frequency: 0,
    stability_index: 0,
    build_gap: 0,
  };
  const quality = sim.quality || {
    resources_in_bounds: false,
    progression_pacing_ok: false,
    no_runaway_for_minmaxer: false,
    no_stall_for_casual: false,
    build_gap_acceptable: false,
    economy_stable: false,
    overall_pass: false,
    critical_issues: [],
  };

  const resourceCurves = aggregated.avg_resource_curves || {};
  const curveNames = Object.keys(resourceCurves);
  const maxLen = Math.max(...curveNames.map((n) => (resourceCurves[n] || []).length), 1);
  const curveChartData = Array.from({ length: maxLen }, (_, i) => {
    const point: Record<string, number | string> = { tick: i };
    curveNames.forEach((name) => {
      const arr = resourceCurves[name] || [];
      point[name] = arr[i] ?? 0;
    });
    return point;
  });

  const qualityChecks = [
    { key: "resources_in_bounds", label: "Ресурсы в границах" },
    { key: "progression_pacing_ok", label: "Темп прогрессии ОК" },
    { key: "no_runaway_for_minmaxer", label: "Нет убегания у минмаксера" },
    { key: "no_stall_for_casual", label: "Нет стагнации у казуала" },
    { key: "build_gap_acceptable", label: "Build Gap допустим" },
    { key: "economy_stable", label: "Экономика стабильна" },
  ];

  return (
    <div className="space-y-4">
      {/* Resource Curves */}
      {curveNames.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Кривые ресурсов
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={curveChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <XAxis dataKey="tick" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  {curveNames.map((name, i) => (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={CURVE_COLORS[i % CURVE_COLORS.length]}
                      dot={false}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quality Assessment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Оценка качества
          </CardTitle>
          <CardDescription className="text-xs">
            {quality.overall_pass ? "Все проверки пройдены" : "Некоторые проверки не пройдены"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {qualityChecks.map((check) => {
            const passed = quality[check.key as keyof typeof quality] as boolean;
            return (
              <div key={check.key} className="flex items-center gap-2 text-xs">
                {passed ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                )}
                <span className={passed ? "" : "text-red-600 dark:text-red-400"}>{check.label}</span>
              </div>
            );
          })}
          {(quality.critical_issues || []).length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs font-medium text-red-600 dark:text-red-400">Критические проблемы</p>
              {(quality.critical_issues || []).map((issue, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{issue}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stability & Build Gap */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Индекс стабильности</p>
            <p className="text-2xl font-bold">{typeof aggregated.stability_index === "number" ? aggregated.stability_index.toFixed(3) : "—"}</p>
            <Progress
              value={typeof aggregated.stability_index === "number" ? aggregated.stability_index * 100 : 0}
              className="h-2 mt-2"
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Build Gap</p>
            <p className="text-2xl font-bold">{typeof aggregated.build_gap === "number" ? aggregated.build_gap.toFixed(3) : "—"}</p>
            <Progress
              value={typeof aggregated.build_gap === "number" ? aggregated.build_gap * 100 : 0}
              className="h-2 mt-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Runaway & Stall frequencies */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Частота убегания</p>
            <p className="text-lg font-bold text-red-600 dark:text-red-400">
              {typeof aggregated.runaway_frequency === "number" ? (aggregated.runaway_frequency * 100).toFixed(1) + "%" : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Частота стагнации</p>
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
              {typeof aggregated.stall_frequency === "number" ? (aggregated.stall_frequency * 100).toFixed(1) + "%" : "—"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
