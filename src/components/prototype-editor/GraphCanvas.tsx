"use client";

import { useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { GameNode } from "./nodes/GameNode";
import { NODE_CATEGORIES, NODE_DEFINITIONS, type NodeType } from "@/lib/graph/types";

const nodeTypes = { gameNode: GameNode };

/** Snap-to-grid: round position to nearest GRID_SIZE px. */
const GRID_SIZE = 16;
function snapToGrid(pos: { x: number; y: number }): { x: number; y: number } {
  return {
    x: Math.round(pos.x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(pos.y / GRID_SIZE) * GRID_SIZE,
  };
}

interface GraphCanvasProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  onNodesChange?: (nodes: Node[]) => void;
  onEdgesChange?: (edges: Edge[]) => void;
  onNodeClick?: (nodeId: string | null) => void;
}

export function GraphCanvas({
  initialNodes = [],
  initialEdges = [],
  onNodesChange,
  onEdgesChange,
  onNodeClick,
}: GraphCanvasProps) {
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, animated: true }, eds));
    },
    [setEdges]
  );

  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChangeInternal>[0]) => {
      onNodesChangeInternal(changes);
      onNodesChange?.(nodes);
    },
    [nodes, onNodesChangeInternal, onNodesChange]
  );

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChangeInternal>[0]) => {
      onEdgesChangeInternal(changes);
      onEdgesChange?.(edges);
    },
    [edges, onEdgesChangeInternal, onEdgesChange]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const nodeType = e.dataTransfer.getData("application/nodeType") as NodeType;
      if (!nodeType || !NODE_DEFINITIONS[nodeType]) return;

      const def = NODE_DEFINITIONS[nodeType];
      const bounds = e.currentTarget.getBoundingClientRect();
      const rawPosition = {
        x: e.clientX - bounds.left - 70,
        y: e.clientY - bounds.top - 20,
      };
      // Snap dropped node to grid
      const position = snapToGrid(rawPosition);

      const newNode: Node = {
        id: `${nodeType}-${Date.now()}`,
        type: "gameNode",
        position,
        data: {
          label: def.label,
          nodeType,
          properties: { ...def.defaultProperties },
        },
      };

      const newNodes = [...nodes, newNode];
      setNodes(newNodes);
      onNodesChange?.(newNodes);
    },
    [nodes, setNodes, onNodesChange]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  return (
    <div className="w-full h-full" onDrop={onDrop} onDragOver={onDragOver}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => onNodeClick?.(node.id)}
        onPaneClick={() => onNodeClick?.(null)}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[GRID_SIZE, GRID_SIZE]}
        className="bg-background"
        defaultEdgeOptions={{
          animated: true,
          style: { strokeWidth: 2 },
        }}
        deleteKeyCode={["Delete", "Backspace"]}
        multiSelectionKeyCode={["Meta", "Control"]}
      >
        <Background variant={BackgroundVariant.Dots} gap={GRID_SIZE} size={1} color="#334155" />
        <Controls className="bg-card border-border" />
        <MiniMap
          className="bg-card border-border rounded-lg"
          nodeColor={(n) => {
            const nt = (n.data as Record<string, unknown>)?.nodeType as NodeType;
            return nt ? NODE_DEFINITIONS[nt]?.color || "#64748b" : "#64748b";
          }}
        />
      </ReactFlow>
    </div>
  );
}
