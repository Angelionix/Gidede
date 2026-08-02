/**
 * Defend adapter.
 *
 * Compiles defense mechanics (protect base, wave defense) into base
 * health, spawner, and attacker rules.
 */

import type {
  ControlBindingSpec, EntitySpec, EffectSpec, ObjectiveSpec,
  ResourceSpec, RuleSpec, SystemSpec, TelemetryEventName,
} from "../ir/types";
import type { MechanicAdapter, MechanicCompileContext, MechanicFragment } from "../registry/registry";

const ADAPTER_ID = "defend";
const ADAPTER_VERSION = "1.0.0";

export function createDefendAdapter(): MechanicAdapter {
  return {
    adapterId: ADAPTER_ID,
    version: ADAPTER_VERSION,
    mechanicIds: ["defend"],
    capabilities: ["defend"],
    compatibleTopologies: ["lanes", "arena", "grid"],
    requiredContext: ["player", "base"],

    compile(context: MechanicCompileContext): MechanicFragment {
      const baseHealthResource: ResourceSpec = {
        id: `res-${context.stepId}-base-hp`, name: "Base HP", icon: "🏰", class: "core",
        initialValue: 100, min: 0, max: 100,
      };

      const defendSystem: SystemSpec = {
        id: `sys-${context.stepId}-defend`,
        kind: "spawn",
        appliesToRoles: ["enemy"],
        config: { spawnIntervalSec: 3, spawnCount: 1, targetRole: "base" },
      };

      // Base entity
      const base: EntitySpec = {
        id: `entity-${context.stepId}-base`,
        role: "base",
        deterministicId: `det-base-${context.seed.substring(0, 6)}`,
        components: [
          { kind: "transform", data: { position: { x: -300, y: 0 }, rotation: 0, scale: { x: 2, y: 4 } } },
          { kind: "collider", shape: "aabb", data: { center: { x: -300, y: 0 }, halfExtents: { x: 40, y: 80 } } },
          { kind: "health", data: { max: 100, current: 100 } },
        ],
        spawnSchedule: null,
      };

      const damageRule: RuleSpec = {
        id: `rule-${context.stepId}-base-damage`,
        sourceMechanicId: "defend",
        trigger: { kind: "event", eventId: "enemy_reach_base" },
        guard: { kind: "loop_count_gte", value: 0 },
        effects: [{ kind: "resource_delta", resourceId: baseHealthResource.id, delta: -10 }],
      };

      const objective: ObjectiveSpec = {
        id: `obj-${context.stepId}-survive`,
        label: "Defend base (HP > 0)",
        predicate: { kind: "resource_lte", resourceId: baseHealthResource.id, value: 0 },
        required: false,
        stepId: context.stepId,
      };

      return {
        rules: [damageRule],
        systems: [defendSystem],
        controls: [],
        objectives: [objective],
        requiredResources: [baseHealthResource],
        requiredEntities: [base],
        telemetryEvents: ["damage", "mechanic_triggered"],
        assumptions: [
          "Base has 100 HP",
          "Enemies spawn every 3 seconds and move toward base",
          "Each enemy that reaches base deals 10 damage",
        ],
      };
    },

    validate(fragment: MechanicFragment) {
      const diagnostics = [];
      if (!fragment.requiredEntities.some((e) => e.role === "base")) {
        diagnostics.push({ level: "error" as const, code: "defend.no_base", message: "Defend fragment must declare a base entity" });
      }
      return diagnostics;
    },

    botPolicy: { actions: ["move", "primary_action"], expectedSuccessRate: 0.5 },
  };
}
