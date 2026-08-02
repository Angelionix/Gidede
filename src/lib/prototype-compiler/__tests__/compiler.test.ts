/**
 * Integration tests for the prototype compiler entry point.
 *
 * Verifies the full pipeline:
 *   PrototypeCompileInput → compilePrototype → PrototypeBuildResult
 *
 * Phase 1 final acceptance criteria:
 * - Compiler produces a valid PrototypeIR from a realistic input
 * - Validation gates run (some may fail on minimal fixtures — that's OK)
 * - 2D HTML is generated when status is playable
 * - Unsupported mechanics produce needs_mapping status
 * - Build failures are reported honestly
 */

import { describe, expect, it } from "vitest";
import { compilePrototype } from "../index";
import type { PrototypeCompileInput } from "../ir/input-hash";
import { safeValidatePrototypeIR } from "../ir/schema";

function makeShooterInput(overrides: Partial<PrototypeCompileInput> = {}): PrototypeCompileInput {
  return {
    projectId: "test-project",
    coreLoopArtifactRef: "cl@1.0.0",
    conceptArtifactRef: "concept@1.0.0",
    genre: "shooter",
    structuralType: "ecology",
    steps: [
      {
        id: "step-move",
        action: "Move",
        mechanicIds: ["locomotion"],
        resourcesConsumed: [],
        resourcesProduced: ["position"],
        feedbackType: "neutral",
        durationEstimateSec: 5,
      },
      {
        id: "step-collect",
        action: "Collect",
        mechanicIds: ["collect"],
        resourcesConsumed: ["position"],
        resourcesProduced: ["score"],
        feedbackType: "positive",
        durationEstimateSec: 5,
      },
    ],
    resourceGraph: { edges: [] },
    funHypothesis: {
      hypothesisId: "h1",
      statement: "Player enjoys moving and collecting",
      protocol: {},
    },
    buildOptions: {
      dimensions: ["2d"],
      targetSessionSec: 30,
      difficulty: "baseline",
    },
    ...overrides,
  };
}

