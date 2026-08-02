/**
 * Tests for validation gates.
 *
 * Phase 1.7 acceptance criteria:
 * - All 10 gates are implemented and tested
 * - Static gates (1-7) catch common IR issues
 * - Simulation gates (8-10) use headless bot
 * - Coverage report is accurate
 */

import { describe, expect, it } from "vitest";
import { validatePrototype, computeCoverageReport } from "../validation";
import { minimalIR, makeIR } from "../../ir/__tests__/fixtures";

describe("Gate 1: mechanics_bound", () => {
  it("passes when all mechanics have non-unsupported bindings", () => {
    const ir = minimalIR(); // has locomotion binding with resolution 'exact'
    const report = validatePrototype(ir, { runSimulationGates: false });
    expect(report.gatesPassed).toContain(1);
  });

  it("fails when a mechanic has unsupported resolution", () => {
    const ir = makeIR({
      mechanicBindings: [
        {
          sourceMechanicId: "social_dialogue",
          adapterId: null,
          adapterVersion: null,
          resolution: "unsupported",
          representedByRuleIds: [],
          assumptions: [],
        },
      ],
    });
    const report = validatePrototype(ir, { runSimulationGates: false });
    const gate1 = report.gatesFailed.find((g) => g.gateId === 1);
    expect(gate1).toBeDefined();
    expect(gate1?.reason).toContain("social_dialogue");
  });
});

describe("Gate 2: steps_represented", () => {
  it("passes when steps have rules or objectives", () => {
    const ir = minimalIR(); // step-1 has a rule and an objective
    const report = validatePrototype(ir, { runSimulationGates: false });
    expect(report.gatesPassed).toContain(2);
  });

  it("fails when a step has no rules, objectives, or actions", () => {
    const ir = makeIR({
      stepMachine: [
        {
          id: "orphan-step",
          label: "Orphan",
          activationPredicate: { kind: "loop_count_gte", value: 0 },
          allowedActionIds: [],
          completionPredicate: { kind: "time_elapsed_gte", seconds: 5 },
          effects: [],
          nextStepId: "orphan-step",
          telemetryEvents: [],
        },
      ],
      rules: [],
      objectives: [],
    });
    const report = validatePrototype(ir, { runSimulationGates: false });
    expect(report.gatesFailed.find((g) => g.gateId === 2)).toBeDefined();
  });
});

describe("Gate 3: consumed_resources_reachable", () => {
  it("passes when consumed resources have a source", () => {
    const ir = minimalIR(); // r1 has initialValue 0 but is produced by rule-1
    const report = validatePrototype(ir, { runSimulationGates: false });
    expect(report.gatesPassed).toContain(3);
  });

  it("fails when a consumed resource has no source", () => {
    const ir = makeIR({
      resources: [
        { id: "gold", name: "Gold", icon: "💰", class: "core", initialValue: 0, min: 0, max: null },
      ],
      stepMachine: [
        {
          id: "step-1",
          label: "Spend",
          activationPredicate: { kind: "resource_gte", resourceId: "gold", value: 1 },
          allowedActionIds: [],
          completionPredicate: { kind: "time_elapsed_gte", seconds: 5 },
          effects: [{ kind: "resource_delta", resourceId: "gold", delta: -1 }],
          nextStepId: "step-1",
          telemetryEvents: [],
        },
      ],
      rules: [],
      objectives: [
        {
          id: "obj-1",
          label: "Test",
          predicate: { kind: "resource_gte", resourceId: "gold", value: 10 },
          required: true,
          stepId: "step-1",
        },
      ],
    });
    const report = validatePrototype(ir, { runSimulationGates: false });
    expect(report.gatesFailed.find((g) => g.gateId === 3)).toBeDefined();
  });
});

describe("Gate 4: success_failure_defined", () => {
  it("passes when success and failure are different", () => {
    const ir = minimalIR();
    const report = validatePrototype(ir, { runSimulationGates: false });
    expect(report.gatesPassed).toContain(4);
  });

  it("fails when success and failure are identical", () => {
    const ir = makeIR({
      session: {
        targetDurationSec: 30,
        fixedStepHz: 60,
        success: { kind: "time_elapsed_gte", seconds: 30 },
        failure: [{ kind: "time_elapsed_gte", seconds: 30 }],
        loopTarget: 3,
      },
    });
    const report = validatePrototype(ir, { runSimulationGates: false });
    expect(report.gatesFailed.find((g) => g.gateId === 4)).toBeDefined();
  });
});

describe("Gate 5: controls_cover_actions", () => {
  it("passes when locomotion has move control", () => {
    const ir = minimalIR(); // has move control + locomotion binding
    const report = validatePrototype(ir, { runSimulationGates: false });
    expect(report.gatesPassed).toContain(5);
  });

  it("fails when locomotion is bound but move control is missing", () => {
    const ir = makeIR({
      controls: [], // no controls
    });
    const report = validatePrototype(ir, { runSimulationGates: false });
    expect(report.gatesFailed.find((g) => g.gateId === 5)).toBeDefined();
  });

  it("fails when combat is bound but aim/primary_action missing", () => {
    const ir = makeIR({
      mechanicBindings: [
        {
          sourceMechanicId: "combat",
          adapterId: "target/combat",
          adapterVersion: "1.0.0",
          resolution: "exact",
          representedByRuleIds: [],
          assumptions: [],
        },
      ],
      controls: [
        { action: "move", binding: { kind: "keyboard", keys: ["w"] }, contextPredicate: null },
      ],
    });
    const report = validatePrototype(ir, { runSimulationGates: false });
    const gate5 = report.gatesFailed.find((g) => g.gateId === 5);
    expect(gate5).toBeDefined();
    expect(gate5?.reason).toContain("aim");
    expect(gate5?.reason).toContain("primary_action");
  });
});

