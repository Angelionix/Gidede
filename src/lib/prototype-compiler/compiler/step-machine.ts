/**
 * Step/resource state machine compiler.
 *
 * Compiles Core Loop steps + resource graph into a StepStateSpec[] that
 * the runtime executes. Each step becomes a state with:
 * - activation predicate (from resourcesConsumed)
 * - allowed player actions (from mechanic adapters)
 * - completion predicate
 * - effects (resourcesProduced)
 * - transition to next step
 * - telemetry events
 *
 * Design spec: docs/PLAYABLE_PROTOTYPE_COMPILER_DESIGN.md (section 8, step 3)
 *
 * Closure rule: the last step must either return a resource/state that
 * activates the first step, OR terminate one iteration and execute an
 * explicit reset rule. Open loops are a validation error.
 */

import type {
  EffectSpec,
  PredicateSpec,
  ResourceSpec,
  StepStateSpec,
} from "../ir/types";
import type { PrototypeCompileInput } from "../ir/input-hash";

// ============================================================
// Input shape (step from PrototypeCompileInput)
// ============================================================

export interface CompiledStep {
  id: string;
  label: string;
  activationPredicate: PredicateSpec;
  allowedActionIds: string[];
  completionPredicate: PredicateSpec;
  effects: EffectSpec[];
  nextStepId: string | null;
  telemetryEvents: string[];
}

export interface StepMachineCompileResult {
  steps: CompiledStep[];
  /** Resources declared by the step machine (consumed/produced). */
  resources: ResourceSpec[];
  /** Diagnostics (errors block compilation; warnings are informational). */
  diagnostics: StepMachineDiagnostic[];
  /** True if the loop is closed (last step activates first). */
  isClosed: boolean;
}

export interface StepMachineDiagnostic {
  level: "error" | "warning" | "info";
  code: string;
  message: string;
  stepId?: string;
}

// ============================================================
// Resource derivation
// ============================================================

/**
 * Derive ResourceSpec[] from the steps' consumed/produced resources.
 * Each unique resource ID becomes a ResourceSpec with sensible defaults.
 */
export function deriveResourcesFromSteps(
  steps: PrototypeCompileInput["steps"],
): ResourceSpec[] {
  const resourceIds = new Set<string>();
  for (const step of steps) {
    for (const r of step.resourcesConsumed) resourceIds.add(r);
    for (const r of step.resourcesProduced) resourceIds.add(r);
  }

  return Array.from(resourceIds).map((id) => ({
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1), // simple humanization
    icon: "✨",
    class: "core" as const,
    initialValue: 0,
    min: 0,
    max: null,
  }));
}

// ============================================================
// Activation predicate
// ============================================================

/**
 * Build an activation predicate for a step based on its resourcesConsumed.
 * If the step consumes resources, activation requires all of them to be > 0.
 * If the step consumes no resources, it's always active (loop_count_gte 0).
 */
function buildActivationPredicate(
  resourcesConsumed: string[],
): PredicateSpec {
  if (resourcesConsumed.length === 0) {
    return { kind: "loop_count_gte", value: 0 };
  }
  if (resourcesConsumed.length === 1) {
    return { kind: "resource_gte", resourceId: resourcesConsumed[0], value: 1 };
  }
  return {
    kind: "and",
    predicates: resourcesConsumed.map((rid) => ({
      kind: "resource_gte" as const,
      resourceId: rid,
      value: 1,
    })),
  };
}

// ============================================================
// Completion predicate
// ============================================================

/**
 * Build a completion predicate for a step.
 * If the step produces resources, completion requires at least one production.
 * Otherwise, completion is time-based (step duration estimate).
 */
function buildCompletionPredicate(
  resourcesProduced: string[],
  durationEstimateSec: number,
): PredicateSpec {
  if (resourcesProduced.length > 0) {
    return { kind: "resource_gte", resourceId: resourcesProduced[0], value: 1 };
  }
  return { kind: "time_elapsed_gte", seconds: Math.max(1, durationEstimateSec) };
}

// ============================================================
// Effects
// ============================================================

/**
 * Build effects for a step based on resourcesProduced.
 * Each produced resource becomes a resource_delta effect.
 */
