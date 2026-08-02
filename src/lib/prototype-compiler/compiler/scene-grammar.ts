/**
 * Scene grammar — topology selection + world synthesis.
 *
 * Selects a scene topology based on mechanic affinity scores, then
 * synthesizes the minimal set of primitive entities needed to execute
 * the compiled rules.
 *
 * Design spec: docs/PLAYABLE_PROTOTYPE_COMPILER_DESIGN.md (section 8, steps 4-5)
 *
 * Topology scoring:
 *   topologyScore = mechanicAffinity + interactionAffinity + structuralPrior - conflicts
 *
 * MVP topologies:
 * - arena: movement/combat/avoid (open area, player + enemies + hazards)
 * - lanes: defense/waves/racing (linear path, waves advance toward base)
 *
 * Primitive mapping (2D / 3D):
 *   actor      → circle / capsule
 *   obstacle   → rectangle / box
 *   collectible→ circle/diamond / sphere/octahedron
 *   projectile → small circle / small sphere
 *   base       → rectangle / box
 *   hazard     → pulsing circle / cylinder
 */

import type {
  AABB,
  EntitySpec,
  SceneSpec,
  SceneTopology,
} from "../ir/types";
import type { Capability } from "../registry/registry";

// ============================================================
// Topology affinity matrix
// ============================================================

/**
 * Each capability has affinity with certain topologies.
 * Higher score = better fit.
 */
const CAPABILITY_TOPOLOGY_AFFINITY: Record<Capability, Partial<Record<SceneTopology, number>>> = {
  "locomotion": { arena: 3, lanes: 2, rooms: 3, node_field: 2, grid: 1 },
  "collect": { arena: 2, node_field: 3, rooms: 2, grid: 1, lanes: 1 },
  "target/combat": { arena: 3, lanes: 2, rooms: 2, node_field: 1, grid: 1 },
  "avoid/survive": { arena: 3, lanes: 2, rooms: 3, node_field: 1, grid: 1 },
  "interact/deliver": { rooms: 3, lanes: 2, node_field: 2, arena: 1, grid: 1 },
  "convert/craft": { node_field: 3, grid: 2, rooms: 1, arena: 1, lanes: 1 },
  "build/place": { grid: 3, lanes: 2, node_field: 2, arena: 1, rooms: 1 },
  "defend": { lanes: 3, arena: 2, grid: 2, rooms: 1, node_field: 1 },
  "upgrade": { node_field: 2, arena: 1, lanes: 1, rooms: 1, grid: 1 },
  "transform": { grid: 3, rooms: 2, node_field: 2, arena: 1, lanes: 1 },
  "puzzle": { grid: 3, rooms: 2, node_field: 1, arena: 1, lanes: 1 },
  "timing": { lanes: 2, arena: 2, rooms: 1, node_field: 1, grid: 1 },
};

/**
 * Structural type provides a prior (weak signal, +1 to matching topology).
 */
const STRUCTURAL_TYPE_PRIOR: Record<string, SceneTopology> = {
  engine: "arena",
  economy: "node_field",
  ecology: "arena",
  tower_defense: "lanes",
  rhythm: "lanes",
  puzzle: "grid",
  platformer: "lanes",
  stealth: "rooms",
  deck_builder: "arena",
  survival_horror: "rooms",
};

// ============================================================
// Topology selection
// ============================================================

export interface TopologySelectionResult {
  topology: SceneTopology;
  scores: Array<{ topology: SceneTopology; score: number }>;
  reasoning: string;
}

/**
 * Select the best topology based on capabilities + structural type.
 *
 * @param capabilities  Capabilities of the resolved mechanic adapters.
 * @param structuralType  Core Loop structural type (provides a prior).
 */
export function selectTopology(
  capabilities: Capability[],
  structuralType: string | null,
): TopologySelectionResult {
  const allTopologies: SceneTopology[] = ["arena", "lanes", "rooms", "grid", "node_field"];
  const scores: Array<{ topology: SceneTopology; score: number }> = [];

  for (const topo of allTopologies) {
    let score = 0;

    // Mechanic affinity: sum of each capability's affinity for this topology.
    for (const cap of capabilities) {
      const affinity = CAPABILITY_TOPOLOGY_AFFINITY[cap]?.[topo] ?? 0;
      score += affinity;
    }

    // Structural prior: +1 if structural type maps to this topology.
    if (structuralType && STRUCTURAL_TYPE_PRIOR[structuralType] === topo) {
      score += 1;
    }

    scores.push({ topology: topo, score });
  }

  // Sort by score descending; tie-break by stable order (allTopologies order).
  scores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return allTopologies.indexOf(a.topology) - allTopologies.indexOf(b.topology);
  });

  const winner = scores[0];
  const reasoning = capabilities.length === 0
    ? `No capabilities provided; selected '${winner.topology}' as default (structural prior: ${structuralType ?? "none"})`
    : `Capabilities [${capabilities.join(", ")}] + structural type '${structuralType ?? "none"}' → highest affinity for '${winner.topology}' (score ${winner.score})`;

  return {
    topology: winner.topology,
    scores,
    reasoning,
  };
}

// ============================================================
// World synthesis
// ============================================================

export interface WorldSynthesisResult {
  scene: SceneSpec;
  /** Additional entities created by the world grammar (boundaries, spawn points). */
  worldEntities: EntitySpec[];
  assumptions: string[];
}

