"use client";

import { NODE_CATEGORIES, NODE_DEFINITIONS, type NodeType } from "@/lib/graph/types";

export function NodePalette() {
  const onDragStart = (e: React.DragEvent, nodeType: NodeType) => {
    e.dataTransfer.setData("application/nodeType", nodeType);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="w-48 shrink-0 border-r border-border bg-card overflow-y-auto">
      <div className="p-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
          Палитра нод
        </h3>
        {NODE_CATEGORIES.map((cat) => {
          const nodesInCat = Object.values(NODE_DEFINITIONS).filter(
            (n) => n.category === cat.id
          );
          if (nodesInCat.length === 0) return null;

          return (
            <div key={cat.id} className="mb-3">
              <div
                className="flex items-center gap-1.5 px-1 py-1 text-[10px] font-medium uppercase tracking-wide"
                style={{ color: cat.color }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
                {cat.label}
              </div>
              <div className="space-y-1">
                {nodesInCat.map((def) => (
                  <div
                    key={def.type}
                    draggable
                    onDragStart={(e) => onDragStart(e, def.type)}
                    className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-xs cursor-grab hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  >
                    <span className="text-sm">{def.icon}</span>
                    <span className="truncate">{def.label}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
