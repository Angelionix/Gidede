/**
 * Tests for scene grammar — topology selection + world synthesis.
 *
 * Phase 1.4 acceptance criteria:
 * - Topology is selected based on mechanic affinity
 * - Selection is deterministic (same inputs → same output)
 * - Tie-breaking is stable (same order for equal scores)
 * - World synthesis creates minimal entities (player spawn if missing,
 *   topology-specific entities)
 */

import { describe, expect, it } from "vitest";
import { selectTopology, synthesizeWorld } from "../scene-grammar";
import type { EntitySpec } from "../../ir/types";
import type { Capability } from "../../registry/registry";

describe("selectTopology — basic selection", () => {
  it("selects 'arena' for combat + locomotion capabilities", () => {
    const result = selectTopology(["locomotion", "target/combat"] as Capability[], "ecology");
    expect(result.topology).toBe("arena");
    expect(result.scores[0].score).toBeGreaterThan(0);
    expect(result.reasoning).toContain("combat");
  });

  it("selects 'lanes' for defend + wave capabilities", () => {
    const result = selectTopology(["defend", "target/combat"] as Capability[], "tower_defense");
    expect(result.topology).toBe("lanes");
  });

  it("selects 'node_field' for collect + convert capabilities", () => {
    const result = selectTopology(["collect", "convert/craft"] as Capability[], "economy");
    expect(result.topology).toBe("node_field");
  });

  it("selects 'grid' for puzzle + transform capabilities", () => {
    const result = selectTopology(["puzzle", "transform"] as Capability[], "puzzle");
    expect(result.topology).toBe("grid");
  });

  it("selects 'rooms' for stealth + interact capabilities", () => {
    const result = selectTopology(["avoid/survive", "interact/deliver"] as Capability[], "stealth");
    expect(result.topology).toBe("rooms");
  });
});

describe("selectTopology — determinism", () => {
  it("returns the same result for identical inputs", () => {
    const caps: Capability[] = ["locomotion", "target/combat"];
    const r1 = selectTopology(caps, "ecology");
    const r2 = selectTopology(caps, "ecology");
    expect(r1.topology).toBe(r2.topology);
    expect(r1.scores).toEqual(r2.scores);
  });

  it("tie-breaking is stable (same order for equal scores)", () => {
    // Empty capabilities → all topologies have score 0 → tie.
    // Tie should resolve to stable order: arena first.
    const result = selectTopology([], null);
    expect(result.topology).toBe("arena");
    expect(result.scores[0].topology).toBe("arena");
  });
});

describe("selectTopology — structural prior", () => {
  it("structural type adds +1 to matching topology", () => {
    const noStructural = selectTopology(["locomotion"] as Capability[], null);
    const withStructural = selectTopology(["locomotion"] as Capability[], "ecology");
    // ecology → arena prior. Locomotion also favors arena.
    // Score should be higher with structural prior.
    const arenaScoreNoStruct = noStructural.scores.find((s) => s.topology === "arena")!.score;
    const arenaScoreWithStruct = withStructural.scores.find((s) => s.topology === "arena")!.score;
    expect(arenaScoreWithStruct).toBe(arenaScoreNoStruct + 1);
  });
});

describe("selectTopology — scores", () => {
  it("returns scores for all 5 topologies", () => {
    const result = selectTopology(["locomotion"] as Capability[], "engine");
    expect(result.scores).toHaveLength(5);
    const topologyNames = result.scores.map((s) => s.topology);
    expect(topologyNames).toContain("arena");
    expect(topologyNames).toContain("lanes");
    expect(topologyNames).toContain("rooms");
    expect(topologyNames).toContain("grid");
    expect(topologyNames).toContain("node_field");
  });

  it("scores are sorted descending", () => {
    const result = selectTopology(["locomotion", "target/combat"] as Capability[], "ecology");
    for (let i = 1; i < result.scores.length; i++) {
      expect(result.scores[i - 1].score).toBeGreaterThanOrEqual(result.scores[i].score);
    }
  });

  it("includes a human-readable reasoning string", () => {
    const result = selectTopology(["locomotion"] as Capability[], "engine");
    expect(result.reasoning).toContain("locomotion");
    expect(result.reasoning).toContain("engine");
  });
});

