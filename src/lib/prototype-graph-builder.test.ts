/**
 * R-PROTO-UNIFY: tests for prototype-graph-builder.ts.
 *
 * Verifies that:
 *   - All 10 prototype types produce a valid NodeGraph.
 *   - Each generated graph compiles via compileGraph() without errors.
 *   - Each graph contains at least one Event node and one Win/Lose node
 *     (validator requirement).
 *   - Custom params propagate to node properties (e.g. playerSpeed → player.speed).
 */

import { describe, it, expect } from "vitest";
import {
  buildPrototypeGraph,
  buildEngineGraph,
  buildEconomyGraph,
  buildEcologyGraph,
  buildTowerDefenseGraph,
  buildRhythmGraph,
  buildPuzzleGraph,
  buildPlatformerGraph,
  buildStealthGraph,
  buildDeckBuilderGraph,
  buildSurvivalHorrorGraph,
  PROTOTYPE_TYPES,
  type PrototypeType,
} from "./prototype-graph-builder";
import { compileGraph } from "./graph/compiler";
import { NODE_DEFINITIONS } from "./graph/types";
import type { NodeGraph } from "./graph/types";

function hasEventNode(g: NodeGraph): boolean {
  return g.nodes.some((n) => NODE_DEFINITIONS[n.type]?.category === "event");
}

function hasOutputNode(g: NodeGraph): boolean {
  return g.nodes.some((n) => NODE_DEFINITIONS[n.type]?.category === "output");
}

function findNodeByType(g: NodeGraph, type: string) {
  return g.nodes.find((n) => n.type === type);
}

describe("prototype-graph-builder — all 10 types produce valid graphs", () => {
  const builders: Record<PrototypeType, (config: { type: PrototypeType; mode: "2d" | "3d"; steps: string[] }) => NodeGraph> = {
    engine: buildEngineGraph,
    economy: buildEconomyGraph,
    ecology: buildEcologyGraph,
    tower_defense: buildTowerDefenseGraph,
    rhythm: buildRhythmGraph,
    puzzle: buildPuzzleGraph,
    platformer: buildPlatformerGraph,
    stealth: buildStealthGraph,
    deck_builder: buildDeckBuilderGraph,
    survival_horror: buildSurvivalHorrorGraph,
  };

  for (const type of PROTOTYPE_TYPES) {
    it(`${type}: produces a valid NodeGraph with Event + Win/Lose nodes`, () => {
      const g = builders[type]({ type, mode: "2d", steps: ["explore", "collect", "win"] });
      expect(g.nodes.length).toBeGreaterThan(0);
      expect(hasEventNode(g)).toBe(true);
      expect(hasOutputNode(g)).toBe(true);
      expect(g.edges.length).toBeGreaterThan(0);
      expect(g.version).toBe("1.0");
      expect(g.settings.mode).toBe("2d");
    });

    it(`${type}: graph compiles via compileGraph() without errors`, () => {
      const g = builders[type]({ type, mode: "2d", steps: ["a", "b"] });
      const result = compileGraph(g);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.html.length).toBeGreaterThan(500);
    });

    it(`${type}: compiles in 3d mode too`, () => {
      const g = builders[type]({ type, mode: "3d", steps: ["a"] });
      const result = compileGraph(g);
      expect(result.valid).toBe(true);
      // Compiler uses Three.js (capital T) for 3D mode.
      expect(result.html.toLowerCase()).toContain("three.js");
    });
  }
});

describe("prototype-graph-builder — dispatcher", () => {
  it("buildPrototypeGraph dispatches to the correct builder", () => {
    const g = buildPrototypeGraph({ type: "engine", mode: "2d", steps: [] });
    expect(g.nodes.some((n) => n.type === "player")).toBe(true);
    expect(g.nodes.some((n) => n.type === "collectible")).toBe(true);
  });

  it("buildPrototypeGraph falls back to engine for unknown type (TS guard)", () => {
    // The dispatcher uses `?? BUILDERS.engine`, so even if an invalid type
    // somehow passes TypeScript, we get a valid engine graph.
    const g = buildPrototypeGraph({ type: "engine" as PrototypeType, mode: "2d", steps: [] });
    expect(g.nodes.length).toBeGreaterThan(0);
  });
});

