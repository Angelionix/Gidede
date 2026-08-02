/**
 * Interact/deliver adapter.
 *
 * Compiles interaction mechanics (activate, carry, deposit) into
 * interaction zones and transfer rules.
 *
 * Primitive behaviour: interaction zone + resource transfer.
 */

import type {
  ControlBindingSpec, EntitySpec, EffectSpec, ObjectiveSpec,
  ResourceSpec, RuleSpec, SystemSpec, TelemetryEventName,
} from "../ir/types";
import type { MechanicAdapter, MechanicCompileContext, MechanicFragment } from "../registry/registry";

const ADAPTER_ID = "interact/deliver";
const ADAPTER_VERSION = "1.0.0";

export function createInteractAdapter(): MechanicAdapter {
  return {
    adapterId: ADAPTER_ID,
    version: ADAPTER_VERSION,
    mechanicIds: ["interact"],
    capabilities: ["interact/deliver"],
    compatibleTopologies: ["rooms", "lanes", "node_field", "arena"],
    requiredContext: ["player", "target"],

    compile(context: MechanicCompileContext): MechanicFragment {
      const interactSystem: SystemSpec = {
        id: `sys-${context.stepId}-interact`,
        kind: "collision",
        appliesToRoles: ["player", "interaction_zone"],
        config: { interactRadius: 40, transferOnInteract: true },
      };

      const controls: ControlBindingSpec[] = [
        { action: "interact", binding: { kind: "keyboard", keys: ["e"] }, contextPredicate: null },
      ];

      // Interaction zone entity
      const zone: EntitySpec = {
        id: `entity-${context.stepId}-zone`,
        role: "interaction_zone",
        deterministicId: `det-zone-${context.seed.substring(0, 6)}`,
        components: [
          { kind: "transform", data: { position: { x: 150, y: 0 }, rotation: 0, scale: { x: 1, y: 1 } } },
          { kind: "collider", shape: "circle", data: { center: { x: 150, y: 0 }, radius: 40 } },
        ],
        spawnSchedule: null,
      };

      // Goal entity (where to deliver)
      const goal: EntitySpec = {
        id: `entity-${context.stepId}-goal`,
        role: "goal",
        deterministicId: `det-goal-${context.seed.substring(0, 6)}`,
        components: [
          { kind: "transform", data: { position: { x: -150, y: 0 }, rotation: 0, scale: { x: 1, y: 1 } } },
          { kind: "collider", shape: "circle", data: { center: { x: -150, y: 0 }, radius: 30 } },
        ],
        spawnSchedule: null,
      };

      const resourceId = `res-${context.stepId}-carried`;
      const carryResource: ResourceSpec = {
        id: resourceId, name: "Carried", icon: "📦", class: "secondary",
        initialValue: 0, min: 0, max: 1,
      };

      const interactRule: RuleSpec = {
        id: `rule-${context.stepId}-interact`,
        sourceMechanicId: "interact",
        trigger: { kind: "event", eventId: "interact" },
        guard: { kind: "loop_count_gte", value: 0 },
        effects: [{ kind: "resource_delta", resourceId, delta: 1 }],
      };

      const deliverRule: RuleSpec = {
        id: `rule-${context.stepId}-deliver`,
        sourceMechanicId: "interact",
        trigger: { kind: "event", eventId: "deliver" },
        guard: { kind: "resource_gte", resourceId, value: 1 },
        effects: [{ kind: "resource_delta", resourceId, delta: -1 }],
      };

      const objective: ObjectiveSpec = {
        id: `obj-${context.stepId}-deliver`,
        label: "Deliver item to goal",
        predicate: { kind: "resource_lte", resourceId, value: 0 },
        required: true,
        stepId: context.stepId,
      };

      return {
        rules: [interactRule, deliverRule],
        systems: [interactSystem],
        controls,
        objectives: [objective],
        requiredResources: [carryResource],
        requiredEntities: [zone, goal],
        telemetryEvents: ["mechanic_triggered", "resource_changed"],
        assumptions: [
          "Interaction zone placed at +150x",
          "Goal (delivery point) placed at -150x",
          "Player presses E to interact, then delivers to goal",
          "Carry resource is binary (0 or 1)",
        ],
      };
    },

    validate(fragment: MechanicFragment) {
      const diagnostics = [];
      if (!fragment.requiredEntities.some((e) => e.role === "interaction_zone")) {
        diagnostics.push({ level: "error" as const, code: "interact.no_zone", message: "Interact fragment must declare an interaction zone" });
      }
      if (!fragment.requiredEntities.some((e) => e.role === "goal")) {
        diagnostics.push({ level: "error" as const, code: "interact.no_goal", message: "Interact fragment must declare a goal entity" });
      }
      if (!fragment.controls.some((c) => c.action === "interact")) {
        diagnostics.push({ level: "error" as const, code: "interact.no_control", message: "Interact fragment must include an interact control" });
      }
      return diagnostics;
    },

    botPolicy: { actions: ["move", "interact"], expectedSuccessRate: 0.7 },
  };
}
