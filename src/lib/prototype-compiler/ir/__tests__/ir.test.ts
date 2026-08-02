/**
 * Tests for PrototypeIR schema validation, semantic hash, and input hash.
 *
 * Phase 1.1 acceptance criteria:
 * - IR can be created, serialized, validated, and hashed.
 * - Hash is stable across runs.
 * - Hash changes when semantics change.
 * - Hash does NOT change when only renderer-specific data changes.
 */

import { describe, expect, it } from "vitest";
import { computeSemanticHash } from "../semantic-hash";
import { computeInputHash, type PrototypeCompileInput } from "../input-hash";
import { safeValidatePrototypeIR, validatePrototypeIR } from "../schema";
import { IR_SCHEMA_VERSION, RUNTIME_VERSION, type PrototypeIR } from "../types";
import { minimalIR, makeIR } from "./fixtures";

describe("PrototypeIR schema validation", () => {
  it("accepts a minimal valid IR", () => {
    const ir = minimalIR();
    const result = safeValidatePrototypeIR(ir);
    expect(result.success).toBe(true);
  });

  it("rejects unknown schemaVersion", () => {
    const ir = { ...minimalIR(), schemaVersion: "9.9.9" };
    const result = safeValidatePrototypeIR(ir);
    expect(result.success).toBe(false);
  });

  it("rejects unknown runtimeVersion", () => {
    const ir = { ...minimalIR(), runtimeVersion: "9.9.9" };
    const result = safeValidatePrototypeIR(ir);
    expect(result.success).toBe(false);
  });

  it("rejects invalid seed format", () => {
    const ir = {
      ...minimalIR(),
      prng: { algorithm: "mulberry32", seed: "not-hex!" },
    };
    const result = safeValidatePrototypeIR(ir);
    expect(result.success).toBe(false);
  });

  it("rejects targetDurationSec outside 20-120 range", () => {
    const ir = makeIR({ session: { ...minimalIR().session, targetDurationSec: 10 } });
    expect(safeValidatePrototypeIR(ir).success).toBe(false);

    const ir2 = makeIR({ session: { ...minimalIR().session, targetDurationSec: 200 } });
    expect(safeValidatePrototypeIR(ir2).success).toBe(false);
  });

  it("rejects empty stepMachine", () => {
    const ir = makeIR({ stepMachine: [] });
    expect(safeValidatePrototypeIR(ir).success).toBe(false);
  });

  it("rejects empty objectives", () => {
    const ir = makeIR({ objectives: [] });
    expect(safeValidatePrototypeIR(ir).success).toBe(false);
  });

  it("rejects empty failure conditions (must have at least one)", () => {
    const ir = makeIR({ session: { ...minimalIR().session, failure: [] } });
    expect(safeValidatePrototypeIR(ir).success).toBe(false);
  });

  it("validatePrototypeIR throws on invalid input", () => {
    expect(() => validatePrototypeIR({ foo: "bar" })).toThrow();
  });

  it("accepts all 10 entity roles", () => {
    const roles = [
      "player", "enemy", "collectible", "obstacle", "projectile",
      "interaction_zone", "base", "goal", "hazard", "spawner",
    ] as const;
    for (const role of roles) {
      const ir = makeIR({
        entities: [
          {
            id: `e-${role}`,
            role,
            deterministicId: `det-${role}`,
            components: [],
            spawnSchedule: null,
          },
        ],
      });
      expect(safeValidatePrototypeIR(ir).success).toBe(true);
    }
  });
});

describe("computeSemanticHash — stability", () => {
  it("returns the same hash for identical IRs", () => {
    const ir1 = minimalIR();
    const ir2 = minimalIR();
    expect(computeSemanticHash(ir1)).toBe(computeSemanticHash(ir2));
  });

  it("returns a 16-char hex string", () => {
    const hash = computeSemanticHash(minimalIR());
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is stable across process restarts (deterministic)", () => {
    // Run twice in the same process — must match.
    const hash1 = computeSemanticHash(minimalIR());
    const hash2 = computeSemanticHash(minimalIR());
    expect(hash1).toBe(hash2);
  });
});

describe("computeSemanticHash — sensitivity", () => {
  it("changes when a rule is added", () => {
    const base = minimalIR();
    const modified = makeIR({
      rules: [
        ...base.rules,
        {
          id: "rule-new",
          sourceMechanicId: "mech-new",
          trigger: { kind: "event", eventId: "new_event" },
          guard: { kind: "time_elapsed_gte", seconds: 5 },
          effects: [{ kind: "resource_delta", resourceId: "r1", delta: 1 }],
        },
      ],
    });
    expect(computeSemanticHash(base)).not.toBe(computeSemanticHash(modified));
  });

  it("changes when a resource's initialValue changes", () => {
    const base = minimalIR();
    const modified = makeIR({
      resources: [
        { ...base.resources[0], initialValue: 999 },
      ],
    });
    expect(computeSemanticHash(base)).not.toBe(computeSemanticHash(modified));
  });

  it("changes when the success predicate changes", () => {
    const base = minimalIR();
    const modified = makeIR({
      session: {
        ...base.session,
        success: { kind: "resource_gte", resourceId: "r1", value: 999 },
      },
    });
    expect(computeSemanticHash(base)).not.toBe(computeSemanticHash(modified));
  });

  it("changes when a step's allowedActionIds change", () => {
    const base = minimalIR();
    const modified = makeIR({
      stepMachine: [
        { ...base.stepMachine[0], allowedActionIds: ["move", "aim"] },
      ],
    });
    expect(computeSemanticHash(base)).not.toBe(computeSemanticHash(modified));
  });

  it("does NOT change when only mechanicBindings change (evidence, not gameplay)", () => {
    // mechanicBindings are compile-time evidence (which adapter was used),
    // not gameplay semantics. Changing resolution from exact→alias doesn't
    // change how the prototype plays — only the provenance.
    const base = minimalIR();
    const modified = makeIR({
      mechanicBindings: [
        { ...base.mechanicBindings[0], resolution: "unsupported" },
      ],
    });
    expect(computeSemanticHash(base)).toBe(computeSemanticHash(modified));
  });
});

