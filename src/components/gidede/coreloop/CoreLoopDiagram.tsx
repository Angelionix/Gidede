"use client";

import React from "react";

interface CoreLoopStep {
  name?: string;
  action?: string;
  description?: string;
}

interface CoreLoopDiagramProps {
  steps: CoreLoopStep[];
  structuralType?: string;
  pathologies?: Array<{ name: string; type: string; severity: string }>;
}

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  engine: { bg: "#fbbf24", border: "#f59e0b", text: "#78350f" },
  economy: { bg: "#3b82f6", border: "#2563eb", text: "#1e3a8a" },
  ecology: { bg: "#ef4444", border: "#dc2626", text: "#7f1d1d" },
  tower_defense: { bg: "#8b5cf6", border: "#7c3aed", text: "#4c1d95" },
  rhythm: { bg: "#ec4899", border: "#db2777", text: "#831843" },
  puzzle: { bg: "#10b981", border: "#059669", text: "#064e3b" },
  hybrid: { bg: "#6366f1", border: "#4f46e5", text: "#312e81" },
};

export function CoreLoopDiagram({ steps, structuralType, pathologies = [] }: CoreLoopDiagramProps) {
  const colors = TYPE_COLORS[structuralType || "engine"] || TYPE_COLORS.engine;
  const stepCount = steps.length || 3;
  const radius = 110;
  const center = 150;
  const stepRadius = 35;

  // Calculate positions on circle
  const positions = steps.map((_, i) => {
    const angle = (i / stepCount) * 2 * Math.PI - Math.PI / 2;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    };
  });

  const criticalCount = pathologies.filter((p) => p.severity === "critical").length;
  const warningCount = pathologies.filter((p) => p.severity === "warning").length;

  return (
    <div className="flex flex-col items-center">
      <svg width="300" height="300" viewBox="0 0 300 300" className="max-w-full">
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={colors.border}
          strokeWidth="2"
          strokeDasharray="5,5"
          opacity="0.4"
        />

        {/* Center label */}
        <circle cx={center} cy={center} r="30" fill={colors.bg} opacity="0.15" />
        <text
          x={center}
          y={center - 5}
          textAnchor="middle"
          className="fill-foreground"
          style={{ fontSize: "10px", fontWeight: 600 }}
        >
          {structuralType || "engine"}
        </text>
        <text
          x={center}
          y={center + 10}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: "8px" }}
        >
          {stepCount} steps
        </text>

        {/* Arrows between steps */}
        {positions.map((pos, i) => {
          const next = positions[(i + 1) % stepCount];
          const midX = (pos.x + next.x) / 2;
          const midY = (pos.y + next.y) / 2;
          // Curve outward
          const dx = next.x - pos.x;
          const dy = next.y - pos.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const nx = -dy / len;
          const ny = dx / len;
          const curveOffset = 15;
          const ctrlX = midX + nx * curveOffset;
          const ctrlY = midY + ny * curveOffset;

          return (
            <g key={`arrow-${i}`}>
              <path
                d={`M ${pos.x} ${pos.y} Q ${ctrlX} ${ctrlY} ${next.x} ${next.y}`}
                fill="none"
                stroke={colors.border}
                strokeWidth="2"
                markerEnd={`url(#arrowhead-${i})`}
                opacity="0.6"
              />
              <defs>
                <marker
                  id={`arrowhead-${i}`}
                  markerWidth="8"
                  markerHeight="6"
                  refX="7"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill={colors.border} />
                </marker>
              </defs>
            </g>
          );
        })}

        {/* Step circles */}
        {positions.map((pos, i) => {
          const step = steps[i];
          const label = step?.name || step?.action || `Step ${i + 1}`;
          const shortLabel = label.length > 12 ? label.slice(0, 11) + "…" : label;
          return (
            <g key={`step-${i}`}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={stepRadius}
                fill={colors.bg}
                opacity="0.2"
                stroke={colors.border}
                strokeWidth="2"
              />
              <text
                x={pos.x}
                y={pos.y - 2}
                textAnchor="middle"
                style={{ fontSize: "9px", fontWeight: 700, fill: colors.text }}
              >
                {i + 1}
              </text>
              <text
                x={pos.x}
                y={pos.y + 10}
                textAnchor="middle"
                style={{ fontSize: "8px", fill: colors.text }}
              >
                {shortLabel}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Pathology indicators */}
      {pathologies.length > 0 && (
        <div className="mt-2 flex items-center gap-3 text-xs">
          {criticalCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-950/60 px-2 py-0.5 text-red-700 dark:text-red-300">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              {criticalCount} critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-amber-700 dark:text-amber-300">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              {warningCount} warnings
            </span>
          )}
          {criticalCount === 0 && warningCount === 0 && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              No pathologies
            </span>
          )}
        </div>
      )}

      {/* Steps list */}
      <div className="mt-3 w-full space-y-1">
        {steps.map((step, i) => {
          const label = step?.name || step?.action || `Step ${i + 1}`;
          const desc = step?.description || "";
          return (
            <div
              key={`list-${i}`}
              className="flex items-center gap-2 rounded-lg border border-border p-2 text-xs"
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: colors.border }}
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="font-medium truncate">{label}</p>
                {desc && (
                  <p className="text-muted-foreground truncate text-[10px]">{desc}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