describe("Gate 6: no_unreachable_states", () => {
  it("passes when all steps are reachable from the first", () => {
    const ir = minimalIR(); // single step, self-loop
    const report = validatePrototype(ir, { runSimulationGates: false });
    expect(report.gatesPassed).toContain(6);
  });

  it("fails when a step is unreachable", () => {
    const ir = makeIR({
      stepMachine: [
        {
          id: "step-1",
          label: "Step 1",
          activationPredicate: { kind: "loop_count_gte", value: 0 },
          allowedActionIds: [],
          completionPredicate: { kind: "time_elapsed_gte", seconds: 5 },
          effects: [],
          nextStepId: "step-1", // loops to itself
          telemetryEvents: [],
        },
        {
          id: "step-2",
          label: "Step 2 (unreachable)",
          activationPredicate: { kind: "loop_count_gte", value: 0 },
          allowedActionIds: [],
          completionPredicate: { kind: "time_elapsed_gte", seconds: 5 },
          effects: [],
          nextStepId: "step-2",
          telemetryEvents: [],
        },
      ],
    });
    const report = validatePrototype(ir, { runSimulationGates: false });
    expect(report.gatesFailed.find((g) => g.gateId === 6)).toBeDefined();
  });
});

describe("Gate 7: renderer_capability", () => {
  it("passes when all entity roles are known", () => {
    const ir = minimalIR(); // player + collectible
    const report = validatePrototype(ir, { runSimulationGates: false });
    expect(report.gatesPassed).toContain(7);
  });

  it("fails when an entity has an unknown role", () => {
    const ir = makeIR({
      entities: [
        {
          id: "weird-1",
          role: "unknown_role" as never,
          deterministicId: "det-weird",
          components: [],
          spawnSchedule: null,
        },
      ],
    });
    const report = validatePrototype(ir, { runSimulationGates: false });
    expect(report.gatesFailed.find((g) => g.gateId === 7)).toBeDefined();
  });
});

describe("Gate 9: idle_bot_does_not_win", () => {
  it("passes when idle bot does not win (failure triggers first)", () => {
    // minimalIR has failure: time_elapsed_gte 30, success: resource_gte 10.
    // Without input, no collectibles are collected, so resource stays 0.
    // Failure (timeout at 30s) triggers first.
    const ir = minimalIR();
    const report = validatePrototype(ir, { maxBotTicks: 30 * 60 });
    expect(report.gatesPassed).toContain(9);
  });

  it("fails when idle bot wins without input", () => {
    // Success: loop_count_gte 0 (trivially true at start).
    const ir = makeIR({
      session: {
        targetDurationSec: 30,
        fixedStepHz: 60,
        success: { kind: "loop_count_gte", value: 0 },
        failure: [{ kind: "time_elapsed_gte", seconds: 60 }],
        loopTarget: 3,
      },
    });
    const report = validatePrototype(ir, { maxBotTicks: 100 });
    expect(report.gatesFailed.find((g) => g.gateId === 9)).toBeDefined();
  });
});

describe("Gate 10: runtime_stability", () => {
  it("passes when runtime runs without NaN or unbounded growth", () => {
    const ir = minimalIR();
    const report = validatePrototype(ir, { maxBotTicks: 500 });
    expect(report.gatesPassed).toContain(10);
  });
});

describe("Full validation report", () => {
  it("returns all 10 gate results", () => {
    const ir = minimalIR();
    const report = validatePrototype(ir, { maxBotTicks: 500 });
    const allGateIds = new Set([...report.gatesPassed, ...report.gatesFailed.map((g) => g.gateId)]);
    expect(allGateIds.size).toBe(10);
  });

  it("gatesPassed and gatesFailed are disjoint", () => {
    const ir = minimalIR();
    const report = validatePrototype(ir, { maxBotTicks: 500 });
    const passedSet = new Set(report.gatesPassed);
    for (const failed of report.gatesFailed) {
      expect(passedSet.has(failed.gateId)).toBe(false);
    }
  });
});

describe("computeCoverageReport", () => {
  it("reports represented and missing steps", () => {
    const ir = minimalIR();
    const coverage = computeCoverageReport(ir);
    expect(coverage.representedStepIds).toContain("step-1");
    expect(coverage.missingStepIds).toHaveLength(0);
  });

  it("reports unsupported mechanics", () => {
    const ir = makeIR({
      mechanicBindings: [
        {
          sourceMechanicId: "social",
          adapterId: null,
          adapterVersion: null,
          resolution: "unsupported",
          representedByRuleIds: [],
          assumptions: [],
        },
      ],
    });
    const coverage = computeCoverageReport(ir);
    expect(coverage.unsupportedMechanicIds).toContain("social");
  });

  it("reports mandatory mechanics coverage", () => {
    const ir = minimalIR();
    const coverage = computeCoverageReport(ir);
    expect(coverage.mandatoryMechanics.total).toBe(1);
    expect(coverage.mandatoryMechanics.represented).toBe(1);
  });

  it("includes assumptions from IR", () => {
    const ir = makeIR({ assumptions: ["test assumption"] });
    const coverage = computeCoverageReport(ir);
    expect(coverage.assumptions).toContain("test assumption");
  });
});