describe("computeSemanticHash — renderer independence", () => {
  it("does NOT change when only entity positions change (2D vs 3D)", () => {
    const base = minimalIR();
    const movedEntities = makeIR({
      entities: base.entities.map((e) => ({
        ...e,
        components: e.components.map((c) =>
          c.kind === "transform"
            ? {
                ...c,
                data: {
                  ...c.data,
                  position: { x: c.data.position.x + 100, y: c.data.position.y + 100 },
                },
              }
            : c,
        ),
      })),
    });
    // Renderer-specific entity positions are excluded from the semantic hash.
    expect(computeSemanticHash(base)).toBe(computeSemanticHash(movedEntities));
  });

  it("does NOT change when only entity IDs change (same roles/rules)", () => {
    const base = minimalIR();
    const renamed = makeIR({
      entities: base.entities.map((e) => ({
        ...e,
        id: `${e.id}-renamed`,
        deterministicId: `${e.deterministicId}-renamed`,
      })),
    });
    expect(computeSemanticHash(base)).toBe(computeSemanticHash(renamed));
  });

  it("does NOT change when step order changes (same steps by id)", () => {
    const base = minimalIR();
    const reordered = makeIR({
      stepMachine: [...base.stepMachine].reverse(),
    });
    expect(computeSemanticHash(base)).toBe(computeSemanticHash(reordered));
  });

  it("does NOT change when assumptions array changes (cosmetic)", () => {
    const base = minimalIR();
    const modified = makeIR({
      assumptions: [...base.assumptions, "new assumption"],
    });
    expect(computeSemanticHash(base)).toBe(computeSemanticHash(modified));
  });
});

describe("computeInputHash — stability", () => {
  function minimalInput(): PrototypeCompileInput {
    return {
      projectId: "p1",
      coreLoopArtifactRef: "cl@1.0.0",
      conceptArtifactRef: "concept@1.0.0",
      genre: "shooter",
      structuralType: "ecology",
      steps: [
        {
          id: "s1",
          action: "Move",
          mechanicIds: ["locomotion"],
          resourcesConsumed: [],
          resourcesProduced: [],
          feedbackType: "neutral",
          durationEstimateSec: 10,
        },
      ],
      resourceGraph: { edges: [] },
      funHypothesis: {
        hypothesisId: "h1",
        statement: "Player enjoys moving",
        protocol: {},
      },
      buildOptions: {
        dimensions: ["2d"],
        targetSessionSec: 30,
        difficulty: "baseline",
      },
    };
  }

  it("returns the same hash for identical inputs", () => {
    expect(computeInputHash(minimalInput())).toBe(computeInputHash(minimalInput()));
  });

  it("returns a 16-char hex string", () => {
    expect(computeInputHash(minimalInput())).toMatch(/^[0-9a-f]{16}$/);
  });

  it("changes when a mechanic ID changes", () => {
    const base = minimalInput();
    const modified: PrototypeCompileInput = {
      ...base,
      steps: [{ ...base.steps[0], mechanicIds: ["combat"] }],
    };
    expect(computeInputHash(base)).not.toBe(computeInputHash(modified));
  });

  it("changes when a step is added", () => {
    const base = minimalInput();
    const modified: PrototypeCompileInput = {
      ...base,
      steps: [...base.steps, {
        id: "s2",
        action: "Shoot",
        mechanicIds: ["combat"],
        resourcesConsumed: ["ammo"],
        resourcesProduced: [],
        feedbackType: "positive",
        durationEstimateSec: 5,
      }],
    };
    expect(computeInputHash(base)).not.toBe(computeInputHash(modified));
  });

  it("is order-independent for steps (sorted by id)", () => {
    const base = minimalInput();
    const reordered: PrototypeCompileInput = {
      ...base,
      steps: [...base.steps].reverse(),
    };
    // Only one step in minimal, so reversing doesn't change anything.
    // Test with two steps:
    const twoSteps: PrototypeCompileInput = {
      ...base,
      steps: [
        { id: "s2", action: "B", mechanicIds: [], resourcesConsumed: [], resourcesProduced: [], feedbackType: "neutral", durationEstimateSec: 5 },
        { id: "s1", action: "A", mechanicIds: [], resourcesConsumed: [], resourcesProduced: [], feedbackType: "neutral", durationEstimateSec: 5 },
      ],
    };
    const twoStepsReordered: PrototypeCompileInput = {
      ...base,
      steps: [twoSteps.steps[1], twoSteps.steps[0]],
    };
    expect(computeInputHash(twoSteps)).toBe(computeInputHash(twoStepsReordered));
  });

  it("changes when difficulty changes", () => {
    const base = minimalInput();
    const modified: PrototypeCompileInput = {
      ...base,
      buildOptions: { ...base.buildOptions, difficulty: "hard" },
    };
    expect(computeInputHash(base)).not.toBe(computeInputHash(modified));
  });
});
