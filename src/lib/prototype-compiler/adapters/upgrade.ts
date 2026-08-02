/**
 * Upgrade adapter.
 *
 * Compiles upgrade mechanics (improve, level) into spend resource →
 * parameter modifier rules.
 */

import type {
  ControlBindingSpec, EntitySpec, EffectSpec, ObjectiveSpec,
  ResourceSpec, RuleSpec, SystemSpec, TelemetryEventName,
} from "../ir/types";
import type { MechanicAdapter, MechanicCompileContext, MechanicFragment } from "../registry/registry";

const ADAPTER_ID = "upgrade";
const ADAPTER_VERSION = "1.0.0";

export function createUpgradeAdapter(): MechanicAdapter {
  return {
    adapterId: ADAPTER_ID,
    version: ADAPTER_VERSION,
    mechanicIds: ["upgrade"],
    capabilities: ["upgrade"],
    compatibleTopologies: ["arena", "node_field", "rooms"],
    requiredContext: ["player", "resource"],

    compile(context: MechanicCompileContext): MechanicFragment {
      const upgradeResourceId = `res-${context.stepId}-upgrades`;
      const upgradeResource: ResourceSpec = {
        id: upgradeResourceId, name: "Upgrades", icon: "⬆️", class: "secondary",
        initialValue: 0, min: 0, max: null,
      };
      const levelResource: ResourceSpec = {
        id: `res-${context.stepId}-level`, name: "Level", icon: "📊", class: "core",
        initialValue: 1, min: 1, max: 10,
      };

      const upgradeSystem: SystemSpec = {
        id: `sys-${context.stepId}-upgrade`,
        kind: "convert",
        appliesToRoles: ["player"],
        config: { cost: 3, levelResource: levelResource.id },
      };

      const controls: ControlBindingSpec[] = [
        { action: "secondary_action", binding: { kind: "keyboard", keys: ["u"] }, contextPredicate: null },
      ];

      const upgradeRule: RuleSpec = {
        id: `rule-${context.stepId}-upgrade`,
        sourceMechanicId: "upgrade",
        trigger: { kind: "event", eventId: "upgrade" },
        guard: { kind: "resource_gte", resourceId: upgradeResourceId, value: 3 },
        effects: [
          { kind: "resource_delta", resourceId: upgradeResourceId, delta: -3 },
          { kind: "resource_delta", resourceId: levelResource.id, delta: 1 },
        ],
      };

      const objective: ObjectiveSpec = {
        id: `obj-${context.stepId}-max-level`,
        label: "Reach max level",
        predicate: { kind: "resource_gte", resourceId: levelResource.id, value: 5 },
        required: true,
        stepId: context.stepId,
      };

      return {
        rules: [upgradeRule],
        systems: [upgradeSystem],
        controls,
        objectives: [objective],
        requiredResources: [upgradeResource, levelResource],
        requiredEntities: [],
        telemetryEvents: ["mechanic_triggered", "resource_changed"],
        assumptions: [
          "Upgrade cost: 3 Upgrade Points per level",
          "Max level: 10 (objective targets level 5)",
          "Press U to upgrade",
        ],
      };
    },

    validate(fragment: MechanicFragment) {
      const diagnostics = [];
      if (fragment.requiredResources.length < 2) {
        diagnostics.push({ level: "error" as const, code: "upgrade.no_resources", message: "Upgrade fragment must declare upgrade + level resources" });
      }
      return diagnostics;
    },

    botPolicy: { actions: ["secondary_action"], expectedSuccessRate: 0.75 },
  };
}
