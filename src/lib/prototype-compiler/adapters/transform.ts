/**
 * Transform adapter.
 *
 * Compiles transformation mechanics (rotate, push, redirect) into
 * primitive transform and connectivity rules.
 */

import type {
  ControlBindingSpec, EntitySpec, EffectSpec, ObjectiveSpec,
  ResourceSpec, RuleSpec, SystemSpec, TelemetryEventName,
} from "../ir/types";
import type { MechanicAdapter, MechanicCompileContext, MechanicFragment } from "../registry/registry";

const ADAPTER_ID = "transform";
const ADAPTER_VERSION = "1.0.0";

export function createTransformAdapter(): MechanicAdapter {
  return {
    adapterId: ADAPTER_ID,
    version: ADAPTER_VERSION,
    mechanicIds: ["transform"],
    capabilities: ["transform"],
    compatibleTopologies: ["grid", "rooms", "node_field"],
    requiredContext: ["player", "target"],

    compile(context: MechanicCompileContext): MechanicFragment {
      const transformSystem: SystemSpec = {
        id: `sys-${context.stepId}-transform`,
        kind: "puzzle_state",
        appliesToRoles: ["player", "obstacle"],
        config: { rotationStep: 90, connectedCheck: true },
      };

      const controls: ControlBindingSpec[] = [
        { action: "rotate", binding: { kind: "keyboard", keys: ["r"] }, contextPredicate: null },
      ];

      // Transformable obstacle
      const obstacle: EntitySpec = {
        id: `entity-${context.stepId}-transformable`,
        role: "obstacle",
        deterministicId: `det-transformable-${context.seed.substring(0, 6)}`,
        components: [
          { kind: "transform", data: { position: { x: 100, y: 100 }, rotation: 0, scale: { x: 1, y: 1 } } },
          { kind: "collider", shape: "aabb", data: { center: { x: 100, y: 100 }, halfExtents: { x: 30, y: 30 } } },
        ],
        spawnSchedule: null,
      };

      const transformRule: RuleSpec = {
        id: `rule-${context.stepId}-transform`,
        sourceMechanicId: "transform",
        trigger: { kind: "event", eventId: "rotate" },
        guard: { kind: "loop_count_gte", value: 0 },
        effects: [],
      };

      const rotationsResource: ResourceSpec = {
        id: `res-${context.stepId}-rotations`, name: "Rotations", icon: "🔄", class: "secondary",
        initialValue: 0, min: 0, max: null,
      };

      const objective: ObjectiveSpec = {
        id: `obj-${context.stepId}-transform`,
        label: "Rotate to align",
        predicate: { kind: "resource_gte", resourceId: rotationsResource.id, value: 4 },
        required: true,
        stepId: context.stepId,
      };

      return {
        rules: [transformRule],
        systems: [transformSystem],
        controls,
        objectives: [objective],
        requiredResources: [rotationsResource],
        requiredEntities: [obstacle],
        telemetryEvents: ["mechanic_triggered"],
        assumptions: [
          "Press R to rotate obstacle by 90°",
          "4 rotations complete the objective",
        ],
      };
    },

    validate(fragment: MechanicFragment) {
      const diagnostics = [];
      if (!fragment.controls.some((c) => c.action === "rotate")) {
        diagnostics.push({ level: "error" as const, code: "transform.no_rotate", message: "Transform fragment must include a rotate control" });
      }
      return diagnostics;
    },

    botPolicy: { actions: ["rotate"], expectedSuccessRate: 0.9 },
  };
}
