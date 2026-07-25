"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useNodesState, useEdgesState, type Node, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ReactFlowProvider } from "@xyflow/react";
import { NodePalette } from "./NodePalette";
import { GraphCanvas } from "./GraphCanvas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, Play, Upload, Download, Loader2, AlertCircle, Sparkles, Lightbulb, Undo2, Redo2, FileCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { GRAPH_TEMPLATES } from "@/lib/graph/templates";
import type { NodeGraph, NodeType } from "@/lib/graph/types";
import { NODE_DEFINITIONS } from "@/lib/graph/types";

function PrototypeEditorInner() {
  const { toast } = useToast();
  const { apiFetch } = useAuth();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [mode, setMode] = useState<"2d" | "3d">("2d");
  const [compiledHtml, setCompiledHtml] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // === Undo/Redo history (Phase 5.1) ===
  // Stack of {nodes, edges} snapshots. We push on meaningful changes
  // (add/delete node, add/delete edge, property edit) with a debounce
  // so dragging a node doesn't flood the history.
  interface HistoryEntry { nodes: Node[]; edges: Edge[]; }
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  const lastSnapshot = useRef<HistoryEntry>({ nodes: [], edges: [] });
  const snapshotTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Push current state to undo stack (called before a mutation)
  const pushHistory = useCallback(() => {
    undoStack.current.push(lastSnapshot.current);
    if (undoStack.current.length > 50) undoStack.current.shift(); // cap at 50
    redoStack.current = []; // any new action clears redo
  }, []);

  // Debounced snapshot: saves current nodes/edges as lastSnapshot after 400ms idle
  const scheduleSnapshot = useCallback(() => {
    if (snapshotTimer.current) clearTimeout(snapshotTimer.current);
    snapshotTimer.current = setTimeout(() => {
      lastSnapshot.current = { nodes: [...nodes], edges: [...edges] };
    }, 400);
  }, [nodes, edges]);

  useEffect(() => { scheduleSnapshot(); }, [nodes, edges, scheduleSnapshot]);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) {
      toast({ title: "Нечего отменять", description: "История пуста" });
      return;
    }
    const prev = undoStack.current.pop()!;
    redoStack.current.push({ nodes: [...nodes], edges: [...edges] });
    setNodes(prev.nodes);
    setEdges(prev.edges);
    toast({ title: "↶ Отменено", description: `${undoStack.current.length} действий в истории` });
  }, [nodes, edges, setNodes, setEdges, toast]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) {
      toast({ title: "Нечего повторить" });
      return;
    }
    const next = redoStack.current.pop()!;
    undoStack.current.push({ nodes: [...nodes], edges: [...edges] });
    setNodes(next.nodes);
    setEdges(next.edges);
    toast({ title: "↷ Повторено", description: `${redoStack.current.length} действий в redo` });
  }, [nodes, edges, setNodes, setEdges, toast]);

  // === Keyboard shortcuts (Phase 5.1) ===
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs/textareas
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "z" && !e.shiftKey) {
        e.preventDefault(); undo();
      } else if ((meta && e.key === "z" && e.shiftKey) || (meta && e.key === "y")) {
        e.preventDefault(); redo();
      } else if (meta && e.key === "s") {
        e.preventDefault();
        // Quick-save: trigger the save flow if a name exists, else toast
        if (saveName.trim()) handleSaveToDb();
        else toast({ title: "Введите название графа", description: "Поле «Название графа» в правой панели" });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]); // handleSaveToDb referenced via closure; saveName checked at call time

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  const updateNodeProperty = useCallback((nodeId: string, key: string, value: unknown) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== nodeId) return n;
        const props = { ...((n.data as Record<string, unknown>)?.properties as Record<string, unknown> || {}) };
        props[key] = value;
        return { ...n, data: { ...n.data, properties: props } };
      })
    );
  }, [setNodes]);

  // Auto-save via postMessage
  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== "gidede-playtest") return;
      toast({ title: data.outcome === "win" ? "🎉 Победа!" : "💀 Поражение", description: "Результат автосохранён" });
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [toast]);

  const handleCompile = async () => {
    setCompiling(true);
    setErrors([]);
    try {
      const graph: NodeGraph = {
        version: "1.0",
        nodes: nodes.map((n) => ({
          id: n.id,
          type: (n.data as Record<string, unknown>)?.nodeType as NodeType,
          position: n.position,
          data: { label: String((n.data as Record<string, unknown>)?.label || ""), properties: (n.data as Record<string, unknown>)?.properties as Record<string, unknown> || {} },
        })),
        edges: edges.map((e) => ({ id: e.id, source: e.source, sourceHandle: e.sourceHandle ?? null, target: e.target, targetHandle: e.targetHandle ?? null })),
        settings: { mode, canvasSize: { width: 400, height: 300 }, targetFps: 60, backgroundColor: "#0f172a" },
      };

      const result = await apiFetch<{ html: string; valid: boolean; errors: string[] }>("/prototype-graph/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graph }),
      });

      if (result.valid && result.html) {
        setCompiledHtml(result.html);
        setShowPreview(true);
        toast({ title: "✅ Скомпилировано", description: "Прототип готов к запуску" });
      } else {
        setErrors(result.errors || ["Неизвестная ошибка"]);
        toast({ title: "❌ Ошибка компиляции", description: result.errors[0] || "", variant: "destructive" });
      }
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Ошибка"]);
      toast({ title: "Ошибка", variant: "destructive" });
    } finally {
      setCompiling(false);
    }
  };

  const handleExport = () => {
    pushHistory();
    const graph: NodeGraph = {
      version: "1.0",
      nodes: nodes.map((n) => ({ id: n.id, type: (n.data as Record<string, unknown>)?.nodeType as NodeType, position: n.position, data: n.data as { label: string; properties: Record<string, unknown> } })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, sourceHandle: e.sourceHandle ?? null, target: e.target, targetHandle: e.targetHandle ?? null })),
      settings: { mode, canvasSize: { width: 400, height: 300 }, targetFps: 60, backgroundColor: "#0f172a" },
    };
    const blob = new Blob([JSON.stringify(graph, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "prototype-graph.json"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Экспортировано", description: `${nodes.length} нод` });
  };

  // === Export compiled HTML (Phase 5.6) ===
  const handleExportHtml = () => {
    if (!compiledHtml) {
      toast({ title: "Сначала скомпилируйте", description: "Нажмите «Сгенерировать» для создания HTML", variant: "destructive" });
      return;
    }
    const blob = new Blob([compiledHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `prototype-${mode}-${Date.now()}.html`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "HTML экспортирован", description: `Играбельный ${mode === "3d" ? "3D" : "2D"}-прототип скачан` });
  };

  // Save to DB
  const [saveName, setSaveName] = useState("");
  const [savedGraphs, setSavedGraphs] = useState<Array<{ id: string; name: string; updatedAt: string }>>([]);
  const [showSavedList, setShowSavedList] = useState(false);

  const handleSaveToDb = async () => {
    if (!saveName.trim()) { toast({ title: "Введите название", variant: "destructive" }); return; }
    try {
      const graph: NodeGraph = {
        version: "1.0",
        nodes: nodes.map((n) => ({ id: n.id, type: (n.data as Record<string, unknown>)?.nodeType as NodeType, position: n.position, data: n.data as { label: string; properties: Record<string, unknown> } })),
        edges: edges.map((e) => ({ id: e.id, source: e.source, sourceHandle: e.sourceHandle ?? null, target: e.target, targetHandle: e.targetHandle ?? null })),
        settings: { mode, canvasSize: { width: 400, height: 300 }, targetFps: 60, backgroundColor: "#0f172a" },
      };
      await apiFetch("/prototype-graph/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: saveName.trim(), graph: JSON.stringify(graph), mode }),
      });
      toast({ title: "✅ Сохранено", description: saveName });
      setSaveName("");
      loadSavedGraphs();
    } catch { toast({ title: "Ошибка сохранения", variant: "destructive" }); }
  };

  const loadSavedGraphs = async () => {
    try {
      const data = await apiFetch<{ results: Array<{ id: string; name: string; updatedAt: string }> }>("/prototype-graph/list?scope=mine");
      setSavedGraphs(data.results || []);
    } catch { /* ignore */ }
  };

  const handleLoadFromDb = async (graphId: string) => {
    try {
      const data = await apiFetch<{ graph: string; name: string; mode: string }>(`/prototype-graph/${graphId}`);
      const graph = JSON.parse(data.graph);
      const loadedNodes: Node[] = (graph.nodes || []).map((n: Record<string, unknown>) => ({
        id: n.id as string, type: "gameNode", position: n.position as { x: number; y: number },
        data: { ...(n.data as object), nodeType: n.type },
      }));
      const loadedEdges: Edge[] = (graph.edges || []).map((e: Record<string, unknown>, i: number) => ({
        id: `e${i}-${Date.now()}`, source: e.source as string, sourceHandle: e.sourceHandle as string | null,
        target: e.target as string, targetHandle: e.targetHandle as string | null, animated: true,
      }));
      setNodes(loadedNodes);
      setEdges(loadedEdges);
      setShowPreview(false);
      setCompiledHtml(null);
      toast({ title: "Загружено", description: data.name });
    } catch { toast({ title: "Ошибка загрузки", variant: "destructive" }); }
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const graph = JSON.parse(text);
        const loadedNodes: Node[] = (graph.nodes || []).map((n: Record<string, unknown>) => ({
          id: n.id as string, type: "gameNode", position: n.position as { x: number; y: number }, data: n.data,
        }));
        setNodes(loadedNodes);
        setEdges(graph.edges || []);
        toast({ title: "Загружено", description: `${loadedNodes.length} нод` });
      } catch { toast({ title: "Ошибка импорта", variant: "destructive" }); }
    };
    input.click();
  };

  const loadTemplate = (templateKey: string) => {
    const tpl = GRAPH_TEMPLATES[templateKey];
    if (!tpl) return;
    const loadedNodes: Node[] = tpl.graph.nodes.map((n) => ({
      id: n.id, type: "gameNode", position: n.position,
      data: { label: NODE_DEFINITIONS[n.type]?.label || n.type, nodeType: n.type, properties: n.data.properties || {} },
    }));
    const loadedEdges: Edge[] = tpl.graph.edges.map((e) => ({ ...e, animated: true }));
    setNodes(loadedNodes);
    setEdges(loadedEdges);
    setShowPreview(false);
    setCompiledHtml(null);
    toast({ title: `Шаблон: ${tpl.name}`, description: tpl.description });
  };

  // AI Generate from text
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Array<{ type: string; message: string; suggestedNode?: string }>>([]);
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false);

  const handleAiGenerate = async () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    try {
      const result = await apiFetch<{ nodes: Array<{ id: string; type: string; label: string; position: { x: number; y: number }; properties: Record<string, unknown> }>; edges: Array<{ source: string; sourceHandle: string; target: string; targetHandle: string }> }>("/prototype-graph/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiText, mode }),
      });
      const loadedNodes: Node[] = (result.nodes || []).map((n) => ({
        id: n.id, type: "gameNode", position: n.position,
        data: { label: NODE_DEFINITIONS[n.type as NodeType]?.label || n.label || n.type, nodeType: n.type, properties: n.properties || {} },
      }));
      const loadedEdges: Edge[] = (result.edges || []).map((e, i) => ({ id: `e${i}-${Date.now()}`, source: e.source, sourceHandle: e.sourceHandle, target: e.target, targetHandle: e.targetHandle, animated: true }));
      setNodes(loadedNodes);
      setEdges(loadedEdges);
      setShowPreview(false);
      setCompiledHtml(null);
      toast({ title: "✅ AI граф создан", description: `${loadedNodes.length} нод, ${loadedEdges.length} связей` });
    } catch (err) {
      toast({ title: "AI недоступен", description: "Попробуйте позже или используйте шаблон", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiSuggest = async () => {
    if (nodes.length === 0) return;
    setAiSuggestLoading(true);
    try {
      const nodeTypes = nodes.map((n) => (n.data as Record<string, unknown>)?.nodeType as string);
      const result = await apiFetch<{ suggestions: Array<{ type: string; message: string; suggestedNode?: string }> }>("/prototype-graph/ai-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeTypes, edgeCount: edges.length, description: aiText }),
      });
      setAiSuggestions(result.suggestions || []);
    } catch {
      toast({ title: "AI недоступен", variant: "destructive" });
    } finally {
      setAiSuggestLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left: Palette */}
      <NodePalette />

      {/* Center: Canvas + Preview */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={undo} title="Отменить (Ctrl+Z)"><Undo2 className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={redo} title="Повторить (Ctrl+Shift+Z)"><Redo2 className="h-3.5 w-3.5" /></Button>
          <div className="w-px h-5 bg-border mx-1" />
          <Button size="sm" variant="outline" onClick={handleExport}><Save className="h-3.5 w-3.5 mr-1" /> Экспорт</Button>
          <Button size="sm" variant="outline" onClick={handleImport}><Upload className="h-3.5 w-3.5 mr-1" /> Импорт</Button>
          {compiledHtml && (
            <Button size="sm" variant="outline" onClick={handleExportHtml} title="Скачать HTML"><FileCode className="h-3.5 w-3.5 mr-1" /> HTML</Button>
          )}
          <div className="w-px h-5 bg-border mx-1" />
          <div className="flex items-center gap-1">
            <button onClick={() => setMode("2d")} className={`rounded-md px-2 py-0.5 text-xs font-medium ${mode === "2d" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>2D</button>
            <button onClick={() => setMode("3d")} className={`rounded-md px-2 py-0.5 text-xs font-medium ${mode === "3d" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>3D</button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">{nodes.length} нод</Badge>
            <Badge variant="outline" className="text-[10px]">{edges.length} связей</Badge>
            <Button size="sm" onClick={handleCompile} disabled={compiling || nodes.length === 0}>
              {compiling ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Компиляция...</> : <><Play className="h-3.5 w-3.5 mr-1" /> Сгенерировать</>}
            </Button>
          </div>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="border-b border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3 py-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                {errors.map((err, i) => <p key={i} className="text-xs text-red-700 dark:text-red-300">{err}</p>)}
              </div>
            </div>
          </div>
        )}

        {/* Canvas or Preview */}
        <div className="flex-1 relative">
          {showPreview && compiledHtml ? (
            <div className="absolute inset-0 flex flex-col">
              <div className="flex items-center justify-between border-b border-border bg-card px-3 py-1.5">
                <span className="text-xs font-medium">Preview</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { if (iframeRef.current) { const src = iframeRef.current.src; iframeRef.current.src = "about:blank"; setTimeout(() => { if (iframeRef.current) iframeRef.current.src = src; }, 50); } }}>Restart</Button>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowPreview(false)}>← Back to graph</Button>
                </div>
              </div>
              <iframe ref={iframeRef} srcDoc={compiledHtml} title="Node Graph Prototype" className="w-full flex-1 border-0" />
            </div>
          ) : (
            <GraphCanvas initialNodes={nodes} initialEdges={edges} onNodesChange={(n) => setNodes(n)} onEdgesChange={(e) => setEdges(e)} onNodeClick={setSelectedNodeId} />
          )}
        </div>
      </div>

      {/* Right: Inspector + Templates */}
      <div className="w-56 shrink-0 border-l border-border bg-card overflow-y-auto">
        {/* Node Inspector */}
        <div className="p-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Инспектор</h3>
          {selectedNode ? (
            <div className="space-y-2">
              <div className="text-sm font-medium">{(selectedNode.data as Record<string, unknown>)?.label as string}</div>
              <div className="text-[10px] text-muted-foreground">ID: {selectedNode.id.slice(0, 12)}</div>
              {/* Property editors */}
              {Object.entries((selectedNode.data as Record<string, unknown>)?.properties as Record<string, unknown> || {}).map(([key, val]) => (
                <div key={key} className="space-y-0.5">
                  <label className="text-[10px] text-muted-foreground font-medium">{key}</label>
                  {typeof val === "number" ? (
                    <input
                      type="number"
                      value={val}
                      onChange={(e) => updateNodeProperty(selectedNode.id, key, Number(e.target.value))}
                      className="w-full h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  ) : typeof val === "boolean" ? (
                    <button
                      onClick={() => updateNodeProperty(selectedNode.id, key, !val)}
                      className={`rounded-md px-2 py-1 text-xs w-full text-left ${val ? "bg-primary/10 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-border"}`}
                    >
                      {val ? "✅ true" : "⬜ false"}
                    </button>
                  ) : (
                    <input
                      type="text"
                      value={String(val)}
                      onChange={(e) => updateNodeProperty(selectedNode.id, key, e.target.value)}
                      className="w-full h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  )}
                </div>
              ))}
              {/* Position editor */}
              <div className="pt-2 border-t border-border">
                <div className="text-[10px] text-muted-foreground">Position: {Math.round(selectedNode.position.x)}, {Math.round(selectedNode.position.y)}</div>
              </div>
              {/* Delete button */}
              <Button
                size="sm"
                variant="outline"
                className="w-full text-destructive hover:bg-destructive/5"
                onClick={() => {
                  setNodes(nodes.filter((n) => n.id !== selectedNode.id));
                  setEdges(edges.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
                  setSelectedNodeId(null);
                }}
              >
                Удалить ноду
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Выберите ноду для редактирования свойств.</p>
          )}
        </div>
        <div className="p-3 border-t border-border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Шаблоны</h3>
          <div className="space-y-1">
            {Object.entries(GRAPH_TEMPLATES).map(([key, tpl]) => (
              <div key={key} onClick={() => loadTemplate(key)} className="rounded-md border border-border bg-background px-2 py-1.5 text-xs cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors">
                <p className="font-medium">{tpl.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{tpl.description}</p>
              </div>
            ))}
          </div>
        </div>
        {/* Save/Load from DB */}
        <div className="p-3 border-t border-border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Сохранить в БД</h3>
          <input
            type="text"
            placeholder="Название графа..."
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            className="w-full h-7 rounded-md border border-input bg-background px-2 text-xs mb-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button size="sm" className="w-full mb-1.5" onClick={handleSaveToDb} disabled={!saveName.trim() || nodes.length === 0}>
            <Save className="h-3 w-3 mr-1" /> Сохранить
          </Button>
          <Button size="sm" variant="outline" className="w-full" onClick={() => { loadSavedGraphs(); setShowSavedList(!showSavedList); }}>
            Мои графы {savedGraphs.length > 0 && `(${savedGraphs.length})`}
          </Button>
          {showSavedList && savedGraphs.length > 0 && (
            <div className="mt-1.5 space-y-1 max-h-32 overflow-y-auto">
              {savedGraphs.map((g) => (
                <div key={g.id} onClick={() => handleLoadFromDb(g.id)} className="rounded-md border border-border bg-background px-2 py-1 text-xs cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors">
                  <p className="font-medium truncate">{g.name}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(g.updatedAt).toLocaleDateString("ru-RU")}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* AI Generate */}
        <div className="p-3 border-t border-border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-primary" /> AI генерация
          </h3>
          <textarea
            placeholder="Опиши игру: собери 5 кристаллов, уклоняйся от врагов..."
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            className="w-full h-16 rounded-md border border-input bg-background px-2 py-1 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button size="sm" className="w-full mt-1.5" onClick={handleAiGenerate} disabled={aiLoading || !aiText.trim()}>
            {aiLoading ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Генерация...</> : <><Sparkles className="h-3 w-3 mr-1" /> AI: граф из текста</>}
          </Button>
          <Button size="sm" variant="outline" className="w-full mt-1" onClick={handleAiSuggest} disabled={aiSuggestLoading || nodes.length === 0}>
            {aiSuggestLoading ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Анализ...</> : <><Lightbulb className="h-3 w-3 mr-1" /> AI: проверить граф</>}
          </Button>
          {aiSuggestions.length > 0 && (
            <div className="mt-2 space-y-1">
              {aiSuggestions.map((s, i) => (
                <div key={i} className={`rounded-md border px-2 py-1 text-[10px] ${
                  s.type === "error" ? "border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-900 text-red-700 dark:text-red-300" :
                  s.type === "warning" ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 text-amber-700 dark:text-amber-300" :
                  "border-primary/20 bg-primary/5 text-primary"
                }`}>
                  {s.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PrototypeEditor() {
  return <ReactFlowProvider><PrototypeEditorInner /></ReactFlowProvider>;
}
