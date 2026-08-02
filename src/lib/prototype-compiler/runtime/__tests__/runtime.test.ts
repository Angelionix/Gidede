/**
 * Tests for the shared deterministic runtime engine.
 *
 * Phase 1.5 acceptance criteria:
 * - Engine executes IR at fixed 60 Hz
 * - Same IR + same inputs → same final state (determinism)
 * - Budgets enforced (max entities, max rules per tick)
 * - No NaN/Infinity (strict numeric checks)
 * - Predicate evaluation correct for all kinds
 * - Session success/failure conditions trigger correctly
 */

import { describe, expect, it } from "vitest";
import { PrototypeRuntimeEngine } from "../engine";
import { evaluatePredicate } from "../predicate-evaluator";
import { createMulberry32, randInt, randPick } from "../prng";
import { createRuntimeState, applyResourceDelta, type RuntimeState } from "../state";
import { minimalIR, makeIR } from "../../ir/__tests__/fixtures";

describe("PRNG — mulberry32", () => {
  it("produces deterministic sequence for the same seed", () => {
    const prng1 = createMulberry32("test-seed-1");
    const prng2 = createMulberry32("test-seed-1");
    const seq1 = Array.from({ length: 10 }, () => prng1());
    const seq2 = Array.from({ length: 10 }, () => prng2());
    expect(seq1).toEqual(seq2);
  });

  it("produces different sequences for different seeds", () => {
    const prng1 = createMulberry32("seed-a");
    const prng2 = createMulberry32("seed-b");
    const seq1 = Array.from({ length: 10 }, () => prng1());
    const seq2 = Array.from({ length: 10 }, () => prng2());
    expect(seq1).not.toEqual(seq2);
  });

  it("produces values in [0, 1)", () => {
    const prng = createMulberry32("test");
    for (let i = 0; i < 100; i++) {
      const v = prng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("randInt produces values in [min, max]", () => {
    const prng = createMulberry32("test");
    for (let i = 0; i < 100; i++) {
      const v = randInt(prng, 5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(10);
    }
  });

  it("randPick returns an element from the array", () => {
    const prng = createMulberry32("test");
    const arr = ["a", "b", "c", "d"];
    for (let i = 0; i < 20; i++) {
      const v = randPick(prng, arr);
      expect(arr).toContain(v);
    }
  });
});

describe("Predicate evaluator", () => {
  function makeState(overrides: Partial<RuntimeState> = {}): RuntimeState {
    const state = createRuntimeState();
    return { ...state, ...overrides };
  }

  it("resource_gte evaluates correctly", () => {
    const state = makeState();
    state.resources.set("gold", 50);
    expect(evaluatePredicate({ kind: "resource_gte", resourceId: "gold", value: 10 }, state)).toBe(true);
    expect(evaluatePredicate({ kind: "resource_gte", resourceId: "gold", value: 100 }, state)).toBe(false);
  });

  it("resource_lte evaluates correctly", () => {
    const state = makeState();
    state.resources.set("gold", 5);
    expect(evaluatePredicate({ kind: "resource_lte", resourceId: "gold", value: 10 }, state)).toBe(true);
    expect(evaluatePredicate({ kind: "resource_lte", resourceId: "gold", value: 1 }, state)).toBe(false);
  });

  it("step_completed evaluates correctly", () => {
    const state = makeState();
    state.completedSteps.add("step-1");
    expect(evaluatePredicate({ kind: "step_completed", stepId: "step-1" }, state)).toBe(true);
    expect(evaluatePredicate({ kind: "step_completed", stepId: "step-2" }, state)).toBe(false);
  });

  it("loop_count_gte evaluates correctly", () => {
    const state = makeState();
    state.loopCount = 3;
    expect(evaluatePredicate({ kind: "loop_count_gte", value: 2 }, state)).toBe(true);
    expect(evaluatePredicate({ kind: "loop_count_gte", value: 5 }, state)).toBe(false);
  });

  it("time_elapsed_gte evaluates correctly", () => {
    const state = makeState();
    state.elapsedSec = 15;
    expect(evaluatePredicate({ kind: "time_elapsed_gte", seconds: 10 }, state)).toBe(true);
    expect(evaluatePredicate({ kind: "time_elapsed_gte", seconds: 20 }, state)).toBe(false);
  });

  it("and predicate evaluates correctly", () => {
    const state = makeState();
    state.resources.set("gold", 50);
    state.loopCount = 3;
    const pred = {
      kind: "and" as const,
      predicates: [
        { kind: "resource_gte" as const, resourceId: "gold", value: 10 },
        { kind: "loop_count_gte" as const, value: 2 },
      ],
    };
    expect(evaluatePredicate(pred, state)).toBe(true);
  });

  it("and predicate is false if any child is false", () => {
    const state = makeState();
    state.resources.set("gold", 5); // < 10
    state.loopCount = 3;
    const pred = {
      kind: "and" as const,
      predicates: [
        { kind: "resource_gte" as const, resourceId: "gold", value: 10 },
        { kind: "loop_count_gte" as const, value: 2 },
      ],
    };
    expect(evaluatePredicate(pred, state)).toBe(false);
  });

  it("or predicate evaluates correctly", () => {
    const state = makeState();
    state.resources.set("gold", 5);
    state.loopCount = 3;
    const pred = {
      kind: "or" as const,
      predicates: [
        { kind: "resource_gte" as const, resourceId: "gold", value: 10 }, // false
        { kind: "loop_count_gte" as const, value: 2 }, // true
      ],
    };
    expect(evaluatePredicate(pred, state)).toBe(true);
  });

  it("not predicate evaluates correctly", () => {
    const state = makeState();
    state.resources.set("gold", 5);
    const pred = {
      kind: "not" as const,
      predicate: { kind: "resource_gte" as const, resourceId: "gold", value: 10 },
    };
    expect(evaluatePredicate(pred, state)).toBe(true);
  });
});

describe("Runtime state", () => {
  it("applyResourceDelta respects min bound", () => {
    const state = createRuntimeState();
    state.resourceMeta.set("hp", {
      id: "hp", name: "HP", value: 100, min: 0, max: 100, class: "core",
    });
    state.resources.set("hp", 5);
    applyResourceDelta(state, "hp", -20); // would go to -15
    expect(state.resources.get("hp")).toBe(0); // clamped to min
  });

  it("applyResourceDelta respects max bound", () => {
    const state = createRuntimeState();
    state.resourceMeta.set("gold", {
      id: "gold", name: "Gold", value: 0, min: 0, max: 100, class: "core",
    });
    state.resources.set("gold", 90);
    applyResourceDelta(state, "gold", 50); // would go to 140
    expect(state.resources.get("gold")).toBe(100); // clamped to max
  });

  it("applyResourceDelta emits telemetry", () => {
    const state = createRuntimeState();
    state.resources.set("gold", 10);
    applyResourceDelta(state, "gold", 5);
    expect(state.telemetry.some((t) => t.event === "resource_changed")).toBe(true);
  });
});

describe("PrototypeRuntimeEngine — basic execution", () => {
  it("initializes resources from IR", () => {
    const ir = minimalIR();
    const engine = new PrototypeRuntimeEngine(ir);
    expect(engine.getResource("r1")).toBe(0); // initialValue from fixture
  });

  it("initializes entities from IR", () => {
    const ir = minimalIR();
    const engine = new PrototypeRuntimeEngine(ir);
    const entities = engine.getEntities();
    expect(entities.some((e) => e.role === "player")).toBe(true);
    expect(entities.some((e) => e.role === "collectible")).toBe(true);
  });

  it("sets current step to first step", () => {
    const ir = minimalIR();
    const engine = new PrototypeRuntimeEngine(ir);
    expect(engine.getCurrentStepId()).toBe("step-1");
  });

  it("advances tick on tick()", () => {
    const ir = minimalIR();
    const engine = new PrototypeRuntimeEngine(ir);
    expect(engine.state.tick).toBe(0);
    engine.tick();
    expect(engine.state.tick).toBe(1);
    engine.tick();
    expect(engine.state.tick).toBe(2);
  });

  it("emits session_start telemetry on init", () => {
    const ir = minimalIR();
    const engine = new PrototypeRuntimeEngine(ir);
    const telemetry = engine.drainTelemetry();
    expect(telemetry.some((t) => t.event === "session_start")).toBe(true);
  });
});

describe("PrototypeRuntimeEngine — determinism", () => {
  it("same IR produces same final state", () => {
    const ir = minimalIR();
    const engine1 = new PrototypeRuntimeEngine(ir);
    const engine2 = new PrototypeRuntimeEngine(ir);

    // Run both for 100 ticks with no input.
    for (let i = 0; i < 100; i++) {
      engine1.tick();
      engine2.tick();
    }

    expect(engine1.state.tick).toBe(engine2.state.tick);
    expect(engine1.state.loopCount).toBe(engine2.state.loopCount);
    expect(engine1.getResource("r1")).toBe(engine2.getResource("r1"));
  });

  it("same input sequence produces same final state", () => {
    const ir = minimalIR();
    const engine1 = new PrototypeRuntimeEngine(ir);
    const engine2 = new PrototypeRuntimeEngine(ir);

    // Submit the same inputs to both.
    for (let i = 0; i < 50; i++) {
      engine1.input({ action: "move", position: { x: 100, y: 0 }, timestamp: i * 0.016 });
      engine2.input({ action: "move", position: { x: 100, y: 0 }, timestamp: i * 0.016 });
      engine1.tick();
      engine2.tick();
    }

    expect(engine1.getResource("r1")).toBe(engine2.getResource("r1"));
  });
});

describe("PrototypeRuntimeEngine — session conditions", () => {
  it("wins when success predicate is satisfied", () => {
    // Success: resource_gte r1 10. Collect 10 items.
    const ir = minimalIR();
    const engine = new PrototypeRuntimeEngine(ir);

    // Manually set resource to trigger success.
    engine.state.resources.set("r1", 10);
    engine.tick();

    expect(engine.getStatus()).toBe("won");
  });

  it("loses when failure predicate is satisfied", () => {
    // Failure: time_elapsed_gte 30. Run 30+ seconds worth of ticks.
    const ir = minimalIR();
    const engine = new PrototypeRuntimeEngine(ir);

    // Run 31 seconds worth of ticks (31 * 60 = 1860 ticks).
    for (let i = 0; i < 31 * 60; i++) {
      if (engine.getStatus() !== "running") break;
      engine.tick();
    }

    expect(engine.getStatus()).toBe("lost");
  });

  it("times out after 2x target duration", () => {
    // targetDurationSec=30, so timeout at 60s = 3600 ticks.
    // But success is resource_gte r1 10, failure is time_elapsed_gte 30.
    // Failure will trigger first at tick 1800 (30s).
    // To test timeout, change failure to time_elapsed_gte 90 (> 2x target).
    const ir = makeIR({
      session: {
        targetDurationSec: 30,
        fixedStepHz: 60,
        success: { kind: "resource_gte", resourceId: "r1", value: 1000 }, // unreachable
        failure: [{ kind: "time_elapsed_gte", seconds: 90 }], // > 2x target
        loopTarget: 3,
      },
    });
    const engine = new PrototypeRuntimeEngine(ir);

    // Run to completion (should timeout at 60s = 3600 ticks).
    engine.run();

    expect(engine.getStatus()).toBe("timeout");
  });
});

describe("PrototypeRuntimeEngine — numeric safety", () => {
  it("does not produce NaN in entity positions", () => {
    const ir = minimalIR();
    const engine = new PrototypeRuntimeEngine(ir, { strictNumericChecks: true });

    // Run 100 ticks with movement input.
    for (let i = 0; i < 100; i++) {
      engine.input({ action: "move", position: { x: 200, y: 200 }, timestamp: i * 0.016 });
      expect(() => engine.tick()).not.toThrow();
    }

    for (const entity of engine.getEntities()) {
      expect(Number.isFinite(entity.position.x)).toBe(true);
      expect(Number.isFinite(entity.position.y)).toBe(true);
    }
  });

  it("clamps entities to world bounds", () => {
    const ir = minimalIR();
    const engine = new PrototypeRuntimeEngine(ir);

    // Move player far outside bounds.
    for (let i = 0; i < 100; i++) {
      engine.input({ action: "move", position: { x: 10000, y: 10000 }, timestamp: i * 0.016 });
      engine.tick();
    }

    const player = engine.getEntities().find((e) => e.role === "player");
    expect(player).toBeDefined();
    const bounds = ir.scene.bounds;
    expect(player!.position.x).toBeLessThanOrEqual(bounds.center.x + bounds.halfExtents.x);
    expect(player!.position.x).toBeGreaterThanOrEqual(bounds.center.x - bounds.halfExtents.x);
  });
});

describe("PrototypeRuntimeEngine — telemetry", () => {
  it("drainTelemetry returns and clears events", () => {
    const ir = minimalIR();
    const engine = new PrototypeRuntimeEngine(ir);
    engine.tick();
    const events = engine.drainTelemetry();
    expect(events.length).toBeGreaterThan(0);
    // After drain, telemetry should be empty (until next tick).
    const events2 = engine.drainTelemetry();
    expect(events2.length).toBe(0);
  });

  it("emits win event on success", () => {
    const ir = minimalIR();
    const engine = new PrototypeRuntimeEngine(ir);
    engine.state.resources.set("r1", 10);
    engine.tick();
    const events = engine.drainTelemetry();
    expect(events.some((e) => e.event === "win")).toBe(true);
  });
});
