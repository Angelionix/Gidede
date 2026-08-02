/**
 * Test fixtures for PrototypeIR tests.
 * Provides a minimal valid IR that can be customized per-test.
 */

import { IR_SCHEMA_VERSION, RUNTIME_VERSION, type PrototypeIR } from "../types";

export function minimalIR(): PrototypeIR {
  return makeIR({});
}

export function makeIR(overrides: Partial<PrototypeIR>): PrototypeIR {
  const base: PrototypeIR = {
    schemaVersion: IR_SCHEMA_VERSION,
    runtimeVersion: RUNTIME_VERSION,
    seed: "abcdef0123",
    prng: { algorithm: "mulberry32", seed: "abcdef0123" },

    source: {
      projectId: "test-project",
      artifactVersions: { concept: "1.0.0", core_loop: "1.0.0" },
      hypothesisId: "hyp-1",
    },

    session: {
      targetDurationSec: 30,
      fixedStepHz: 60,
      success: { kind: "resource_gte", resourceId: "r1", value: 10 },
      failure: [{ kind: "time_elapsed_gte", seconds: 30 }],
      loopTarget: 3,
    },

    mechanicBindings: [
      {
        sourceMechanicId: "mech-1",
        adapterId: "locomotion",
        adapterVersion: "1.0.0",
        resolution: "exact",
        representedByRuleIds: ["rule-1"],
        assumptions: [],
      },
    ],

    resources: [
      {
        id: "r1",
        name: "Score",
        icon: "⭐",
        class: "core",
        initialValue: 0,
        min: 0,
        max: null,
      },
    ],

    stepMachine: [
      {
        id: "step-1",
        label: "Collect",
        activationPredicate: { kind: "loop_count_gte", value: 0 },
        allowedActionIds: ["move"],
        completionPredicate: { kind: "resource_gte", resourceId: "r1", value: 1 },
        effects: [{ kind: "resource_delta", resourceId: "r1", delta: 1 }],
        nextStepId: "step-1",
        telemetryEvents: ["step_enter", "step_complete"],
      },
    ],

    scene: {
      topology: "arena",
      bounds: {
        center: { x: 0, y: 0 },
        halfExtents: { x: 400, y: 300 },
      },
      topologyScores: [{ topology: "arena", score: 10 }],
    },

    entities: [
      {
        id: "player-1",
        role: "player",
        deterministicId: "det-player-1",
        components: [
          {
            kind: "transform",
            data: {
              position: { x: 0, y: 0 },
              rotation: 0,
              scale: { x: 1, y: 1 },
            },
          },
        ],
        spawnSchedule: null,
      },
      {
        id: "collectible-1",
        role: "collectible",
        deterministicId: "det-collectible-1",
        components: [
          {
            kind: "transform",
            data: {
              position: { x: 100, y: 0 },
              rotation: 0,
              scale: { x: 1, y: 1 },
            },
          },
          {
            kind: "collider",
            shape: "circle",
            data: { center: { x: 100, y: 0 }, radius: 20 },
          },
        ],
        spawnSchedule: null,
      },
    ],

    systems: [
      {
        id: "sys-movement",
        kind: "movement",
        appliesToRoles: ["player"],
        config: { speed: 200 },
      },
    ],

    rules: [
      {
        id: "rule-1",
        sourceMechanicId: "mech-1",
        trigger: { kind: "event", eventId: "collect" },
        guard: { kind: "loop_count_gte", value: 0 },
        effects: [{ kind: "resource_delta", resourceId: "r1", delta: 1 }],
      },
    ],

    objectives: [
      {
        id: "obj-1",
        label: "Collect 10 points",
        predicate: { kind: "resource_gte", resourceId: "r1", value: 10 },
        required: true,
        stepId: "step-1",
      },
    ],

    controls: [
      {
        action: "move",
        binding: { kind: "keyboard", keys: ["w", "a", "s", "d"] },
        contextPredicate: null,
      },
    ],

    telemetry: {
      events: ["session_start", "session_end", "input_action", "win", "lose"],
      metrics: ["time_to_first_action", "completion_rate"],
    },

    assumptions: ["minimal test IR"],
  };

  return { ...base, ...overrides };
}
