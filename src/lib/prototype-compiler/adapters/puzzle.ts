/**
 * Puzzle adapter.
 *
 * Compiles puzzle mechanics (match, connect, route) into grid/graph
 * state and validity predicate.
 */

import type {
  ControlBindingSpec, EntitySpec, EffectSpec, ObjectiveSpec,
  ResourceSpec, RuleSpec, SystemSpec, TelemetryEventName,
} from "../ir/types";
import type { MechanicAdapter, MechanicCompileContext, MechanicFragment } from "../registry/registry";

const ADAPTER_ID = "puzzle";
const ADAPTER_VERSION = "1.0.0";

export function createPuzzleAdapter(): MechanicAdapter {
  return {
    adapterId: ADAPTER_ID,
    version: ADAPTER_VERSION,
    mechanicIds: ["puzzle"],
    capabilities: ["puzzle"],
    compatibleTopologies: ["grid", "rooms"],
    requiredContext: ["player", "target"],

    compile(context: MechanicCompileContext): MechanicFragment {
      const puzzleSystem: SystemSpec = {
        id: `sys-${context.stepId}-puzzle`,
        kind: "puzzle_state",
        appliesToRoles: ["player", "collectible"],
        config: { gridSize: 4, matchThreshold: 3 },
      };

      const controls: ControlBindingSpec[] = [
        { action: "primary_action", binding: { kind: "pointer" }, contextPredicate: null },
      ];

      const matchesResource: ResourceSpec = {
        id: `res-${context.stepId}-matches`, name: "Matches", icon: "🎯", class: "core",
        initialValue: 0, min: 0, max: null,
      };

      // Puzzle tiles (grid entities)
      const tiles: EntitySpec[] = [];
      for (let i = 0; i < 4; i++) {
        tiles.push({
          id: `entity-${context.stepId}-tile-${i}`,
          role: "collectible",
          deterministicId: `det-tile-${i}-${context.seed.substring(0, 4)}`,
          components: [
            { kind: "transform", data: { position: { x: -90 + i * 60, y: 0 }, rotation: 0, scale: { x: 1, y: 1 } } },
            { kind: "collider", shape: "aabb", data: { center: { x: -90 + i * 60, y: 0 }, halfExtents: { x: 25, y: 25 } } },
          ],
          spawnSchedule: null,
        });
      }

      const matchRule: RuleSpec = {
        id: `rule-${context.stepId}-match`,
        sourceMechanicId: "puzzle",
        trigger: { kind: "event", eventId: "match" },
        guard: { kind: "loop_count_gte", value: 0 },
        effects: [{ kind: "resource_delta", resourceId: matchesResource.id, delta: 1 }],
      };

      const objective: ObjectiveSpec = {
        id: `obj-${context.stepId}-match`,
        label: "Match 3 tiles",
        predicate: { kind: "resource_gte", resourceId: matchesResource.id, value: 3 },
        required: true,
        stepId: context.stepId,
      };

      return {
        rules: [matchRule],
        systems: [puzzleSystem],
        controls,
        objectives: [objective],
        requiredResources: [matchesResource],
        requiredEntities: tiles,
        telemetryEvents: ["mechanic_triggered", "resource_changed"],
        assumptions: [
          "4 puzzle tiles placed in a row",
          "Click (pointer) to match tiles",
          "3 matches complete the objective",
        ],
      };
    },

    validate(fragment: MechanicFragment) {
      const diagnostics = [];
      if (fragment.requiredEntities.length === 0) {
        diagnostics.push({ level: "error" as const, code: "puzzle.no_tiles", message: "Puzzle fragment must declare tile entities" });
      }
      return diagnostics;
    },

    botPolicy: { actions: ["primary_action"], expectedSuccessRate: 0.6 },
  };
}
