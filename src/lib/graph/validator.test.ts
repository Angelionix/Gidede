/**
 * Unit tests for src/lib/graph/validator.ts — validateGraph().
 *
 * Tests cover:
 *  - Empty graph rejection.
 *  - Missing required Event / Win-Lose node rejection.
 *  - All 5 GRAPH_TEMPLATES as positive cases (Collector / Survival /
 *    Tower Defense / Rhythm / Puzzle).
 *  - Cycle detection over exec edges.
 *  - Disconnected-node warning.
 */
import { describe, it, expect } from "vitest";
import { validateGraph } from "@/lib/graph/validator";
import { GRAPH_TEMPLATES } from "@/lib/graph/templates";
import type { NodeGraph, GraphNode, GraphEdge } from "@/lib/graph/types";

// ---------- Helpers ----------

const SETTINGS = {
  mode: "2d" as const,
  canvasSize: { width: 400, height: 300 },
  targetFps: 60,
  backgroundColor: "#0f172a",
};

function node(id: string, type: GraphNode["type"], x = 0, y = 0): GraphNode {
  return {
    id,
    type,
    position: { x, y },
    data: { label: type, properties: {} },
  };
}

function edge(
  id: string,
  source: string,
  sourceHandle: string | null,
  target: string,
  targetHandle: string | null = null
): GraphEdge {
  return { id, source, sourceHandle, target, targetHandle };
}

// ---------- Negative cases ----------

describe("validateGraph — negative cases", () => {
  it("empty graph (no nodes) → valid:false, error mentions 'пуст'", () => {
    const graph: NodeGraph = {
      version: "1.0",
      nodes: [],
      edges: [],
      settings: SETTINGS,
    };
    const r = validateGraph(graph);
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors.some((e) => e.message.includes("пуст"))).toBe(true);
  });

  it("graph with no Event node → valid:false, error mentions 'Event'", () => {
    // Player + win but no entry-point event.
    const graph: NodeGraph = {
      version: "1.0",
      nodes: [node("p", "player"), node("w", "win")],
      edges: [],
      settings: SETTINGS,
    };
    const r = validateGraph(graph);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.message.includes("Event"))).toBe(true);
  });

  it("graph with no Win/Lose (output) node → valid:false, error mentions 'Win/Lose'", () => {
    const graph: NodeGraph = {
      version: "1.0",
      nodes: [node("e", "onGameStart"), node("p", "player")],
      edges: [edge("e1", "e", "exec", "p", null)],
      settings: SETTINGS,
    };
    const r = validateGraph(graph);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.message.includes("Win/Lose"))).toBe(true);
  });

  it("graph with a cycle (A→B→A via exec edges) → valid:false, error mentions 'цикл'", () => {
    // Two flow nodes pointing at each other's exec pin — a classic loop.
    // Use `delay` nodes (single exec in, single exec out) to build a 2-cycle.
    const graph: NodeGraph = {
      version: "1.0",
      nodes: [
        node("evt", "onGameStart"),
        node("d1", "delay"),
        node("d2", "delay"),
        node("w", "win"),
      ],
      edges: [
        edge("e1", "evt", "exec", "d1", "exec"),
        edge("e2", "d1", "exec", "d2", "exec"),
        edge("e3", "d2", "exec", "d1", "exec"), // back-edge: cycle!
        edge("e4", "d1", "exec", "w", "trigger"),
      ],
      settings: SETTINGS,
    };
    const r = validateGraph(graph);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.message.toLowerCase().includes("цикл"))).toBe(true);
  });
});

// ---------- Positive cases (templates) ----------

describe("validateGraph — GRAPH_TEMPLATES are all valid", () => {
  it("Collector template → valid:true", () => {
    const r = validateGraph(GRAPH_TEMPLATES.collector.graph);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("Survival template → valid:true", () => {
    const r = validateGraph(GRAPH_TEMPLATES.survival.graph);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("Tower Defense template → valid:true", () => {
    const r = validateGraph(GRAPH_TEMPLATES.tower_defense.graph);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("Rhythm template → valid:true", () => {
    const r = validateGraph(GRAPH_TEMPLATES.rhythm.graph);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("Puzzle template → valid:true", () => {
    const r = validateGraph(GRAPH_TEMPLATES.puzzle.graph);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });
});

// ---------- Disconnected node warning ----------

describe("validateGraph — disconnected-node warning", () => {
  it("a graph with a disconnected node → valid:true, warnings non-empty and mention 'не подключена'", () => {
    // Take the collector template (which is fully valid) and append a
    // disconnected counter node that has no edges.
    const graph: NodeGraph = JSON.parse(
      JSON.stringify(GRAPH_TEMPLATES.collector.graph)
    );
    graph.nodes.push({
      id: "lonely",
      type: "counter",
      position: { x: 999, y: 999 },
      data: { label: "counter", properties: { startValue: 0, threshold: 99 } },
    });
    const r = validateGraph(graph);
    expect(r.valid).toBe(true);
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(
      r.warnings.some((w) => w.message.includes("не подключена"))
    ).toBe(true);
  });
});
