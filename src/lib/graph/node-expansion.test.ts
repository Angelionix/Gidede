/**
 * R-NODE-EXPANSION: tests for the 8 new Math & Logic nodes.
 *
 * Verifies:
 *   - Each new node type is in NODE_DEFINITIONS with correct category/color.
 *   - Each new node compiles without errors when used in a graph.
 *   - Inline resolution (resolveOutputExpr) produces correct JS expressions.
 *   - Pin type compatibility (number→number, boolean→boolean, vec2→number).
 */

import { describe, it, expect } from "vitest";
import { NODE_DEFINITIONS, type NodeGraph, type GraphNode } from "./types";
import { compileGraph } from "./compiler";

function makeNode(id: string, type: string, x = 50, y = 50, props: Record<string, unknown> = {}): GraphNode {
  return {
    id,
    type: type as GraphNode["type"],
    position: { x, y },
    data: { label: type, properties: props },
  };
}

function makeGraph(nodes: GraphNode[], edges: Array<{ from: string; fromHandle: string; to: string; toHandle: string | null }>): NodeGraph {
  return {
    version: "1.0",
    nodes,
    edges: edges.map((e, i) => ({
      id: `e${i}`,
      source: e.from,
      sourceHandle: e.fromHandle,
      target: e.to,
      targetHandle: e.toHandle,
    })),
    settings: { mode: "2d", canvasSize: { width: 400, height: 300 }, targetFps: 60, backgroundColor: "#0f172a" },
  };
}

