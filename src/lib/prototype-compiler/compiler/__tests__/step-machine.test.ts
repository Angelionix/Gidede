/**
 * Tests for the step/resource state machine compiler.
 *
 * Phase 1.3 acceptance criteria:
 * - Core Loop steps compile into an executable state machine
 * - Resources are derived from consumed/produced
 * - Loop closure is detected (closed vs open)
 * - Duplicate step IDs are rejected
 * - Unreachable steps are warned
 */

import { describe, expect, it } from "vitest";
import { compileStepMachine, deriveResourcesFromSteps } from "../step-machine";
import type { PrototypeCompileInput } from "../../ir/input-hash";

function makeInput(overrides: Partial<PrototypeCompileInput> = {}): PrototypeCompileInput {
  return {
    projectId: "p1",
    coreLoopArtifactRef: "cl@1.0.0",
    conceptArtifactRef: "concept@1.0.0",
    genre: "shooter",
    structuralType: "ecology",
    steps: [
      {
        id: "s1",
        action: "Explore",
        mechanicIds: ["locomotion"],
        resourcesConsumed: [],
        resourcesProduced: ["position"],
        feedbackType: "neutral",
        durationEstimateSec: 10,
      },
      {
        id: "s2",
        action: "Collect",
        mechanicIds: ["collect"],
        resourcesConsumed: ["position"],
        resourcesProduced: ["gold"],
        feedbackType: "positive",
        durationEstimateSec: 5,
      },
      {
        id: "s3",
        action: "Upgrade",
        mechanicIds: ["upgrade"],
        resourcesConsumed: ["gold"],
        resourcesProduced: ["position"],
        feedbackType: "positive",
        durationEstimateSec: 8,
      },
    ],
    resourceGraph: { edges: [] },
    funHypothesis: null,
    buildOptions: {
      dimensions: ["2d"],
      targetSessionSec: 30,
      difficulty: "baseline",
    },
    ...overrides,
  };
}

describe("compileStepMachine — basic compilation", () => {
  it("compiles steps into a state machine with correct count", () => {
    const result = compileStepMachine(makeInput());
    expect(result.steps).toHaveLength(3);
    expect(result.diagnostics.filter((d) => d.level === "error")).toHaveLength(0);
  });

  it("each step has id, label, predicates, effects, nextStepId", () => {
    const result = compileStepMachine(makeInput());
    for (const step of result.steps) {
      expect(step.id).toBeTruthy();
      expect(step.label).toBeTruthy();
      expect(step.activationPredicate).toBeDefined();
      expect(step.completionPredicate).toBeDefined();
      expect(step.effects).toBeDefined();
      expect(step.nextStepId).toBeTruthy();
      expect(step.telemetryEvents).toContain("step_enter");
      expect(step.telemetryEvents).toContain("step_complete");
    }
  });

  it("links steps in order: step[i].nextStepId = step[i+1].id", () => {
    const result = compileStepMachine(makeInput());
    expect(result.steps[0].nextStepId).toBe("s2");
    expect(result.steps[1].nextStepId).toBe("s3");
    expect(result.steps[2].nextStepId).toBe("s1"); // closes the loop
  });
});

describe("compileStepMachine — resource derivation", () => {
  it("derives resources from consumed + produced across all steps", () => {
    const input = makeInput();
    const resources = deriveResourcesFromSteps(input.steps);
    const ids = resources.map((r) => r.id);
    expect(ids).toContain("position");
    expect(ids).toContain("gold");
    expect(resources.every((r) => r.class === "core")).toBe(true);
    expect(resources.every((r) => r.initialValue === 0)).toBe(true);
  });

  it("deduplicates resources (same ID appears once)", () => {
    const input = makeInput();
    const resources = deriveResourcesFromSteps(input.steps);
    const positionCount = resources.filter((r) => r.id === "position").length;
    expect(positionCount).toBe(1);
  });
});

describe("compileStepMachine — activation predicates", () => {
  it("step with no consumed resources is always active (loop_count_gte 0)", () => {
    const result = compileStepMachine(makeInput());
    expect(result.steps[0].activationPredicate).toEqual({ kind: "loop_count_gte", value: 0 });
  });

  it("step with one consumed resource requires resource_gte 1", () => {
    const result = compileStepMachine(makeInput());
    expect(result.steps[1].activationPredicate).toEqual({
      kind: "resource_gte",
      resourceId: "position",
      value: 1,
    });
  });

  it("step with multiple consumed resources uses 'and' predicate", () => {
    const input = makeInput({
      steps: [
        {
          id: "s1",
          action: "Craft",
          mechanicIds: ["craft"],
          resourcesConsumed: ["wood", "metal"],
          resourcesProduced: ["sword"],
          feedbackType: "positive",
          durationEstimateSec: 5,
        },
        {
          id: "s2",
          action: "Use",
          mechanicIds: ["combat"],
          resourcesConsumed: ["sword"],
          resourcesProduced: ["wood"],
          feedbackType: "positive",
          durationEstimateSec: 5,
        },
      ],
    });
    const result = compileStepMachine(input);
    expect(result.steps[0].activationPredicate).toEqual({
      kind: "and",
      predicates: [
        { kind: "resource_gte", resourceId: "wood", value: 1 },
        { kind: "resource_gte", resourceId: "metal", value: 1 },
      ],
    });
  });
});

