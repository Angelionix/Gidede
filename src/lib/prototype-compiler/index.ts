/**
 * Prototype compiler — main entry point.
 *
 * Orchestrates the full compilation pipeline:
 *   PrototypeCompileInput
 *     → normalize (resolve mechanics via registry)
 *     → compile step machine
 *     → select scene topology + synthesize world
 *     → merge adapter fragments
 *     → assemble PrototypeIR
 *     → validate (10 gates)
 *     → render (2D HTML)
 *
 * Design spec: docs/PLAYABLE_PROTOTYPE_COMPILER_DESIGN.md (section 8)
 *
 * This is the public API that the /api/v1/prototypes/generate route will
 * eventually call instead of the legacy generatePrototypeHtml().
 */

import type {
  PrototypeIR,
  PrototypeBuildResult,
  PrototypeArtifactV2,
  MechanicBinding,
  ResourceSpec,
  EntitySpec,
  SystemSpec,
  RuleSpec,
  ObjectiveSpec,
  ControlBindingSpec,
  TelemetryEventName,
  EffectSpec,
  StepStateSpec,
} from "./ir/types";
import { IR_SCHEMA_VERSION, RUNTIME_VERSION } from "./ir/types";
import { computeSemanticHash } from "./ir/semantic-hash";
import { computeInputHash, type PrototypeCompileInput } from "./ir/input-hash";
import { safeValidatePrototypeIR } from "./ir/schema";
import {
  getMechanicAdapterRegistry,
  type Capability,
  type MechanicCompileContext,
  type MechanicFragment,
} from "./registry/registry";
import { compileStepMachine } from "./compiler/step-machine";
import { selectTopology, synthesizeWorld } from "./compiler/scene-grammar";
import { validatePrototype, computeCoverageReport } from "./compiler/validation";
import { render2dHtml } from "./renderers/renderer-2d";
import { render3dHtml } from "./renderers/renderer-3d";

// ============================================================
// Public API
// ============================================================

export interface CompileOptions {
  /** Skip simulation gates (8-10) for faster compilation. Default: false. */
  skipSimulationGates?: boolean;
  /** Override max bot ticks for simulation gates. */
  maxBotTicks?: number;
}

/**
 * Compile a PrototypeCompileInput into a PrototypeBuildResult.
 *
 * This is the main entry point. It:
 * 1. Resolves mechanics via the adapter registry
 * 2. Compiles the step machine
 * 3. Selects scene topology
 * 4. Synthesizes the world
 * 5. Merges adapter fragments
 * 6. Assembles the PrototypeIR
 * 7. Validates the IR (10 gates)
 * 8. Renders 2D HTML
 *
 * Returns a PrototypeBuildResult with status: playable | needs_mapping | invalid | build_failed.
 */