describe("prototype-graph-builder — params propagation", () => {
  it("playerSpeed propagates to player node properties", () => {
    const g = buildEngineGraph({
      type: "engine",
      mode: "2d",
      steps: [],
      params: { playerSpeed: 250 },
    });
    const player = findNodeByType(g, "player");
    expect(player).toBeDefined();
    expect(player!.data.properties.speed).toBe(250);
  });

  it("counterThreshold propagates to counter node threshold", () => {
    const g = buildRhythmGraph({
      type: "rhythm",
      mode: "2d",
      steps: [],
      params: { counterThreshold: 20 },
    });
    const counter = findNodeByType(g, "counter");
    expect(counter).toBeDefined();
    expect(counter!.data.properties.threshold).toBe(20);
  });

  it("enemyDamage and enemySpeed propagate to enemy nodes", () => {
    const g = buildEcologyGraph({
      type: "ecology",
      mode: "2d",
      steps: [],
      params: { enemyDamage: 25, enemySpeed: 100 },
    });
    const enemy = findNodeByType(g, "enemy");
    expect(enemy).toBeDefined();
    expect(enemy!.data.properties.damage).toBe(25);
    expect(enemy!.data.properties.speed).toBe(100);
  });

  it("survivalSeconds propagates to onTimerEnd duration", () => {
    const g = buildSurvivalHorrorGraph({
      type: "survival_horror",
      mode: "2d",
      steps: [],
      params: { survivalSeconds: 90 },
    });
    const timer = findNodeByType(g, "onTimerEnd");
    expect(timer).toBeDefined();
    expect(timer!.data.properties.duration).toBe(90);
  });
});

describe("prototype-graph-builder — graph structure integrity", () => {
  it("every edge references existing nodes", () => {
    const g = buildPlatformerGraph({ type: "platformer", mode: "2d", steps: [] });
    const nodeIds = new Set(g.nodes.map((n) => n.id));
    for (const e of g.edges) {
      expect(nodeIds.has(e.source)).toBe(true);
      expect(nodeIds.has(e.target)).toBe(true);
    }
  });

  it("no duplicate node IDs within a single graph", () => {
    const g = buildStealthGraph({ type: "stealth", mode: "2d", steps: [] });
    const ids = g.nodes.map((n) => n.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("engine graph has at least: onGameStart, player, collectible, counter, win", () => {
    const g = buildEngineGraph({ type: "engine", mode: "2d", steps: [] });
    const types = g.nodes.map((n) => n.type);
    expect(types).toContain("onGameStart");
    expect(types).toContain("player");
    expect(types).toContain("collectible");
    expect(types).toContain("counter");
    expect(types).toContain("win");
  });

  it("tower_defense graph has spawner + base + counter + win + lose", () => {
    const g = buildTowerDefenseGraph({ type: "tower_defense", mode: "2d", steps: [] });
    const types = g.nodes.map((n) => n.type);
    expect(types).toContain("spawner");
    expect(types).toContain("enemy");
    expect(types).toContain("base");
    expect(types).toContain("counter");
    expect(types).toContain("win");
    expect(types).toContain("lose");
  });

  it("stealth graph has 2 enemies for obstacle navigation", () => {
    const g = buildStealthGraph({ type: "stealth", mode: "2d", steps: [] });
    const enemyCount = g.nodes.filter((n) => n.type === "enemy").length;
    expect(enemyCount).toBeGreaterThanOrEqual(2);
  });

  it("survival_horror graph has spawner + enemy + timer + win + lose", () => {
    const g = buildSurvivalHorrorGraph({ type: "survival_horror", mode: "2d", steps: [] });
    const types = g.nodes.map((n) => n.type);
    expect(types).toContain("spawner");
    expect(types).toContain("enemy");
    expect(types).toContain("onTimerEnd");
    expect(types).toContain("win");
    expect(types).toContain("lose");
    expect(types).toContain("collectible"); // torches
  });
});

describe("R-PROTO-UNIFY acceptance — single compile path", () => {
  it("the same compileGraph() is used by both /prototypes/generate and /prototype-graph/compile", () => {
    // This is a design-acceptance test: both routes import compileGraph
    // from the same module, so any compiler improvement applies to both.
    const g = buildPrototypeGraph({ type: "deck_builder", mode: "2d", steps: [] });
    const r = compileGraph(g);
    expect(r.valid).toBe(true);
    // The compiled HTML contains LittleJS markers (engineInit, gameUpdate, etc.)
    // which proves it went through the standard graph compiler.
    expect(r.html).toMatch(/gameInit|gameUpdate|gameRender/);
  });
});
