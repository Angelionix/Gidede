/**
 * Build/place adapter.
 *
 * Compiles building mechanics (build, tower placement) into preview,
 * cost, and placed entity rules.
 */

import type {
  ControlBindingSpec, EntitySpec, EffectSpec, ObjectiveSpec,
  ResourceSpec, RuleSpec, SystemSpec, TelemetryEventName,
} from "../ir/types";
import type { MechanicAdapter, MechanicCompileContext, MechanicFragment } from "../registry/registry";

const ADAPTER_ID = "build/place";
const ADAPTER_VERSION = "1.0.0";

export function createBuildAdapter(): MechanicAdapter {
  return {
    adapterId: ADAPTER_ID,
    version: ADAPTER_VERSION,
    mechanicIds: ["build"],
    capabilities: ["build/place"],
    compatibleTopologies: ["grid", "lanes", "node_field"],
    requiredContext: ["player", "resource"],

    compile(context: MechanicCompileContext): MechanicFragment {
      const buildResourceId = `res-${context.stepId}-materials`;
      const buildResource: ResourceSpec = {
        id: buildResourceId, name: "Materials", icon: "🧱", class: "core",
        initialValue: 10, min: 0, max: null,
      };

      const buildSystem: SystemSpec = {
        id: `sys-${context.stepId}-build`,
        kind: "place",
        appliesToRoles: ["player"],
        config: { cost: 2, buildResourceId, placedRole: "base" },
      };

      const controls: ControlBindingSpec[] = [
        { action: "place", binding: { kind: "keyboard", keys: ["f"] }, contextPredicate: null },
        { action: "rotate", binding: { kind: "keyboard", keys: ["r"] }, contextPredicate: null },
      ];

      const buildRule: RuleSpec = {
        id: `rule-${context.stepId}-build`,
        sourceMechanicId: "build",
        trigger: { kind: "event", eventId: "place" },
        guard: { kind: "resource_gte", resourceId: buildResourceId, value: 2 },
        effects: [
          { kind: "resource_delta", resourceId: buildResourceId, delta: -2 },
          { kind: "spawn_entity", roleId: "base", position: { x: 0, y: 0 } },
        ],
      };

      const objective: ObjectiveSpec = {
        id: `obj-${context.stepId}-build`,
        label: "Place 3 structures",
        predicate: { kind: "entity_count_lte", roleId: "base", value: 2 },
        required: true,
        stepId: context.stepId,
      };

      return {
        rules: [buildRule],
        systems: [buildSystem],
        controls,
        objectives: [objective],
        requiredResources: [buildResource],
        requiredEntities: [],
        telemetryEvents: ["mechanic_triggered", "resource_changed"],
        assumptions: [
          "Building cost: 2 Materials per structure",
          "Player starts with 10 Materials",
          "Press F to place, R to rotate",
        ],
      };
    },

    validate(fragment: MechanicFragment) {
      const diagnostics = [];
      if (!fragment.controls.some((c) => c.action === "place")) {
        diagnostics.push({ level: "error" as const, code: "build.no_place", message: "Build fragment must include a place control" });
      }
      return diagnostics;
    },

    botPolicy: { actions: ["place"], expectedSuccessRate: 0.6 },
  };
}
