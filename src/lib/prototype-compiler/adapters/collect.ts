/**
 * Collect adapter.
 *
 * Compiles collection mechanics (pickup, gather, loot, harvest, mine, fish)
 * into collectible entities, a collect system, and rules that transfer
 * resources to the player's wallet on collision.
 *
 * Primitive behaviour: collectible → wallet/inventory.
 *
 * Design spec: docs/PLAYABLE_PROTOTYPE_COMPILER_DESIGN.md (section 7)
 */

import type {
  ControlBindingSpec,
  EntitySpec,
  EffectSpec,
  ObjectiveSpec,
  PredicateSpec,
  ResourceSpec,
  RuleSpec,
  SystemSpec,
  TelemetryEventName,
} from "../ir/types";
import type {
  MechanicAdapter,
  MechanicCompileContext,
  MechanicFragment,
} from "../registry/registry";

const ADAPTER_ID = "collect";
const ADAPTER_VERSION = "1.0.0";

export function createCollectAdapter(): MechanicAdapter {
  return {
    adapterId: ADAPTER_ID,
    version: ADAPTER_VERSION,
    mechanicIds: ["collect"],
    capabilities: ["collect"],
    compatibleTopologies: ["arena", "lanes", "rooms", "node_field", "grid"],
    requiredContext: ["player", "resource"],

    compile(context: MechanicCompileContext): MechanicFragment {
      // Determine the resource to collect. Prefer an existing core resource;
      // otherwise create one named "Collected".
      const existingCore = context.availableResources.find((r) => r.class === "core");
      const resourceId = existingCore?.id ?? `res-${context.stepId}-collected`;
      const resourceName = existingCore?.name ?? "Collected";
      const resourceIcon = existingCore?.icon ?? "✨";

      const collectibleValue = context.difficulty === "hard" ? 1 : context.difficulty === "easy" ? 5 : 3;

      // Collect system: handles collision between player and collectibles.
      const collectSystem: SystemSpec = {
        id: `sys-${context.stepId}-collect`,
        kind: "collect",
        appliesToRoles: ["player", "collectible"],
        config: {
          resourceId,
          valuePerCollectible: collectibleValue,
          respawnOnCollect: context.difficulty !== "hard",
          respawnDelaySec: 2,
        },
      };

      // Collectible entities: 3 placed deterministically.
      const seedHash = hashString(context.seed + context.stepId);
      const collectibles: EntitySpec[] = [];
      const positions = deterministicPositions(seedHash, 3, 300);
      for (let i = 0; i < 3; i++) {
        const pos = positions[i];
        collectibles.push({
          id: `entity-${context.stepId}-collectible-${i}`,
          role: "collectible",
          deterministicId: `det-collectible-${context.stepId}-${i}-${seedHash.toString(16).substring(0, 4)}`,
          components: [
            {
              kind: "transform",
              data: {
                position: pos,
                rotation: 0,
                scale: { x: 1, y: 1 },
              },
            },
            {
              kind: "collider",
              shape: "circle",
              data: { center: pos, radius: 15 },
            },
          ],
          spawnSchedule: null,
        });
      }

      // Rule: on collect event → resource_delta.
      const collectRule: RuleSpec = {
        id: `rule-${context.stepId}-collect`,
        sourceMechanicId: "collect",
        trigger: { kind: "event", eventId: "collect" },
        guard: { kind: "loop_count_gte", value: 0 },
        effects: [
          { kind: "resource_delta", resourceId, delta: collectibleValue },
        ],
      };

      // Resource spec (if we created a new one).
      const requiredResources: ResourceSpec[] = existingCore ? [] : [{
        id: resourceId,
        name: resourceName,
        icon: resourceIcon,
        class: "core",
        initialValue: 0,
        min: 0,
        max: null,
      }];

      // Objective: collect N items (optional, depends on step context).
      const objective: ObjectiveSpec = {
        id: `obj-${context.stepId}-collect`,
        label: `Collect ${collectibleValue * 3} ${resourceName}`,
        predicate: { kind: "resource_gte", resourceId, value: collectibleValue * 3 },
        required: true,
        stepId: context.stepId,
      };

      return {
        rules: [collectRule],
        systems: [collectSystem],
        controls: [], // collect is automatic on collision, no explicit control
        objectives: [objective],
        requiredResources,
        requiredEntities: collectibles,
        telemetryEvents: ["mechanic_triggered", "resource_changed"],
        assumptions: [
          `Collectible value set to ${collectibleValue} based on difficulty '${context.difficulty}'`,
          `3 collectibles placed deterministically using seed '${context.seed}'`,
          existingCore
            ? `Reuses existing core resource '${resourceName}'`
            : `Creates new core resource '${resourceName}'`,
          "Collect is automatic on collision — no explicit player action required",
        ],
      };
    },

    validate(fragment: MechanicFragment) {
      const diagnostics = [];
      const hasCollectSystem = fragment.systems.some((s) => s.kind === "collect");
      if (!hasCollectSystem) {
        diagnostics.push({
          level: "error" as const,
          code: "collect.no_system",
          message: "Collect fragment must include a collect system",
        });
      }
      const hasCollectibles = fragment.requiredEntities.some((e) => e.role === "collectible");
      if (!hasCollectibles) {
        diagnostics.push({
          level: "error" as const,
          code: "collect.no_collectibles",
          message: "Collect fragment must declare at least one collectible entity",
        });
      }
      const hasResourceRule = fragment.rules.some((r) =>
        r.effects.some((e) => e.kind === "resource_delta"),
      );
      if (!hasResourceRule) {
        diagnostics.push({
          level: "error" as const,
          code: "collect.no_resource_delta",
          message: "Collect fragment must include a rule that produces resource_delta",
        });
      }
      return diagnostics;
    },

    botPolicy: {
      actions: ["move"],
      expectedSuccessRate: 0.85,
    },
  };
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

/**
 * Generate N deterministic positions in a circle of the given radius.
 * Uses a simple LCG seeded by the hash.
 */
function deterministicPositions(seed: number, count: number, radius: number): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  let state = seed || 1;
  for (let i = 0; i < count; i++) {
    // LCG: state = state * 1664525 + 1013904223 (mod 2^32)
    state = (state * 1664525 + 1013904223) >>> 0;
    const angle = (state / 0xffffffff) * Math.PI * 2;
    state = (state * 1664525 + 1013904223) >>> 0;
    const r = (state / 0xffffffff) * radius;
    positions.push({
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
    });
  }
  return positions;
}
