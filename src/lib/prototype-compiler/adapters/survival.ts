/**
 * Survival adapter.
 *
 * Compiles avoidance mechanics (stealth, evade, hazard, hide, sneak)
 * into threat entities, hazard zones, a hazard system, and failure
 * conditions based on player damage.
 *
 * Primitive behaviour: threat perception, damage/detection.
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

const ADAPTER_ID = "avoid/survive";
const ADAPTER_VERSION = "1.0.0";

export function createSurvivalAdapter(): MechanicAdapter {
  return {
    adapterId: ADAPTER_ID,
    version: ADAPTER_VERSION,
    mechanicIds: ["survival"],
    capabilities: ["avoid/survive"],
    compatibleTopologies: ["arena", "lanes", "rooms"],
    requiredContext: ["player", "timer"],

    compile(context: MechanicCompileContext): MechanicFragment {
      const playerHealth = context.difficulty === "hard" ? 50 : context.difficulty === "easy" ? 150 : 100;
      const hazardDamage = context.difficulty === "hard" ? 25 : context.difficulty === "easy" ? 5 : 10;

      // Health resource for the player.
      const healthResource: ResourceSpec = {
        id: `res-${context.stepId}-health`,
        name: "Health",
        icon: "❤️",
        class: "core",
        initialValue: playerHealth,
        min: 0,
        max: playerHealth,
      };

      // Hazard system: applies damage when player touches hazards.
      const hazardSystem: SystemSpec = {
        id: `sys-${context.stepId}-hazard`,
        kind: "collision",
        appliesToRoles: ["player", "hazard"],
        config: {
          damagePerContact: hazardDamage,
          damageIntervalSec: 0.5, // damage tick
          damageResource: healthResource.id,
        },
      };

      // Hazard entities: 3 placed deterministically.
      const seedHash = hashString(context.seed + context.stepId);
      const hazards: EntitySpec[] = [];
      const positions = deterministicPositions(seedHash, 3, 280);
      for (let i = 0; i < 3; i++) {
        const pos = positions[i];
        hazards.push({
          id: `entity-${context.stepId}-hazard-${i}`,
          role: "hazard",
          deterministicId: `det-hazard-${context.stepId}-${i}-${seedHash.toString(16).substring(0, 4)}`,
          components: [
            {
              kind: "transform",
              data: {
                position: pos,
                rotation: 0,
                scale: { x: 1.5, y: 1.5 }, // hazards are larger
              },
            },
            {
              kind: "collider",
              shape: "circle",
              data: { center: pos, radius: 30 },
            },
          ],
          spawnSchedule: null,
        });
      }

      // Rule: on hazard contact → damage player.
      const damageRule: RuleSpec = {
        id: `rule-${context.stepId}-hazard-damage`,
        sourceMechanicId: "survival",
        trigger: { kind: "event", eventId: "hazard_contact" },
        guard: { kind: "loop_count_gte", value: 0 },
        effects: [
          { kind: "resource_delta", resourceId: healthResource.id, delta: -hazardDamage },
        ],
      };

      // Objective: survive for the step's duration.
      // The step's completion predicate is typically time-based.
      const objective: ObjectiveSpec = {
        id: `obj-${context.stepId}-survive`,
        label: "Survive without losing all health",
        predicate: {
          kind: "and",
          predicates: [
            { kind: "resource_lte", resourceId: healthResource.id, value: 0 },
            { kind: "not", predicate: { kind: "time_elapsed_gte", seconds: context.existingSteps[0]?.activationPredicate || { kind: "time_elapsed_gte", seconds: 30 } as PredicateSpec } },
          ],
        },
        required: false, // this is a failure objective, not a success objective
        stepId: context.stepId,
      };

      // Failure condition: health reaches 0.
      // (This is added to session.failure by the compiler, not as an objective.)

      return {
        rules: [damageRule],
        systems: [hazardSystem],
        controls: [], // survival uses locomotion controls; no explicit survival control
        objectives: [],
        requiredResources: [healthResource],
        requiredEntities: hazards,
        telemetryEvents: ["damage", "death", "mechanic_triggered"],
        assumptions: [
          `Player health set to ${playerHealth} based on difficulty '${context.difficulty}'`,
          `Hazard damage: ${hazardDamage} per 0.5s of contact`,
          "Hazards are static (do not move toward player)",
          "Survival requires locomotion adapter to be present for movement",
        ],
      };
    },

    validate(fragment: MechanicFragment) {
      const diagnostics = [];
      const hasHazardSystem = fragment.systems.some((s) => s.kind === "collision");
      if (!hasHazardSystem) {
        diagnostics.push({
          level: "error" as const,
          code: "survival.no_hazard_system",
          message: "Survival fragment must include a collision/hazard system",
        });
      }
      const hasHazards = fragment.requiredEntities.some((e) => e.role === "hazard");
      if (!hasHazards) {
        diagnostics.push({
          level: "error" as const,
          code: "survival.no_hazards",
          message: "Survival fragment must declare at least one hazard entity",
        });
      }
      const hasHealthResource = fragment.requiredResources.some((r) => r.name === "Health");
      if (!hasHealthResource) {
        diagnostics.push({
          level: "error" as const,
          code: "survival.no_health",
          message: "Survival fragment must declare a Health resource",
        });
      }
      const hasDamageRule = fragment.rules.some((r) =>
        r.effects.some((e) => e.kind === "resource_delta" && e.delta < 0),
      );
      if (!hasDamageRule) {
        diagnostics.push({
          level: "error" as const,
          code: "survival.no_damage_rule",
          message: "Survival fragment must include a rule that applies negative resource_delta (damage)",
        });
      }
      return diagnostics;
    },

    botPolicy: {
      actions: ["move"],
      expectedSuccessRate: 0.6,
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

function deterministicPositions(seed: number, count: number, radius: number): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  let state = seed || 1;
  for (let i = 0; i < count; i++) {
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
