"use client";

import { useState, useEffect } from "react";
import { useNodesState, useEdgesState, type Node, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ReactFlowProvider } from "@xyflow/react";
import { NodePalette } from "./NodePalette";
import { GraphCanvas } from "./GraphCanvas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, Play, Upload, Download, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function PrototypeEditorInner() {
  const { toast } = useToast();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [mode, setMode] = useState<"2d" | "3d">("2d");

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const handleSave = () => {
    const graph = {
      version: "1.0",
      nodes: nodes.map((n) => ({
        id: n.id,
        type: (n.data as Record<string, unknown>)?.nodeType as string,
        position: n.position,
        data: n.data,
      })),
      edges,
      settings: { mode, canvasSize: { width: 400, height: 300 }, targetFps: 60, backgroundColor: "#0f172a" },
    };
    const json = JSON.stringify(graph, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prototype-graph.json";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Граф сохранён", description: `${nodes.length} нод, ${edges.length} связей` });
  };

  const handleLoad = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const graph = JSON.parse(text);
        const loadedNodes = (graph.nodes || []).map((n: Record<string, unknown>) => ({
          id: n.id as string,
          type: "gameNode",
          position: n.position as { x: number; y: number },
          data: n.data,
        }));
        setNodes(loadedNodes);
        setEdges(graph.edges || []);
        toast({ title: "Граф загружен", description: `${loadedNodes.length} нод` });
      } catch {
        toast({ title: "Ошибка загрузки", variant: "destructive" });
      }
    };
    input.click();
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left: Palette */}
      <NodePalette />

      {/* Center: Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
          <Button size="sm" variant="outline" onClick={handleSave}>
            <Save className="h-3.5 w-3.5 mr-1" /> Экспорт
          </Button>
          <Button size="sm" variant="outline" onClick={handleLoad}>
            <Upload className="h-3.5 w-3.5 mr-1" /> Импорт
          </Button>
          <div className="w-px h-5 bg-border mx-1" />
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMode("2d")}
              className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
                mode === "2d" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              2D
            </button>
            <button
              onClick={() => setMode("3d")}
              className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
                mode === "3d" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              3D
            </button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {nodes.length} нод
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {edges.length} связей
            </Badge>
            <Button size="sm" disabled className="opacity-50" title="Компилятор будет в Фазе 2">
              <Play className="h-3.5 w-3.5 mr-1" /> Сгенерировать
            </Button>
          </div>
        </div>

        {/* React Flow Canvas */}
        <div className="flex-1 relative" onClick={(e) => {
          if (e.target === e.currentTarget) setSelectedNodeId(null);
        }}>
          <GraphCanvas
            initialNodes={nodes}
            initialEdges={edges}
            onNodesChange={(n) => setNodes(n)}
            onEdgesChange={(e) => setEdges(e)}
          />
        </div>
      </div>

      {/* Right: Inspector */}
      <div className="w-56 shrink-0 border-l border-border bg-card overflow-y-auto">
        <div className="p-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Инспектор
          </h3>
          {selectedNode ? (
            <div className="space-y-2">
              <div className="text-sm font-medium">
                {(selectedNode.data as Record<string, unknown>)?.label as string || "Node"}
              </div>
              <div className="text-[10px] text-muted-foreground">
                ID: {selectedNode.id}
              </div>
              <div className="text-[10px] text-muted-foreground">
                Type: {(selectedNode.data as Record<string, unknown>)?.nodeType as string}
              </div>
              {/* Properties would be editable here in full version */}
              <div className="mt-3 text-[10px] text-muted-foreground">
                Редактирование свойств будет доступно в следующей итерации.
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Выберите ноду для редактирования свойств.
            </p>
          )}
        </div>

        {/* Templates section */}
        <div className="p-3 border-t border-border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Шаблоны
          </h3>
          <div className="space-y-1">
            {["Collector", "Survival", "Tower Defense", "Rhythm", "Puzzle"].map((t) => (
              <div
                key={t}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
                onClick={() => toast({ title: "Скоро!", description: `${t} template будет в Этапе 1.3` })}
              >
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PrototypeEditor() {
  return (
    <ReactFlowProvider>
      <PrototypeEditorInner />
    </ReactFlowProvider>
  );
}