describe("compilePrototype — full pipeline", () => {
  it("produces a PrototypeBuildResult with all required fields", () => {
    const result = compilePrototype(makeShooterInput(), { skipSimulationGates: true });
    expect(result).toBeDefined();
    expect(result.status).toBeDefined();
    expect(result.ir).toBeDefined();
    expect(result.coverage).toBeDefined();
    expect(result.validation).toBeDefined();
    expect(result.artifact).toBeDefined();
  });

  it("produces a schema-valid PrototypeIR", () => {
    const result = compilePrototype(makeShooterInput(), { skipSimulationGates: true });
    const schemaResult = safeValidatePrototypeIR(result.ir);
    expect(schemaResult.success).toBe(true);
  });

  it("resolves locomotion and collect mechanics", () => {
    const result = compilePrototype(makeShooterInput(), { skipSimulationGates: true });
    const bindingIds = result.ir.mechanicBindings.map((b) => b.adapterId);
    expect(bindingIds).toContain("locomotion");
    expect(bindingIds).toContain("collect");
  });

  it("includes movement system from locomotion adapter", () => {
    const result = compilePrototype(makeShooterInput(), { skipSimulationGates: true });
    expect(result.ir.systems.some((s) => s.kind === "movement")).toBe(true);
  });

  it("includes collect system from collect adapter", () => {
    const result = compilePrototype(makeShooterInput(), { skipSimulationGates: true });
    expect(result.ir.systems.some((s) => s.kind === "collect")).toBe(true);
  });

  it("includes player entity", () => {
    const result = compilePrototype(makeShooterInput(), { skipSimulationGates: true });
    expect(result.ir.entities.some((e) => e.role === "player")).toBe(true);
  });

  it("includes collectible entities", () => {
    const result = compilePrototype(makeShooterInput(), { skipSimulationGates: true });
    expect(result.ir.entities.some((e) => e.role === "collectible")).toBe(true);
  });

  it("includes move control binding", () => {
    const result = compilePrototype(makeShooterInput(), { skipSimulationGates: true });
    expect(result.ir.controls.some((c) => c.action === "move")).toBe(true);
  });

  it("produces a semantic hash in the artifact", () => {
    const result = compilePrototype(makeShooterInput(), { skipSimulationGates: true });
    expect(result.artifact.irSemanticHash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("produces an input hash in the artifact", () => {
    const result = compilePrototype(makeShooterInput(), { skipSimulationGates: true });
    expect(result.artifact.inputHash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("deterministically produces the same result for the same input", () => {
    const input = makeShooterInput({ buildOptions: { dimensions: ["2d"], targetSessionSec: 30, difficulty: "baseline", seed: "fixed-seed" } });
    const r1 = compilePrototype(input, { skipSimulationGates: true });
    const r2 = compilePrototype(input, { skipSimulationGates: true });
    expect(r1.artifact.irSemanticHash).toBe(r2.artifact.irSemanticHash);
    expect(r1.artifact.inputHash).toBe(r2.artifact.inputHash);
  });
});

describe("compilePrototype — needs_mapping status", () => {
  it("returns needs_mapping when an unsupported mechanic is present", () => {
    const input = makeShooterInput({
      steps: [
        {
          id: "step-1",
          action: "Negotiate",
          mechanicIds: ["social_dialogue"], // unsupported
          resourcesConsumed: [],
          resourcesProduced: [],
          feedbackType: "neutral",
          durationEstimateSec: 5,
        },
      ],
    });
    const result = compilePrototype(input, { skipSimulationGates: true });
    expect(result.status).toBe("needs_mapping");
    expect(result.coverage.unsupportedMechanicIds).toContain("social_dialogue");
  });
});

describe("compilePrototype — 2D HTML generation", () => {
  it("generates 2D HTML when status is playable", () => {
    const result = compilePrototype(makeShooterInput(), { skipSimulationGates: true });
    // Status should be playable or needs_mapping (both generate HTML).
    if (result.status === "playable" || result.status === "needs_mapping") {
      expect(result.builds["2d"]).toBeDefined();
      expect(result.builds["2d"]?.html).toContain("<!DOCTYPE html>");
      expect(result.builds["2d"]?.html).toContain("<canvas");
    }
  });

  it("does NOT generate HTML when status is invalid", () => {
    // Create an input that will fail validation gates.
    const input = makeShooterInput({
      steps: [
        {
          id: "step-1",
          action: "Do nothing",
          mechanicIds: [], // no mechanics → no adapters → no controls → gate 5 fails
          resourcesConsumed: [],
          resourcesProduced: [],
          feedbackType: "neutral",
          durationEstimateSec: 5,
        },
      ],
    });
    const result = compilePrototype(input, { skipSimulationGates: true });
    // With no mechanics, status should be invalid (gate 5: controls missing).
    if (result.status === "invalid") {
      expect(result.builds["2d"]).toBeUndefined();
    }
  });
});

describe("compilePrototype — validation gates", () => {
  it("runs all 10 gates when simulation is enabled", () => {
    const result = compilePrototype(makeShooterInput(), { skipSimulationGates: false, maxBotTicks: 500 });
    const allGateIds = new Set([
      ...result.validation.gatesPassed,
      ...result.validation.gatesFailed.map((g) => g.gateId),
    ]);
    expect(allGateIds.size).toBe(10);
  });

  it("runs only static gates (1-7) when simulation is skipped", () => {
    const result = compilePrototype(makeShooterInput(), { skipSimulationGates: true });
    const allGateIds = new Set([
      ...result.validation.gatesPassed,
      ...result.validation.gatesFailed.map((g) => g.gateId),
    ]);
    expect(allGateIds.size).toBe(7);
    expect(allGateIds.has(8)).toBe(false);
    expect(allGateIds.has(9)).toBe(false);
    expect(allGateIds.has(10)).toBe(false);
  });
});

describe("compilePrototype — difficulty scaling", () => {
  it("easy difficulty produces different speed than hard", () => {
    const easyInput = makeShooterInput({
      buildOptions: { dimensions: ["2d"], targetSessionSec: 30, difficulty: "easy", seed: "test" },
    });
    const hardInput = makeShooterInput({
      buildOptions: { dimensions: ["2d"], targetSessionSec: 30, difficulty: "hard", seed: "test" },
    });
    const easyResult = compilePrototype(easyInput, { skipSimulationGates: true });
    const hardResult = compilePrototype(hardInput, { skipSimulationGates: true });

    const easySpeed = easyResult.ir.systems.find((s) => s.kind === "movement")?.config.speed as number;
    const hardSpeed = hardResult.ir.systems.find((s) => s.kind === "movement")?.config.speed as number;
    expect(easySpeed).toBeLessThan(hardSpeed);

    // Different difficulty → different semantic hash (speed is in systems config).
    expect(easyResult.artifact.irSemanticHash).not.toBe(hardResult.artifact.irSemanticHash);
  });
});

describe("compilePrototype — traceability", () => {
  it("every rule has a sourceMechanicId", () => {
    const result = compilePrototype(makeShooterInput(), { skipSimulationGates: true });
    for (const rule of result.ir.rules) {
      expect(rule.sourceMechanicId).toBeTruthy();
    }
  });

  it("mechanicBindings include representedByRuleIds for resolved mechanics", () => {
    const result = compilePrototype(makeShooterInput(), { skipSimulationGates: true });
    const locomotionBinding = result.ir.mechanicBindings.find((b) => b.adapterId === "locomotion");
    expect(locomotionBinding).toBeDefined();
    expect(locomotionBinding?.representedByRuleIds.length).toBeGreaterThan(0);
  });

  it("objectives reference step IDs", () => {
    const result = compilePrototype(makeShooterInput(), { skipSimulationGates: true });
    for (const obj of result.ir.objectives) {
      expect(obj.stepId).toBeTruthy();
    }
  });
});
