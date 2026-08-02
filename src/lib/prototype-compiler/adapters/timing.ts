/**
 * Timing adapter.
 *
 * Compiles timing mechanics (rhythm, timed input) into beat window,
 * streak, and miss penalty rules.
 */

import type {
  ControlBindingSpec, EntitySpec, EffectSpec, ObjectiveSpec,
  ResourceSpec, RuleSpec, SystemSpec, TelemetryEventName,
} from "../ir/types";
import type { MechanicAdapter, MechanicCompileContext, MechanicFragment } from "../registry/registry";

const ADAPTER_ID = "timing";
const ADAPTER_VERSION = "1.0.0";

export function createTimingAdapter(): MechanicAdapter {
  return {
    adapterId: ADAPTER_ID,
    version: ADAPTER_VERSION,
    mechanicIds: ["timing"],
    capabilities: ["timing"],
    compatibleTopologies: ["lanes", "arena"],
    requiredContext: ["player", "timer"],

    compile(context: MechanicCompileContext): MechanicFragment {
      const timingSystem: SystemSpec = {
        id: `sys-${context.stepId}-timing`,
        kind: "timing",
        appliesToRoles: ["player"],
        config: { beatIntervalSec: 1, windowSec: 0.3, missPenalty: 1 },
      };

      const controls: ControlBindingSpec[] = [
        { action: "primary_action", binding: { kind: "keyboard", keys: ["space"] }, contextPredicate: null },
      ];

      const comboResource: ResourceSpec = {
        id: `res-${context.stepId}-combo`, name: "Combo", icon: "🎵", class: "core",
        initialValue: 0, min: 0, max: null,
      };
      const missesResource: ResourceSpec = {
        id: `res-${context.stepId}-misses`, name: "Misses", icon: "❌", class: "secondary",
        initialValue: 0, min: 0, max: null,
      };

      const hitRule: RuleSpec = {
        id: `rule-${context.stepId}-hit`,
        sourceMechanicId: "timing",
        trigger: { kind: "event", eventId: "beat_hit" },
        guard: { kind: "loop_count_gte", value: 0 },
        effects: [{ kind: "resource_delta", resourceId: comboResource.id, delta: 1 }],
      };

      const missRule: RuleSpec = {
        id: `rule-${context.stepId}-miss`,
        sourceMechanicId: "timing",
        trigger: { kind: "event", eventId: "beat_miss" },
        guard: { kind: "loop_count_gte", value: 0 },
        effects: [
          { kind: "resource_delta", resourceId: comboResource.id, delta: -2 },
          { kind: "resource_delta", resourceId: missesResource.id, delta: 1 },
        ],
      };

      const objective: ObjectiveSpec = {
        id: `obj-${context.stepId}-combo`,
        label: "Reach combo of 10",
        predicate: { kind: "resource_gte", resourceId: comboResource.id, value: 10 },
        required: true,
        stepId: context.stepId,
      };

      return {
        rules: [hitRule, missRule],
        systems: [timingSystem],
        controls,
        objectives: [objective],
        requiredResources: [comboResource, missesResource],
        requiredEntities: [],
        telemetryEvents: ["mechanic_triggered", "resource_changed"],
        assumptions: [
          "Beat interval: 1 second",
          "Hit window: ±0.3s",
          "Hit: +1 combo, Miss: -2 combo + 1 miss",
          "Press Space on beat",
        ],
      };
    },

    validate(fragment: MechanicFragment) {
      const diagnostics = [];
      if (!fragment.systems.some((s) => s.kind === "timing")) {
        diagnostics.push({ level: "error" as const, code: "timing.no_system", message: "Timing fragment must include a timing system" });
      }
      return diagnostics;
    },

    botPolicy: { actions: ["primary_action"], expectedSuccessRate: 0.7 },
  };
}
