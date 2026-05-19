"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Activity, CircleDot, RotateCcw, Workflow, GitBranch } from "lucide-react";
import type { EconomyDesignResponse } from "@/types/economy";
import { ECONOMIC_TYPE_COLORS } from "@/constants/economy";
import { EmptyStateCard, NodeTypeIcon } from "@/components/gidede/shared";

interface MachinationsEconomyTabProps {
  result: EconomyDesignResponse | null;
}

export function MachinationsEconomyTab({ result }: MachinationsEconomyTabProps) {
  if (!result?.machinations_model) {
    return (
      <EmptyStateCard
        icon={GitBranch}
        title="Спроектируйте экономику для просмотра Machinations"
        description="Граф ресурсов, циклы обратной связи и паттерны"
      />
    );
  }

  const mach = result.machinations_model;
  const nodes = mach.nodes || [];
  const flows = mach.resource_flows || [];
  const stateConns = mach.state_connections || [];
  const feedbackLoops = mach.feedback_loops || [];
  const structuralPatterns = mach.structural_patterns || [];

  return (
    <div className="space-y-4">
      {/* Economic Type */}
      {mach.economic_type && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Экономический тип Machinations:</span>
              <Badge className={`text-xs ${ECONOMIC_TYPE_COLORS[mach.economic_type] || "bg-gray-100 text-gray-800"}`}>
                {mach.economic_type}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Nodes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <CircleDot className="h-4 w-4 text-primary" />
            Узлы графа ({nodes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {nodes.map((node, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border p-2">
                <NodeTypeIcon type={node.node_type} />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{node.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {node.node_type}
                    {node.initial_value != null ? ` | ${node.initial_value}` : ""}
                    {node.capacity != null ? ` / ${node.capacity}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Resource Flows */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-primary" />
            Потоки ресурсов ({flows.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {flows.map((flow, i) => (
              <div key={i} className="flex items-center gap-2 text-xs rounded-md border p-2">
                <Badge variant="outline" className="text-[10px] shrink-0">{flow.source_id}</Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <Badge variant="outline" className="text-[10px] shrink-0">{flow.target_id}</Badge>
                <span className="text-[10px] text-muted-foreground">{flow.resource}</span>
                <Badge variant="secondary" className="text-[10px] ml-auto">rate: {flow.rate}</Badge>
              </div>
            ))}
            {flows.length === 0 && <p className="text-xs text-muted-foreground">Нет потоков ресурсов</p>}
          </div>
        </CardContent>
      </Card>

      {/* State Connections */}
      {stateConns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Связи состояний ({stateConns.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {stateConns.map((conn, i) => (
                <div key={i} className="flex items-center gap-2 text-xs rounded-md border border-dashed p-2">
                  <Badge variant="outline" className="text-[10px]">{conn.source_id}</Badge>
                  <span className="text-muted-foreground">--{conn.modifier}--&gt;</span>
                  <Badge variant="outline" className="text-[10px]">{conn.target_id}</Badge>
                  {conn.formula && <span className="text-[10px] text-muted-foreground ml-auto">{conn.formula}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feedback Loops */}
      {feedbackLoops.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-primary" />
              Циклы обратной связи ({feedbackLoops.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {feedbackLoops.map((loop, i) => {
                const isPositive = loop.loop_type === "positive" || loop.loop_type === "reinforcing";
                return (
                  <div key={i} className="flex items-center gap-2 text-xs rounded-md border p-2">
                    <Badge className={`text-[10px] ${isPositive ? "bg-green-600 text-white" : "bg-blue-600 text-white"}`}>
                      {isPositive ? "Reinforcing" : "Balancing"}
                    </Badge>
                    <span className="text-muted-foreground">
                      {(loop.nodes || []).join(" → ")}
                      {(loop.nodes || []).length > 0 && ` → ${loop.nodes[0]}`}
                    </span>
                    {loop.strength != null && (
                      <Badge variant="outline" className="text-[10px] ml-auto">
                        Strength: {loop.strength}
                      </Badge>
                    )}
                    {loop.description && (
                      <span className="text-[10px] text-muted-foreground ml-2">({loop.description})</span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Structural Patterns */}
      {structuralPatterns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Workflow className="h-4 w-4 text-primary" />
              Структурные паттерны
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {structuralPatterns.map((p, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{p}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
