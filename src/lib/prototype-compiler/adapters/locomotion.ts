/**
 * Locomotion adapter.
 *
 * Compiles movement mechanics (move, dodge, jump, run, walk, fly, swim)
 * into movement rules, a movement system, and keyboard/touch controls.
 *
 * Primitive behaviour: player actor/capsule moves based on input;
 * obstacles block movement via collision.
 *
 * Design spec: docs/PLAYABLE_PROTOTYPE_COMPILER_DESIGN.md (section 7)
 */

import type {
  ControlBindingSpec,
  EntitySpec,
  EffectSpec,
  MechanicBinding,
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

const ADAPTER_ID = "locomotion";
const ADAPTER_VERSION = "1.0.0";

export function createLocomotionAdapter(): MechanicAdapter {
  return {
    adapterId: ADAPTER_ID,
    version: ADAPTER_VERSION,
    mechanicIds: ["locomotion"],
    capabilities: ["locomotion"],
    compatibleTopologies: ["arena", "lanes", "rooms", "node_field"],
    requiredContext: ["player"],

    compile(context: MechanicCompileContext): MechanicFragment {
      const speed = context.difficulty === "hard" ? 280 : context.difficulty === "easy" ? 180 : 220;

      // Movement system: applies velocity to player entity.
      const movementSystem: SystemSpec = {
        id: `sys-${context.stepId}-movement`,
        kind: "movement",
        appliesToRoles: ["player"],
        config: { speed, acceleration: 1200, friction: 800 },
      };

      // Controls: WASD + arrows + touch stick.
      const controls: ControlBindingSpec[] = [
        {
          action: "move",
          binding: { kind: "keyboard", keys: ["w", "a", "s", "d"] },
          contextPredicate: null,
        },
        {
          action: "move",
          binding: { kind: "keyboard", keys: ["arrowup", "arrowleft", "arrowdown", "arrowright"] },
          contextPredicate: null,
        },
        {
          action: "move",
          binding: { kind: "touch_stick" },
          contextPredicate: null,
        },
      ];

      // Rule: input_action(move) → applies velocity (handled by movement system).
      // We emit a telemetry rule rather than a gameplay rule — the movement
      // system reads input directly each tick.
      const moveRule: RuleSpec = {
        id: `rule-${context.stepId}-locomotion-input`,
        sourceMechanicId: "locomotion",
        trigger: { kind: "event", eventId: "input_action:move" },
        guard: { kind: "loop_count_gte", value: 0 },
        effects: [], // movement system handles this; rule is for telemetry only
      };

      // Player entity with transform (if not already declared).
      const playerEntity: EntitySpec = {
        id: `entity-${context.stepId}-player`,
        role: "player",
        deterministicId: `det-player-${context.seed.substring(0, 6)}`,
        components: [
          {
            kind: "transform",
            data: {
              position: { x: 0, y: 0 },
              rotation: 0,
              scale: { x: 1, y: 1 },
            },
          },
          {
            kind: "collider",
            shape: "circle",
            data: { center: { x: 0, y: 0 }, radius: 20 },
          },
        ],
        spawnSchedule: null,
      };

      return {
        rules: [moveRule],
        systems: [movementSystem],
        controls,
        objectives: [], // locomotion itself has no objective; it enables other mechanics
        requiredResources: [],
        requiredEntities: [playerEntity],
        telemetryEvents: ["input_action"],
        assumptions: [
          `Player speed set to ${speed} based on difficulty '${context.difficulty}'`,
          "Movement uses acceleration + friction model (not instant velocity)",
          "Obstacles block movement via circle-vs-AABB collision",
        ],
      };
    },

    validate(fragment: MechanicFragment) {
      const diagnostics = [];
      if (fragment.systems.length === 0) {
        diagnostics.push({
          level: "error" as const,
          code: "locomotion.no_system",
          message: "Locomotion fragment must include a movement system",
        });
      }
      if (fragment.controls.length === 0) {
        diagnostics.push({
          level: "error" as const,
          code: "locomotion.no_controls",
          message: "Locomotion fragment must include at least one move control binding",
        });
      }
      const hasPlayer = fragment.requiredEntities.some((e) => e.role === "player");
      if (!hasPlayer) {
        diagnostics.push({
          level: "error" as const,
          code: "locomotion.no_player",
          message: "Locomotion fragment must declare a player entity",
        });
      }
      return diagnostics;
    },

    botPolicy: {
      actions: ["move"],
      expectedSuccessRate: 0.95,
    },
  };
}