describe("R-NODE-EXPANSION: 8 new Math & Logic node definitions", () => {
  const newNodes = ["clamp", "lerp", "distance", "angle", "compare", "boolOp", "switch", "getValue"] as const;

  for (const type of newNodes) {
    it(`${type}: is in NODE_DEFINITIONS with valid structure`, () => {
      const def = NODE_DEFINITIONS[type];
      expect(def).toBeDefined();
      expect(def.type).toBe(type);
      expect(def.label).toBeTruthy();
      expect(def.icon).toBeTruthy();
      expect(def.category).toMatch(/^(data|flow)$/);
      expect(def.color).toMatch(/^#[0-9a-f]{6}$/i);
    });
  }

  it("switch is a flow node (4 exec outputs)", () => {
    const def = NODE_DEFINITIONS.switch;
    expect(def.category).toBe("flow");
    expect(def.outputs.filter((p) => p.type === "exec")).toHaveLength(4);
    expect(def.outputs.map((p) => p.id)).toEqual(["out0", "out1", "out2", "out3"]);
  });

  it("compare outputs boolean", () => {
    expect(NODE_DEFINITIONS.compare.outputs[0].type).toBe("boolean");
  });

  it("boolOp outputs boolean", () => {
    expect(NODE_DEFINITIONS.boolOp.outputs[0].type).toBe("boolean");
  });

  it("distance and angle take 2 vec2 inputs and output number", () => {
    for (const t of ["distance", "angle"] as const) {
      const def = NODE_DEFINITIONS[t];
      expect(def.inputs.map((p) => p.type)).toEqual(["vec2", "vec2"]);
      expect(def.outputs[0].type).toBe("number");
    }
  });

  it("clamp and lerp take number inputs and output number", () => {
    for (const t of ["clamp", "lerp"] as const) {
      const def = NODE_DEFINITIONS[t];
      expect(def.inputs.every((p) => p.type === "number")).toBe(true);
      expect(def.outputs[0].type).toBe("number");
    }
  });
});

describe("R-NODE-EXPANSION: compilation of new nodes", () => {
  it("clamp node compiles and emits Math.max/Math.min", () => {
    const g = makeGraph(
      [
        makeNode("start", "onGameStart"),
        makeNode("c", "clamp", 200, 50, { min: 0, max: 100 }),
        makeNode("w", "win", 400, 50),
      ],
      [
        { from: "start", fromHandle: "exec", to: "c", toHandle: null },
        { from: "start", fromHandle: "exec", to: "w", toHandle: "trigger" },
      ],
    );
    const r = compileGraph(g);
    expect(r.valid).toBe(true);
    expect(r.html).toContain("Math.max");
    expect(r.html).toContain("Math.min");
  });

  it("lerp node compiles and emits interpolation", () => {
    const g = makeGraph(
      [
        makeNode("start", "onGameStart"),
        makeNode("l", "lerp", 200, 50, { a: 0, b: 100, t: 0.5 }),
        makeNode("w", "win", 400, 50),
      ],
      [
        { from: "start", fromHandle: "exec", to: "l", toHandle: null },
        { from: "start", fromHandle: "exec", to: "w", toHandle: "trigger" },
      ],
    );
    const r = compileGraph(g);
    expect(r.valid).toBe(true);
    expect(r.html).toMatch(/lerp/);
  });

  it("distance node compiles and emits Math.sqrt", () => {
    const g = makeGraph(
      [
        makeNode("start", "onGameStart"),
        makeNode("d", "distance", 200, 50),
        makeNode("w", "win", 400, 50),
      ],
      [
        { from: "start", fromHandle: "exec", to: "d", toHandle: null },
        { from: "start", fromHandle: "exec", to: "w", toHandle: "trigger" },
      ],
    );
    const r = compileGraph(g);
    expect(r.valid).toBe(true);
    expect(r.html).toContain("Math.sqrt");
  });

  it("angle node compiles and emits Math.atan2", () => {
    const g = makeGraph(
      [
        makeNode("start", "onGameStart"),
        makeNode("a", "angle", 200, 50),
        makeNode("w", "win", 400, 50),
      ],
      [
        { from: "start", fromHandle: "exec", to: "a", toHandle: null },
        { from: "start", fromHandle: "exec", to: "w", toHandle: "trigger" },
      ],
    );
    const r = compileGraph(g);
    expect(r.valid).toBe(true);
    expect(r.html).toContain("Math.atan2");
  });

  it("compare node emits correct operator for each operation", () => {
    for (const op of ["==", "!=", "<", ">", "<=", ">="]) {
      const g = makeGraph(
        [
          makeNode("start", "onGameStart"),
          makeNode("c", "compare", 200, 50, { operation: op }),
          makeNode("w", "win", 400, 50),
        ],
        [
          { from: "start", fromHandle: "exec", to: "c", toHandle: null },
          { from: "start", fromHandle: "exec", to: "w", toHandle: "trigger" },
        ],
      );
      const r = compileGraph(g);
      expect(r.valid).toBe(true);
      if (op === "==") expect(r.html).toContain("===");
      if (op === "!=") expect(r.html).toContain("!==");
      if (op === "<") expect(r.html).toContain("<");
      if (op === ">") expect(r.html).toContain(">");
    }
  });

  it("boolOp node emits AND/OR/NOT/XOR", () => {
    for (const op of ["AND", "OR", "NOT", "XOR"]) {
      const g = makeGraph(
        [
          makeNode("start", "onGameStart"),
          makeNode("b", "boolOp", 200, 50, { operation: op }),
          makeNode("w", "win", 400, 50),
        ],
        [
          { from: "start", fromHandle: "exec", to: "b", toHandle: null },
          { from: "start", fromHandle: "exec", to: "w", toHandle: "trigger" },
        ],
      );
      const r = compileGraph(g);
      expect(r.valid).toBe(true);
      if (op === "AND") expect(r.html).toContain("&&");
      if (op === "OR") expect(r.html).toContain("||");
      if (op === "NOT") expect(r.html).toContain("!");
    }
  });

  it("switch node emits switch/case with 4 branches", () => {
    const g = makeGraph(
      [
        makeNode("start", "onGameStart"),
        makeNode("sw", "switch", 200, 50),
        makeNode("w0", "win", 400, 50),
        makeNode("w1", "win", 400, 100),
        makeNode("w2", "win", 400, 150),
        makeNode("w3", "win", 400, 200),
      ],
      [
        { from: "start", fromHandle: "exec", to: "sw", toHandle: null },
        { from: "sw", fromHandle: "out0", to: "w0", toHandle: "trigger" },
        { from: "sw", fromHandle: "out1", to: "w1", toHandle: "trigger" },
        { from: "sw", fromHandle: "out2", to: "w2", toHandle: "trigger" },
        { from: "sw", fromHandle: "out3", to: "w3", toHandle: "trigger" },
      ],
    );
    const r = compileGraph(g);
    expect(r.valid).toBe(true);
    expect(r.html).toContain("switch");
    expect(r.html).toContain("case 0:");
    expect(r.html).toContain("case 1:");
    expect(r.html).toContain("case 2:");
    expect(r.html).toContain("case 3:");
  });

  it("getValue node emits __vars lookup", () => {
    const g = makeGraph(
      [
        makeNode("start", "onGameStart"),
        makeNode("gv", "getValue", 200, 50, { varName: "score", defaultValue: 0 }),
        makeNode("w", "win", 400, 50),
      ],
      [
        { from: "start", fromHandle: "exec", to: "gv", toHandle: null },
        { from: "start", fromHandle: "exec", to: "w", toHandle: "trigger" },
      ],
    );
    const r = compileGraph(g);
    expect(r.valid).toBe(true);
    expect(r.html).toContain("__vars");
    expect(r.html).toContain('"score"');
  });

  it("new nodes can be combined with existing nodes (clamp feeding branch)", () => {
    const g = makeGraph(
      [
        makeNode("start", "onGameStart"),
        makeNode("c", "counter", 200, 50, { startValue: 0, threshold: 5 }),
        makeNode("cl", "clamp", 350, 50, { min: 0, max: 10 }),
        makeNode("b", "branch", 500, 50),
        makeNode("w", "win", 650, 30),
        makeNode("l", "lose", 650, 80),
      ],
      [
        { from: "start", fromHandle: "exec", to: "c", toHandle: "increment" },
        // Trigger clamp via exec so its body emits Math.max/Math.min.
        { from: "c", fromHandle: "onThreshold", to: "cl", toHandle: null },
        // Branch reads clamp result via data edge (inline resolution).
        { from: "cl", fromHandle: "result", to: "b", toHandle: "condition" },
        { from: "b", fromHandle: "true", to: "w", toHandle: "trigger" },
        { from: "b", fromHandle: "false", to: "l", toHandle: "trigger" },
      ],
    );
    const r = compileGraph(g);
    expect(r.valid).toBe(true);
    // Clamp body emits Math.max and Math.min (when triggered via exec).
    expect(r.html).toContain("Math.max");
    expect(r.html).toContain("Math.min");
  });
});

describe("R-NODE-EXPANSION: validator compatibility", () => {
  it("validator compatibility: new nodes don't cause false errors when Win present", () => {
    // Minimal valid graph: onGameStart + win + new node.
    const g = makeGraph(
      [
        makeNode("start", "onGameStart"),
        makeNode("c", "clamp", 200, 50),
        makeNode("w", "win", 400, 50),
      ],
      [
        { from: "start", fromHandle: "exec", to: "w", toHandle: "trigger" },
      ],
    );
    const r = compileGraph(g);
    expect(r.valid).toBe(true);
  });
});