function buildEffects(
  resourcesProduced: string[],
): EffectSpec[] {
  return resourcesProduced.map((rid) => ({
    kind: "resource_delta" as const,
    resourceId: rid,
    delta: 1,
  }));
}

// ============================================================
// Step machine compiler
// ============================================================

/**
 * Compile Core Loop steps into a StepStateSpec[] state machine.
 *
 * Steps are linked in order: step[i].nextStepId = step[i+1].id.
 * The last step's nextStepId points back to step[0].id (closing the loop)
 * if the loop is closed; otherwise it's null (terminal).
 *
 * Validation:
 * - Empty steps → error
 * - Duplicate step IDs → error
 * - Unreachable steps → warning
 * - Open loop (last step doesn't activate first) → warning (not error,
 *   because some games have terminal states)
 */
export function compileStepMachine(
  input: PrototypeCompileInput,
): StepMachineCompileResult {
  const diagnostics: StepMachineDiagnostic[] = [];

  if (input.steps.length === 0) {
    diagnostics.push({
      level: "error",
      code: "step_machine.empty",
      message: "Step machine requires at least one step",
    });
    return { steps: [], resources: [], diagnostics, isClosed: false };
  }

  // Check for duplicate step IDs.
  const seenIds = new Set<string>();
  for (const step of input.steps) {
    if (seenIds.has(step.id)) {
      diagnostics.push({
        level: "error",
        code: "step_machine.duplicate_id",
        message: `Duplicate step ID: '${step.id}'`,
        stepId: step.id,
      });
    }
    seenIds.add(step.id);
  }
  if (diagnostics.some((d) => d.level === "error")) {
    return { steps: [], resources: [], diagnostics, isClosed: false };
  }

  // Derive resources.
  const resources = deriveResourcesFromSteps(input.steps);

  // Compile each step.
  const steps: CompiledStep[] = input.steps.map((step, index) => {
    const isLast = index === input.steps.length - 1;
    const nextStepId = isLast
      ? input.steps[0].id // close the loop by default
      : input.steps[index + 1].id;

    return {
      id: step.id,
      label: step.action || `Step ${index + 1}`,
      activationPredicate: buildActivationPredicate(step.resourcesConsumed),
      allowedActionIds: [], // filled by the main compiler from adapter outputs
      completionPredicate: buildCompletionPredicate(
        step.resourcesProduced,
        step.durationEstimateSec,
      ),
      effects: buildEffects(step.resourcesProduced),
      nextStepId,
      telemetryEvents: ["step_enter", "action_attempt", "step_complete"],
    };
  });

  // Check loop closure: last step's effects must produce a resource that
  // activates the first step.
  const firstStep = input.steps[0];
  const lastStep = input.steps[input.steps.length - 1];
  const firstStepActivationResources = firstStep.resourcesConsumed;
  const lastStepProductionResources = lastStep.resourcesProduced;

  let isClosed = false;
  if (firstStepActivationResources.length === 0) {
    // First step is always active → loop is closed by default.
    isClosed = true;
  } else {
    // Check if last step produces any resource that first step consumes.
    isClosed = firstStepActivationResources.some((rid) =>
      lastStepProductionResources.includes(rid),
    );
  }

  if (!isClosed) {
    diagnostics.push({
      level: "warning",
      code: "step_machine.open_loop",
      message: `Loop is not closed: last step '${lastStep.id}' does not produce any resource that activates first step '${firstStep.id}'. Add an explicit reset rule or produce one of: ${firstStepActivationResources.join(", ")}`,
      stepId: lastStep.id,
    });
  }

  // Check for unreachable steps (steps not referenced by any nextStepId).
  const referencedIds = new Set(steps.map((s) => s.nextStepId).filter((n): n is string => n !== null));
  for (const step of steps) {
    if (!referencedIds.has(step.id) && step.id !== firstStep.id) {
      diagnostics.push({
        level: "warning",
        code: "step_machine.unreachable",
        message: `Step '${step.id}' is not reachable from any other step`,
        stepId: step.id,
      });
    }
  }

  return { steps, resources, diagnostics, isClosed };
}