describe("compileStepMachine — completion predicates", () => {
  it("step with produced resources completes when first produced resource >= 1", () => {
    const result = compileStepMachine(makeInput());
    expect(result.steps[0].completionPredicate).toEqual({
      kind: "resource_gte",
      resourceId: "position",
      value: 1,
    });
  });

  it("step with no produced resources completes on time_elapsed_gte", () => {
    const input = makeInput({
      steps: [
        {
          id: "s1",
          action: "Wait",
          mechanicIds: [],
          resourcesConsumed: [],
          resourcesProduced: [],
          feedbackType: "neutral",
          durationEstimateSec: 7,
        },
        {
          id: "s2",
          action: "Done",
          mechanicIds: [],
          resourcesConsumed: [],
          resourcesProduced: [],
          feedbackType: "neutral",
          durationEstimateSec: 3,
        },
      ],
    });
    const result = compileStepMachine(input);
    expect(result.steps[0].completionPredicate).toEqual({
      kind: "time_elapsed_gte",
      seconds: 7,
    });
  });
});

describe("compileStepMachine — effects", () => {
  it("produces resource_delta effects for each produced resource", () => {
    const result = compileStepMachine(makeInput());
    expect(result.steps[0].effects).toEqual([
      { kind: "resource_delta", resourceId: "position", delta: 1 },
    ]);
    expect(result.steps[1].effects).toEqual([
      { kind: "resource_delta", resourceId: "gold", delta: 1 },
    ]);
  });

  it("step with no produced resources has empty effects", () => {
    const input = makeInput({
      steps: [
        {
          id: "s1",
          action: "Wait",
          mechanicIds: [],
          resourcesConsumed: [],
          resourcesProduced: [],
          feedbackType: "neutral",
          durationEstimateSec: 5,
        },
      ],
    });
    const result = compileStepMachine(input);
    expect(result.steps[0].effects).toEqual([]);
  });
});

describe("compileStepMachine — loop closure", () => {
  it("detects closed loop when first step is always active", () => {
    const result = compileStepMachine(makeInput());
    expect(result.isClosed).toBe(true);
  });

  it("detects closed loop when last step produces resource first step consumes", () => {
    const input = makeInput({
      steps: [
        {
          id: "s1",
          action: "Mine",
          mechanicIds: ["collect"],
          resourcesConsumed: ["energy"],
          resourcesProduced: ["ore"],
          feedbackType: "positive",
          durationEstimateSec: 5,
        },
        {
          id: "s2",
          action: "Refine",
          mechanicIds: ["convert"],
          resourcesConsumed: ["ore"],
          resourcesProduced: ["energy"],
          feedbackType: "positive",
          durationEstimateSec: 5,
        },
      ],
    });
    const result = compileStepMachine(input);
    expect(result.isClosed).toBe(true);
    expect(result.diagnostics.filter((d) => d.code === "step_machine.open_loop")).toHaveLength(0);
  });

  it("warns about open loop when last step doesn't produce activating resource", () => {
    const input = makeInput({
      steps: [
        {
          id: "s1",
          action: "Mine",
          mechanicIds: ["collect"],
          resourcesConsumed: ["energy"],
          resourcesProduced: ["ore"],
          feedbackType: "positive",
          durationEstimateSec: 5,
        },
        {
          id: "s2",
          action: "Sell",
          mechanicIds: ["convert"],
          resourcesConsumed: ["ore"],
          resourcesProduced: ["gold"],
          feedbackType: "positive",
          durationEstimateSec: 5,
        },
      ],
    });
    const result = compileStepMachine(input);
    expect(result.isClosed).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "step_machine.open_loop")).toBe(true);
  });
});

describe("compileStepMachine — validation", () => {
  it("rejects empty steps", () => {
    const input = makeInput({ steps: [] });
    const result = compileStepMachine(input);
    expect(result.steps).toHaveLength(0);
    expect(result.diagnostics.some((d) => d.code === "step_machine.empty")).toBe(true);
  });

  it("rejects duplicate step IDs", () => {
    const input = makeInput({
      steps: [
        { id: "s1", action: "A", mechanicIds: [], resourcesConsumed: [], resourcesProduced: [], feedbackType: "neutral", durationEstimateSec: 5 },
        { id: "s1", action: "B", mechanicIds: [], resourcesConsumed: [], resourcesProduced: [], feedbackType: "neutral", durationEstimateSec: 5 },
      ],
    });
    const result = compileStepMachine(input);
    expect(result.diagnostics.some((d) => d.code === "step_machine.duplicate_id")).toBe(true);
    expect(result.steps).toHaveLength(0);
  });
});

describe("compileStepMachine — single-step loop", () => {
  it("single step closes loop to itself", () => {
    const input = makeInput({
      steps: [
        {
          id: "solo",
          action: "Repeat",
          mechanicIds: ["collect"],
          resourcesConsumed: [],
          resourcesProduced: ["score"],
          feedbackType: "positive",
          durationEstimateSec: 5,
        },
      ],
    });
    const result = compileStepMachine(input);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].nextStepId).toBe("solo");
    expect(result.isClosed).toBe(true);
  });
});