/**
 * Synthesize the minimal primitive world for the selected topology.
 *
 * Creates:
 * - World bounds (AABB)
 * - Player spawn (if not already declared by an adapter)
 * - Topology-specific entities (boundaries, lanes, grid cells)
 *
 * Color encodes role, not genre:
 *   player → green, threat → red, resource → gold, goal → blue, hazard → orange
 */
export function synthesizeWorld(
  topology: SceneTopology,
  existingEntities: EntitySpec[],
  seed: string,
): WorldSynthesisResult {
  const bounds: AABB = topology === "arena"
    ? { center: { x: 0, y: 0 }, halfExtents: { x: 400, y: 300 } }
    : topology === "lanes"
      ? { center: { x: 0, y: 0 }, halfExtents: { x: 500, y: 200 } }
      : topology === "rooms"
        ? { center: { x: 0, y: 0 }, halfExtents: { x: 500, y: 350 } }
        : topology === "grid"
          ? { center: { x: 0, y: 0 }, halfExtents: { x: 300, y: 300 } }
          : { center: { x: 0, y: 0 }, halfExtents: { x: 450, y: 300 } }; // node_field

  const worldEntities: EntitySpec[] = [];
  const assumptions: string[] = [
    `World bounds: ${bounds.halfExtents.x * 2}x${bounds.halfExtents.y * 2} units`,
    `Topology '${topology}' selected`,
  ];

  // Player spawn: if no player entity exists, create one at center.
  const hasPlayer = existingEntities.some((e) => e.role === "player");
  if (!hasPlayer) {
    worldEntities.push({
      id: "world-player-spawn",
      role: "player",
      deterministicId: `det-player-spawn-${seed.substring(0, 6)}`,
      components: [
        {
          kind: "transform",
          data: {
            position: { x: 0, y: 0 },
            rotation: 0,
            scale: { x: 1, y: 1 },
          },
        },
        {
          kind: "collider",
          shape: "circle",
          data: { center: { x: 0, y: 0 }, radius: 20 },
        },
      ],
      spawnSchedule: null,
    });
    assumptions.push("Player spawn created at world center (no player entity declared by adapters)");
  }

  // Topology-specific world entities.
  if (topology === "lanes") {
    // Base/goal at the left edge (player defends it).
    worldEntities.push({
      id: "world-base",
      role: "base",
      deterministicId: `det-base-${seed.substring(0, 6)}`,
      components: [
        {
          kind: "transform",
          data: {
            position: { x: -bounds.halfExtents.x + 40, y: 0 },
            rotation: 0,
            scale: { x: 2, y: 4 },
          },
        },
        {
          kind: "collider",
          shape: "aabb",
          data: {
            center: { x: -bounds.halfExtents.x + 40, y: 0 },
            halfExtents: { x: 40, y: 80 },
          },
        },
      ],
      spawnSchedule: null,
    });
    assumptions.push("Base entity placed at left edge (player defends it from advancing enemies)");
  }

  if (topology === "rooms") {
    // Doorways/obstacles dividing the area into rooms.
    worldEntities.push({
      id: "world-wall-1",
      role: "obstacle",
      deterministicId: `det-wall-1-${seed.substring(0, 6)}`,
      components: [
        {
          kind: "transform",
          data: {
            position: { x: 0, y: bounds.halfExtents.y / 2 },
            rotation: 0,
            scale: { x: 8, y: 1 },
          },
        },
        {
          kind: "collider",
          shape: "aabb",
          data: {
            center: { x: 0, y: bounds.halfExtents.y / 2 },
            halfExtents: { x: bounds.halfExtents.x - 60, y: 20 },
          },
        },
      ],
      spawnSchedule: null,
    });
    assumptions.push("Wall obstacle divides the area into 2 rooms");
  }

  if (topology === "grid") {
    // Grid cells are implicit — the puzzle system handles grid state.
    assumptions.push("Grid cells are implicit; puzzle system manages grid state");
  }

  if (topology === "node_field") {
    // Resource nodes scattered deterministically.
    const nodeCount = 4;
    const seedHash = hashString(seed + "node_field");
    for (let i = 0; i < nodeCount; i++) {
      const pos = deterministicPosition(seedHash + i * 1000, bounds);
      worldEntities.push({
        id: `world-node-${i}`,
        role: "collectible",
        deterministicId: `det-node-${i}-${seedHash.toString(16).substring(0, 4)}`,
        components: [
          {
            kind: "transform",
            data: { position: pos, rotation: 0, scale: { x: 1, y: 1 } },
          },
          {
            kind: "collider",
            shape: "circle",
            data: { center: pos, radius: 18 },
          },
        ],
        spawnSchedule: null,
      });
    }
    assumptions.push(`${nodeCount} resource nodes placed deterministically`);
  }

  const scene: SceneSpec = {
    topology,
    bounds,
    topologyScores: [], // filled by caller from selectTopology result
  };

  return { scene, worldEntities, assumptions };
}

// ============================================================
// Deterministic helpers
// ============================================================

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function deterministicPosition(seed: number, bounds: AABB): { x: number; y: number } {
  let state = seed || 1;
  state = (state * 1664525 + 1013904223) >>> 0;
  const angle = (state / 0xffffffff) * Math.PI * 2;
  state = (state * 1664525 + 1013904223) >>> 0;
  const r = (state / 0xffffffff) * Math.min(bounds.halfExtents.x, bounds.halfExtents.y) * 0.7;
  return {
    x: Math.cos(angle) * r,
    y: Math.sin(angle) * r,
  };
}
