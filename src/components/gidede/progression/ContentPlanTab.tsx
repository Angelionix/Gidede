"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layers, Sparkles, TrendingUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import type { ProgressionDesignResponse } from "@/types/progression";
import { EmptyStateCard } from "@/components/gidede/shared";
import { Package } from "lucide-react";

interface ContentPlanTabProps {
  result: ProgressionDesignResponse | null;
}

export function ContentPlanTab({ result }: ContentPlanTabProps) {
  if (!result?.content_plan) {
    return (
      <EmptyStateCard
        icon={Package}
        title="Спроектируйте прогрессию для просмотра контент-плана"
        description="Дерево разблокировок и воспринимаемая сложность"
      />
    );
  }

  const cp = result.content_plan;
  const tierPlans = cp.tier_plans || [];
  const unlockTree = cp.unlock_tree || [];
  const difficultyTable = cp.perceived_difficulty_table || [];

  // Chart data for perceived difficulty
  const difficultyChartData = difficultyTable.map((d) => ({
    level: d.level,
    difficulty: d.target_perceived_difficulty,
    enemyPower: d.recommended_enemy_power,
  }));

  return (
    <div className="space-y-4">
      {/* Tier Plans */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Планы по этапам
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Этап</TableHead>
                  <TableHead className="text-right">Враги</TableHead>
                  <TableHead className="text-right">Награды</TableHead>
                  <TableHead className="text-right">Способности</TableHead>
                  <TableHead className="text-right">Вехи</TableHead>
                  <TableHead>Темп</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tierPlans.map((tp, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-sm">{tp.tier_index}</TableCell>
                    <TableCell className="text-right text-sm">{tp.enemies}</TableCell>
                    <TableCell className="text-right text-sm">{tp.rewards}</TableCell>
                    <TableCell className="text-right text-sm">{tp.abilities}</TableCell>
                    <TableCell className="text-right text-sm">{tp.milestones}</TableCell>
                    <TableCell className="text-sm">
                      <Badge variant="outline" className="text-xs">{tp.pacing || "—"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Unlock Tree */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Дерево разблокировок ({unlockTree.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-80 overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Уровень</TableHead>
                  <TableHead className="w-24">Тип</TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead>Описание</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unlockTree.map((unlock, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-sm">{unlock.level}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{unlock.unlock_type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{unlock.unlock_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{unlock.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Perceived Difficulty Chart */}
      {difficultyChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Воспринимаемая сложность
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={difficultyChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <XAxis dataKey="level" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="difficulty" stroke="#22c55e" name="Сложность" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="enemyPower" stroke="#ef4444" name="Мощь врагов" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
