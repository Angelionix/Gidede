"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { NODE_DEFINITIONS, PIN_COLORS, type NodeType } from "@/lib/graph/types";

interface GameNodeData {
  label: string;
  properties: Record<string, unknown>;
  nodeType?: NodeType;
  [key: string]: unknown;
}

export function GameNode({ id, data, selected }: NodeProps) {
  const nodeType = (data as GameNodeData).nodeType as NodeType;
  const def = nodeType ? NODE_DEFINITIONS[nodeType] : null;

  if (!def) {
    return (
      <div className="rounded-lg border border-border bg-card p-2 text-xs">
        Unknown node
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border-2 bg-card shadow-md min-w-[140px] transition-all"
      style={{
        borderColor: selected ? def.color : "rgba(0,0,0,0.1)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded-t-md text-xs font-medium text-white"
        style={{ backgroundColor: def.color }}
      >
        <span>{def.icon}</span>
        <span className="truncate">{def.label}</span>
      </div>

      {/* Body with pins */}
      <div className="px-1 py-1">
        {/* Inputs */}
        {def.inputs.length > 0 && (
          <div className="space-y-1">
            {def.inputs.map((pin) => (
              <div key={pin.id} className="flex items-center gap-1 text-[10px]">
                <Handle
                  type="target"
                  position={Position.Left}
                  id={pin.id}
                  style={{
                    background: PIN_COLORS[pin.type],
                    width: 8,
                    height: 8,
                    border: "1px solid #fff",
                  }}
                />
                <span className="text-muted-foreground ml-3">{pin.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Properties preview */}
        {Object.keys(def.defaultProperties).length > 0 && (
          <div className="mt-1 px-1 text-[9px] text-muted-foreground">
            {Object.entries(def.defaultProperties).slice(0, 2).map(([key, val]) => (
              <div key={key} className="truncate">
                {key}: {String(val)}
              </div>
            ))}
          </div>
        )}

        {/* Outputs */}
        {def.outputs.length > 0 && (
          <div className="space-y-1 mt-1">
            {def.outputs.map((pin) => (
              <div
                key={pin.id}
                className="flex items-center justify-end gap-1 text-[10px]"
              >
                <span className="text-muted-foreground mr-3">{pin.label}</span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={pin.id}
                  style={{
                    background: PIN_COLORS[pin.type],
                    width: 8,
                    height: 8,
                    border: "1px solid #fff",
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
