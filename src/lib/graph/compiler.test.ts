/**
 * Unit tests for src/lib/graph/compiler.ts — compileGraph().
 *
 * The compiler turns a NodeGraph JSON into a self-contained HTML file with
 * either LittleJS (2D) or Three.js (3D) code. We test:
 *  - Invalid graph produces no html + populated errors.
 *  - Each template compiles to a valid html string with expected substrings.
 *  - 3D mode emits Three.js (three.min.js + THREE. namespace).
 */
import { describe, it, expect } from "vitest";
import { compileGraph } from "@/lib/graph/compiler";
import { GRAPH_TEMPLATES } from "@/lib/graph/templates";
import type { NodeGraph } from "@/lib/graph/types";

// ---------- Invalid input ----------

describe("compileGraph — invalid input", () => {
  it("compiling an empty graph → valid:false, html:'', errors non-empty", () => {
    const graph: NodeGraph = {
      version: "1.0",
      nodes: [],
      edges: [],
      settings: {
        mode: "2d",
        canvasSize: { width: 400, height: 300 },
        targetFps: 60,
        backgroundColor: "#0f172a",
      },
    };
    const result = compileGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.html).toBe("");
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ---------- Collector template ----------

describe("compileGraph — Collector template", () => {
  it("compiles to valid LittleJS html", () => {
    const result = compileGraph(GRAPH_TEMPLATES.collector.graph);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    const html = result.html.toLowerCase();
    expect(html).toContain("<!doctype html>");
    // Either LittleJS or littlejs should appear (script src / powered-by line).
    expect(html).toContain("littlejs");
    // Collector has a player node.
    expect(html).toContain("player");
    // Win node emits a win() call somewhere.
    expect(html).toContain("win(");
  });
});

// ---------- Survival template ----------

describe("compileGraph — Survival template", () => {
  it("compiles to valid html containing 'enemy'", () => {
    const result = compileGraph(GRAPH_TEMPLATES.survival.graph);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    // The Survival template includes an Enemy node — enemy / enemies should
    // appear in the generated code (declaration + collision code).
    const html = result.html.toLowerCase();
    expect(html.includes("enemy") || html.includes("enemies")).toBe(true);
  });
});

// ---------- 3D mode ----------

describe("compileGraph — 3D mode", () => {
  it("emits Three.js script + THREE. namespace when settings.mode='3d'", () => {
    // Clone the collector template and flip its mode to "3d".
    const graph: NodeGraph = JSON.parse(
      JSON.stringify(GRAPH_TEMPLATES.collector.graph)
    );
    graph.settings.mode = "3d";
    const result = compileGraph(graph);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.html).toContain("three.min.js");
    expect(result.html).toContain("THREE.");
  });
});

// ---------- Remaining templates ----------

describe("compileGraph — remaining templates", () => {
  it("Tower Defense template → valid:true, non-empty html", () => {
    const result = compileGraph(GRAPH_TEMPLATES.tower_defense.graph);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.html.length).toBeGreaterThan(500);
    expect(result.html.toLowerCase()).toContain("<!doctype html>");
  });

  it("Rhythm template → valid:true, non-empty html", () => {
    const result = compileGraph(GRAPH_TEMPLATES.rhythm.graph);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.html.length).toBeGreaterThan(500);
    expect(result.html.toLowerCase()).toContain("<!doctype html>");
  });

  it("Puzzle template → valid:true, non-empty html", () => {
    const result = compileGraph(GRAPH_TEMPLATES.puzzle.graph);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.html.length).toBeGreaterThan(500);
    expect(result.html.toLowerCase()).toContain("<!doctype html>");
  });
});