export function compilePrototype(
  input: PrototypeCompileInput,
  options: CompileOptions = {},
): PrototypeBuildResult {
  const inputHash = computeInputHash(input);
  const seed = input.buildOptions.seed || inputHash;

  // --------------------------------------------------------
  // Step 1: Resolve mechanics
  // --------------------------------------------------------
  const registry = getMechanicAdapterRegistry();
  const allMechanicIds = new Set<string>();
  for (const step of input.steps) {
    for (const mechId of step.mechanicIds) {
      allMechanicIds.add(mechId);
    }
  }

  const mechanicBindings: MechanicBinding[] = [];
  const resolvedAdapters: Array<{ binding: MechanicBinding; adapter: NonNullable<ReturnType<typeof registry.resolve>>["adapter"]; mechanicId: string }> = [];
  const capabilities: Capability[] = [];

  for (const mechId of allMechanicIds) {
    const binding = registry.resolveBinding(mechId, input.buildOptions.mappingOverrides);
    mechanicBindings.push(binding);

    const resolved = registry.resolve(mechId, input.buildOptions.mappingOverrides);
    if (resolved) {
      resolvedAdapters.push({ binding, adapter: resolved.adapter, mechanicId: mechId });
      for (const cap of resolved.adapter.capabilities) {
        if (!capabilities.includes(cap)) capabilities.push(cap);
      }
    }
  }

  // --------------------------------------------------------
  // Step 2: Compile step machine
  // --------------------------------------------------------
  const stepMachineResult = compileStepMachine(input);
  const resourcesFromSteps = stepMachineResult.resources;

  // --------------------------------------------------------
  // Step 3: Select scene topology
  // --------------------------------------------------------
  const topologyResult = selectTopology(capabilities, input.structuralType);

  // --------------------------------------------------------
  // Step 4: Compile adapter fragments
  // --------------------------------------------------------
  const fragments: MechanicFragment[] = [];
  for (const { adapter, mechanicId } of resolvedAdapters) {
    // Find the step this mechanic belongs to.
    const stepForMechanic = input.steps.find((s) => s.mechanicIds.includes(mechanicId));
    const ctx: MechanicCompileContext = {
      stepId: stepForMechanic?.id ?? "step-1",
      stepLabel: stepForMechanic?.action ?? "Step",
      availableResources: resourcesFromSteps,
      existingSteps: stepMachineResult.steps as unknown as StepStateSpec[],
      difficulty: input.buildOptions.difficulty,
      seed,
    };
    const fragment = adapter.compile(ctx);
    fragments.push(fragment);
  }

  // --------------------------------------------------------
  // Step 5: Merge fragments
  // --------------------------------------------------------
  const mergedRules: RuleSpec[] = [];
  const mergedSystems: SystemSpec[] = [];
  const mergedControls: ControlBindingSpec[] = [];
  const mergedObjectives: ObjectiveSpec[] = [];
  const mergedResources: ResourceSpec[] = [...resourcesFromSteps];
  const mergedEntities: EntitySpec[] = [];
  const mergedTelemetry: TelemetryEventName[] = [];
  const mergedAssumptions: string[] = [];

  for (const frag of fragments) {
    mergedRules.push(...frag.rules);
    mergedSystems.push(...frag.systems);
    mergedControls.push(...frag.controls);
    mergedObjectives.push(...frag.objectives);

    // Deduplicate resources by ID.
    for (const res of frag.requiredResources) {
      if (!mergedResources.find((r) => r.id === res.id)) {
        mergedResources.push(res);
      }
    }
    mergedEntities.push(...frag.requiredEntities);
    for (const evt of frag.telemetryEvents) {
      if (!mergedTelemetry.includes(evt)) mergedTelemetry.push(evt);
    }
    mergedAssumptions.push(...frag.assumptions);
  }

  // Fill in allowedActionIds for each step from controls.
  const stepMachine: StepStateSpec[] = stepMachineResult.steps.map((step) => ({
    ...step,
    allowedActionIds: mergedControls.map((c) => c.action),
  }));

  // --------------------------------------------------------
  // Step 6: Synthesize world
  // --------------------------------------------------------
  const worldResult = synthesizeWorld(topologyResult.topology, mergedEntities, seed);
  const allEntities = [...mergedEntities, ...worldResult.worldEntities];
  mergedAssumptions.push(...worldResult.assumptions);

  // --------------------------------------------------------
  // Step 7: Assemble PrototypeIR
  // --------------------------------------------------------
  const ir: PrototypeIR = {
    schemaVersion: IR_SCHEMA_VERSION,
    runtimeVersion: RUNTIME_VERSION,
    seed,
    prng: { algorithm: "mulberry32", seed },

    source: {
      projectId: input.projectId,
      artifactVersions: {
        concept: input.conceptArtifactRef,
        core_loop: input.coreLoopArtifactRef,
      },
      hypothesisId: input.funHypothesis?.hypothesisId ?? null,
    },

    session: {
      targetDurationSec: input.buildOptions.targetSessionSec,
      fixedStepHz: 60,
      success: deriveSuccessPredicate(input, mergedResources),
      failure: deriveFailurePredicates(input),
      loopTarget: Math.max(1, input.steps.length),
    },

    mechanicBindings: fillRuleIds(mechanicBindings, mergedRules),
    resources: mergedResources,
    stepMachine,
    scene: {
      topology: topologyResult.topology,
      bounds: worldResult.scene.bounds,
      topologyScores: topologyResult.scores,
    },
    entities: allEntities,
    systems: mergedSystems,
    rules: mergedRules,
    objectives: mergedObjectives.length > 0 ? mergedObjectives : [{
      id: "obj-default",
      label: "Complete the session",
      predicate: { kind: "time_elapsed_gte", seconds: input.buildOptions.targetSessionSec * 0.8 },
      required: true,
      stepId: stepMachine[0]?.id ?? null,
    }],
    controls: mergedControls,

    telemetry: {
      events: mergedTelemetry.length > 0 ? mergedTelemetry : ["session_start", "session_end", "win", "lose"],
      metrics: ["time_to_first_action", "completion_rate", "loop_completion_time"],
    },

    assumptions: [
      ...mergedAssumptions,
      ...stepMachineResult.diagnostics.map((d) => `[${d.level}] ${d.code}: ${d.message}`),
    ],
  };

  // --------------------------------------------------------
  // Step 8: Validate IR schema
  // --------------------------------------------------------
  const schemaResult = safeValidatePrototypeIR(ir);
  if (!schemaResult.success) {
    return buildFailedResult(ir, inputHash, `IR schema validation failed: ${schemaResult.error.message}`);
  }

  // --------------------------------------------------------
  // Step 9: Run validation gates
  // --------------------------------------------------------
  const validation = validatePrototype(ir, {
    runSimulationGates: !options.skipSimulationGates,
    maxBotTicks: options.maxBotTicks,
  });

  const coverage = computeCoverageReport(ir);

  // Determine status.
  let status: PrototypeBuildResult["status"];
  if (coverage.unsupportedMechanicIds.length > 0) {
    status = "needs_mapping";
  } else if (validation.gatesFailed.length > 0) {
    status = "invalid";
  } else {
    status = "playable";
  }

  // --------------------------------------------------------
  // Step 10: Render HTML (2D and/or 3D, only if playable or needs_mapping)
  // --------------------------------------------------------
  const artifactId = `proto-${seed.substring(0, 12)}`;
  const builds: PrototypeBuildResult["builds"] = {};
  if (status === "playable" || status === "needs_mapping") {
    if (input.buildOptions.dimensions.includes("2d")) {
      try {
        builds["2d"] = { html: render2dHtml(ir, artifactId), rendererVersion: "2d-direct-2.0.0" };
      } catch (e) {
        return buildFailedResult(ir, inputHash, `2D renderer failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (input.buildOptions.dimensions.includes("3d")) {
      try {
        builds["3d"] = { html: render3dHtml(ir, artifactId), rendererVersion: "3d-three-2.0.0" };
      } catch (e) {
        return buildFailedResult(ir, inputHash, `3D renderer failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  // --------------------------------------------------------
  // Assemble result
  // --------------------------------------------------------
  const semanticHash = computeSemanticHash(ir);

  const artifact: PrototypeArtifactV2 = {
    artifactId,
    artifactType: "prototype_v2",
    envelopeVersion: 1,
    schemaVersion: IR_SCHEMA_VERSION,
    runtimeVersion: RUNTIME_VERSION,
    irSemanticHash: semanticHash,
    inputHash,
    status,
    createdAt: new Date().toISOString(),
  };

  return {
    status,
    ir,
    builds,
    coverage,
    validation,
    artifact,
  };
}

// ============================================================
// Helpers
// ============================================================

function deriveSuccessPredicate(
  input: PrototypeCompileInput,
  resources: ResourceSpec[],
): PrototypeIR["session"]["success"] {
  // If there's a core resource, success = collect enough of it.
  const coreResource = resources.find((r) => r.class === "core");
  if (coreResource) {
    return { kind: "resource_gte", resourceId: coreResource.id, value: 10 };
  }
  // Fallback: survive the session duration.
  return { kind: "time_elapsed_gte", seconds: input.buildOptions.targetSessionSec * 0.8 };
}

function deriveFailurePredicates(input: PrototypeCompileInput): PrototypeIR["session"]["failure"] {
  // Always include timeout.
  return [{ kind: "time_elapsed_gte", seconds: input.buildOptions.targetSessionSec }];
}

function fillRuleIds(bindings: MechanicBinding[], rules: RuleSpec[]): MechanicBinding[] {
  return bindings.map((b) => ({
    ...b,
    representedByRuleIds: rules
      .filter((r) => r.sourceMechanicId === b.sourceMechanicId)
      .map((r) => r.id),
  }));
}

function buildFailedResult(ir: PrototypeIR, inputHash: string, reason: string): PrototypeBuildResult {
  return {
    status: "build_failed",
    ir,
    builds: {},
    coverage: {
      mandatoryMechanics: { represented: 0, total: 0 },
      allMechanics: { represented: 0, total: 0 },
      representedStepIds: [],
      missingStepIds: [],
      unsupportedMechanicIds: [],
      assumptions: [reason],
    },
    validation: {
      gatesPassed: [],
      gatesFailed: [{ gateId: 0, reason }],
    },
    artifact: {
      artifactId: `failed-${inputHash.substring(0, 12)}`,
      artifactType: "prototype_v2",
      envelopeVersion: 1,
      schemaVersion: IR_SCHEMA_VERSION,
      runtimeVersion: RUNTIME_VERSION,
      irSemanticHash: computeSemanticHash(ir),
      inputHash,
      status: "build_failed",
      createdAt: new Date().toISOString(),
    },
  };
}