describe("synthesizeWorld — arena topology", () => {
  it("creates world bounds with correct dimensions", () => {
    const result = synthesizeWorld("arena", [], "abcdef0123");
    expect(result.scene.topology).toBe("arena");
    expect(result.scene.bounds.halfExtents.x).toBe(400);
    expect(result.scene.bounds.halfExtents.y).toBe(300);
  });

  it("creates player spawn when no player entity exists", () => {
    const result = synthesizeWorld("arena", [], "abcdef0123");
    expect(result.worldEntities.some((e) => e.role === "player")).toBe(true);
    const player = result.worldEntities.find((e) => e.role === "player");
    expect(player?.deterministicId).toContain("det-player-spawn");
  });

  it("does NOT create player spawn when player entity already exists", () => {
    const existingPlayer: EntitySpec = {
      id: "existing-player",
      role: "player",
      deterministicId: "det-existing",
      components: [],
      spawnSchedule: null,
    };
    const result = synthesizeWorld("arena", [existingPlayer], "abcdef0123");
    expect(result.worldEntities.filter((e) => e.role === "player")).toHaveLength(0);
  });
});

describe("synthesizeWorld — lanes topology", () => {
  it("creates a base entity at the left edge", () => {
    const result = synthesizeWorld("lanes", [], "abcdef0123");
    const base = result.worldEntities.find((e) => e.role === "base");
    expect(base).toBeDefined();
    expect(base?.id).toBe("world-base");
  });

  it("has wider bounds than arena (for wave progression)", () => {
    const arena = synthesizeWorld("arena", [], "abcdef0123");
    const lanes = synthesizeWorld("lanes", [], "abcdef0123");
    expect(lanes.scene.bounds.halfExtents.x).toBeGreaterThan(arena.scene.bounds.halfExtents.x);
  });
});

describe("synthesizeWorld — node_field topology", () => {
  it("creates 4 resource nodes", () => {
    const result = synthesizeWorld("node_field", [], "abcdef0123");
    const nodes = result.worldEntities.filter((e) => e.role === "collectible");
    expect(nodes).toHaveLength(4);
  });

  it("places nodes deterministically (same seed → same positions)", () => {
    const r1 = synthesizeWorld("node_field", [], "abcdef0123");
    const r2 = synthesizeWorld("node_field", [], "abcdef0123");
    const nodes1 = r1.worldEntities.filter((e) => e.role === "collectible");
    const nodes2 = r2.worldEntities.filter((e) => e.role === "collectible");
    for (let i = 0; i < nodes1.length; i++) {
      const t1 = nodes1[i].components.find((c) => c.kind === "transform");
      const t2 = nodes2[i].components.find((c) => c.kind === "transform");
      if (t1?.kind === "transform" && t2?.kind === "transform") {
        expect(t1.data.position).toEqual(t2.data.position);
      }
    }
  });
});

describe("synthesizeWorld — assumptions", () => {
  it("includes world bounds in assumptions", () => {
    const result = synthesizeWorld("arena", [], "abcdef0123");
    expect(result.assumptions.some((a) => a.includes("World bounds"))).toBe(true);
  });

  it("includes topology in assumptions", () => {
    const result = synthesizeWorld("grid", [], "abcdef0123");
    expect(result.assumptions.some((a) => a.includes("grid"))).toBe(true);
  });

  it("notes when player spawn is auto-created", () => {
    const result = synthesizeWorld("arena", [], "abcdef0123");
    expect(result.assumptions.some((a) => a.includes("Player spawn created"))).toBe(true);
  });
});
