/**
 * Convert/craft adapter.
 *
 * Compiles conversion mechanics (craft, trade, combine) into recipe
 * and resource conversion rules.
 */

import type {
  ControlBindingSpec, EntitySpec, EffectSpec, ObjectiveSpec,
  ResourceSpec, RuleSpec, SystemSpec, TelemetryEventName,
} from "../ir/types";
import type { MechanicAdapter, MechanicCompileContext, MechanicFragment } from "../registry/registry";

const ADAPTER_ID = "convert/craft";
const ADAPTER_VERSION = "1.0.0";

export function createConvertAdapter(): MechanicAdapter {
  return {
    adapterId: ADAPTER_ID,
    version: ADAPTER_VERSION,
    mechanicIds: ["convert"],
    capabilities: ["convert/craft"],
    compatibleTopologies: ["node_field", "grid", "rooms"],
    requiredContext: ["player", "resource"],

    compile(context: MechanicCompileContext): MechanicFragment {
      const inputResourceId = `res-${context.stepId}-raw`;
      const outputResourceId = `res-${context.stepId}-crafted`;

      const rawResource: ResourceSpec = {
        id: inputResourceId, name: "Raw", icon: "🪵", class: "core",
        initialValue: 5, min: 0, max: null,
      };
      const craftedResource: ResourceSpec = {
        id: outputResourceId, name: "Crafted", icon: "🔨", class: "secondary",
        initialValue: 0, min: 0, max: null,
      };

      const convertSystem: SystemSpec = {
        id: `sys-${context.stepId}-convert`,
        kind: "convert",
        appliesToRoles: ["player"],
        config: { inputResource: inputResourceId, outputResource: outputResourceId, ratio: 2 },
      };

      const controls: ControlBindingSpec[] = [
        { action: "secondary_action", binding: { kind: "keyboard", keys: ["q"] }, contextPredicate: null },
      ];

      const convertRule: RuleSpec = {
        id: `rule-${context.stepId}-convert`,
        sourceMechanicId: "convert",
        trigger: { kind: "event", eventId: "convert" },
        guard: { kind: "resource_gte", resourceId: inputResourceId, value: 2 },
        effects: [
          { kind: "resource_delta", resourceId: inputResourceId, delta: -2 },
          { kind: "resource_delta", resourceId: outputResourceId, delta: 1 },
        ],
      };

      const objective: ObjectiveSpec = {
        id: `obj-${context.stepId}-craft`,
        label: "Craft 3 items",
        predicate: { kind: "resource_gte", resourceId: outputResourceId, value: 3 },
        required: true,
        stepId: context.stepId,
      };

      return {
        rules: [convertRule],
        systems: [convertSystem],
        controls,
        objectives: [objective],
        requiredResources: [rawResource, craftedResource],
        requiredEntities: [],
        telemetryEvents: ["mechanic_triggered", "resource_changed"],
        assumptions: [
          "Conversion ratio: 2 Raw → 1 Crafted",
          "Player starts with 5 Raw resources",
          "Press Q to convert",
        ],
      };
    },

    validate(fragment: MechanicFragment) {
      const diagnostics = [];
      if (fragment.requiredResources.length < 2) {
        diagnostics.push({ level: "error" as const, code: "convert.no_resources", message: "Convert fragment must declare input + output resources" });
      }
      if (!fragment.systems.some((s) => s.kind === "convert")) {
        diagnostics.push({ level: "error" as const, code: "convert.no_system", message: "Convert fragment must include a convert system" });
      }
      return diagnostics;
    },

    botPolicy: { actions: ["secondary_action"], expectedSuccessRate: 0.8 },
  };
}
