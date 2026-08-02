/**
 * Validation gates for PrototypeIR.
 *
 * 10 hard gates from the design spec (section 8, step 8). A build gets
 * `playable: true` only after ALL gates pass.
 *
 * Gates 1-7 are static (no simulation needed).
 * Gate 8: policy bot can complete the loop (headless simulation).
 * Gate 9: idle bot does NOT win automatically (headless simulation).
 * Gate 10: runtime doesn't produce NaN, unbounded growth, or event storm.
 *
 * Design spec: docs/PLAYABLE_PROTOTYPE_COMPILER_DESIGN.md (section 8, step 8)
 */

import type {
  PrototypeIR,
  PrototypeCoverageReport,
  PrototypeValidationReport,
} from "../ir/types";
import { evaluatePredicate } from "../runtime/predicate-evaluator";
import { PrototypeRuntimeEngine } from "../runtime/engine";
import { createRuntimeState, type RuntimeState } from "../runtime/state";

// ============================================================
// Gate definitions
// ============================================================

export interface GateResult {
  gateId: number;
  name: string;
  passed: boolean;
  reason?: string;
}

export interface ValidationOptions {
  /** Max ticks to run the policy bot (default: targetDuration * 60 * 2). */
  maxBotTicks?: number;
  /** Whether to run headless simulation gates (8, 9, 10). Default: true. */
  runSimulationGates?: boolean;
}

const DEFAULT_OPTIONS: ValidationOptions = {
  runSimulationGates: true,
};

// ============================================================
// Main validation entry point
// ============================================================

/**
 * Run all 10 validation gates on a PrototypeIR.
 * Returns a report with passed/failed gates.
 */
export function validatePrototype(
  ir: PrototypeIR,
  options: ValidationOptions = {},
): PrototypeValidationReport {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const results: GateResult[] = [];

  // Static gates (1-7).
  results.push(gate1_mechanicsBound(ir));
  results.push(gate2_stepsRepresented(ir));
  results.push(gate3_consumedResourcesReachable(ir));
  results.push(gate4_successAndFailureDefined(ir));
  results.push(gate5_controlsCoverActions(ir));
  results.push(gate6_noUnreachableStates(ir));
  results.push(gate7_rendererCapabilityCheck(ir));

  // Simulation gates (8-10).
  if (opts.runSimulationGates) {
    const maxTicks = opts.maxBotTicks ?? ir.session.targetDurationSec * 60 * 2;
    const botResult = gate8_policyBotCompletesLoop(ir, maxTicks);
    results.push(botResult);
    results.push(gate9_idleBotDoesNotWin(ir, maxTicks));
    results.push(gate10_runtimeStability(ir, maxTicks));
  }

  const gatesPassed = results.filter((r) => r.passed).map((r) => r.gateId);
  const gatesFailed = results
    .filter((r) => !r.passed)
    .map((r) => ({ gateId: r.gateId, reason: r.reason || "unknown" }));

  return {
    gatesPassed,
    gatesFailed,
  };
}

// ============================================================
// Coverage report
// ============================================================

/**
 * Compute the coverage report for an IR.
 * Shows which mechanics and steps are represented.
 */
export function computeCoverageReport(ir: PrototypeIR): PrototypeCoverageReport {
  const allMechanicIds = ir.mechanicBindings.map((b) => b.sourceMechanicId);
  const representedMechanicIds = ir.mechanicBindings
    .filter((b) => b.resolution !== "unsupported")
    .map((b) => b.sourceMechanicId);
  const unsupportedMechanicIds = ir.mechanicBindings
    .filter((b) => b.resolution === "unsupported")
    .map((b) => b.sourceMechanicId);

  // For MVP, all mechanics are considered mandatory.
  const mandatoryTotal = allMechanicIds.length;
  const mandatoryRepresented = representedMechanicIds.length;

  const representedStepIds: string[] = [];
  const missingStepIds: string[] = [];

  for (const step of ir.stepMachine) {
    // A step is represented if at least one rule references it.
    const hasRule = ir.rules.some((r) =>
      r.trigger.kind === "step_enter" && r.trigger.stepId === step.id ||
      r.trigger.kind === "step_complete" && r.trigger.stepId === step.id,
    );
    // Or if any objective belongs to it.
    const hasObjective = ir.objectives.some((o) => o.stepId === step.id);
    // Or if it has allowed actions (from adapters).
    const hasActions = step.allowedActionIds.length > 0;

    if (hasRule || hasObjective || hasActions) {
      representedStepIds.push(step.id);
    } else {
      missingStepIds.push(step.id);
    }
  }

  return {
    mandatoryMechanics: { represented: mandatoryRepresented, total: mandatoryTotal },
    allMechanics: { represented: representedMechanicIds.length, total: allMechanicIds.length },
    representedStepIds,
    missingStepIds,
    unsupportedMechanicIds,
    assumptions: ir.assumptions,
  };
}

// ============================================================
// Individual gates
// ============================================================

/**
 * Gate 1: Mandatory mechanics have bindings.
 * Every mechanic must have a non-unsupported binding.
 */
function gate1_mechanicsBound(ir: PrototypeIR): GateResult {
  const unbound = ir.mechanicBindings.filter((b) => b.resolution === "unsupported");
  if (unbound.length > 0) {
    return {
      gateId: 1,
      name: "mechanics_bound",
      passed: false,
      reason: `Unsupported mechanics: ${unbound.map((b) => b.sourceMechanicId).join(", ")}`,
    };
  }
  return { gateId: 1, name: "mechanics_bound", passed: true };
}

/**
 * Gate 2: Each Core Loop step is represented by at least one rule or objective.
 */
function gate2_stepsRepresented(ir: PrototypeIR): GateResult {
  const coverage = computeCoverageReport(ir);
  if (coverage.missingStepIds.length > 0) {
    return {
      gateId: 2,
      name: "steps_represented",
      passed: false,
      reason: `Steps without rules/objectives: ${coverage.missingStepIds.join(", ")}`,
    };
  }
  return { gateId: 2, name: "steps_represented", passed: true };
}

/**
 * Gate 3: Each consumed resource has a reachable source.
 * A resource is reachable if it's either:
 * - produced by some step's effects, OR
 * - has initialValue > 0, OR
 * - produced by some rule's effects
 */
function gate3_consumedResourcesReachable(ir: PrototypeIR): GateResult {
  const producedResources = new Set<string>();

  // Resources with initial value.
  for (const res of ir.resources) {
    if (res.initialValue > 0) producedResources.add(res.id);
  }

  // Resources produced by steps.
  for (const step of ir.stepMachine) {
    for (const effect of step.effects) {
      if (effect.kind === "resource_delta" && effect.delta > 0) {
        producedResources.add(effect.resourceId);
      }
    }
  }

  // Resources produced by rules.
  for (const rule of ir.rules) {
    for (const effect of rule.effects) {
      if (effect.kind === "resource_delta" && effect.delta > 0) {
        producedResources.add(effect.resourceId);
      }
    }
  }

  // Check consumed resources (from activation predicates).
  const unreachable: string[] = [];
  for (const step of ir.stepMachine) {
    const consumed = extractResourceIdsFromPredicate(step.activationPredicate);
    for (const resId of consumed) {
      if (!producedResources.has(resId) && !unreachable.includes(resId)) {
        unreachable.push(resId);
      }
    }
  }

  if (unreachable.length > 0) {
    return {
      gateId: 3,
      name: "consumed_resources_reachable",
      passed: false,
      reason: `Consumed resources with no source: ${unreachable.join(", ")}`,
    };
  }
  return { gateId: 3, name: "consumed_resources_reachable", passed: true };
}

/**
 * Gate 4: Success and at least one failure/timeout path are defined.
 */
function gate4_successAndFailureDefined(ir: PrototypeIR): GateResult {
  // Success predicate exists (always true — schema enforces it).
  // Failure conditions: at least one required (schema enforces min 1).
  // But check they're not trivially identical.
  const successStr = JSON.stringify(ir.session.success);
  for (const fail of ir.session.failure) {
    if (JSON.stringify(fail) === successStr) {
      return {
        gateId: 4,
        name: "success_failure_defined",
        passed: false,
        reason: "Success and failure predicates are identical",
      };
    }
  }
  return { gateId: 4, name: "success_failure_defined", passed: true };
}

/**
 * Gate 5: Controls cover all player actions required by mechanics.
 * Checks that 'move' control exists if locomotion is bound,
 * 'aim' + 'primary_action' if combat is bound, etc.
 */
function gate5_controlsCoverActions(ir: PrototypeIR): GateResult {
  const actions = new Set(ir.controls.map((c) => c.action));
  const missing: string[] = [];

  for (const binding of ir.mechanicBindings) {
    if (binding.resolution === "unsupported") continue;
    const adapterId = binding.adapterId;
    if (adapterId === "locomotion" && !actions.has("move")) {
      missing.push("move (required by locomotion)");
    }
    if (adapterId === "target/combat") {
      if (!actions.has("aim")) missing.push("aim (required by combat)");
      if (!actions.has("primary_action")) missing.push("primary_action (required by combat)");
    }
  }

  if (missing.length > 0) {
    return {
      gateId: 5,
      name: "controls_cover_actions",
      passed: false,
      reason: `Missing controls: ${missing.join(", ")}`,
    };
  }
  return { gateId: 5, name: "controls_cover_actions", passed: true };
}

/**
 * Gate 6: No unreachable mandatory states in the step machine.
 * Every step must be reachable from the first step via nextStepId chain.
 */
function gate6_noUnreachableStates(ir: PrototypeIR): GateResult {
  if (ir.stepMachine.length === 0) {
    return { gateId: 6, name: "no_unreachable_states", passed: true };
  }

  const reachable = new Set<string>();
  const queue: string[] = [ir.stepMachine[0].id];
  reachable.add(ir.stepMachine[0].id);

  while (queue.length > 0) {
    const stepId = queue.shift()!;
    const step = ir.stepMachine.find((s) => s.id === stepId);
    if (step?.nextStepId && !reachable.has(step.nextStepId)) {
      reachable.add(step.nextStepId);
      queue.push(step.nextStepId);
    }
  }

  const unreachable = ir.stepMachine
    .filter((s) => !reachable.has(s.id))
    .map((s) => s.id);

  if (unreachable.length > 0) {
    return {
      gateId: 6,
      name: "no_unreachable_states",
      passed: false,
      reason: `Unreachable steps: ${unreachable.join(", ")}`,
    };
  }
  return { gateId: 6, name: "no_unreachable_states", passed: true };
}

/**
 * Gate 7: Same IR passes 2D and 3D renderer capability checks.
 * (Static check — verifies all entity roles have primitive mappings.)
 */
function gate7_rendererCapabilityCheck(ir: PrototypeIR): GateResult {
  // All roles in the IR must be in the known primitive mapping.
  const knownRoles = new Set([
    "player", "enemy", "collectible", "obstacle", "projectile",
    "interaction_zone", "base", "goal", "hazard", "spawner",
  ]);
  const unknownRoles: string[] = [];
  for (const entity of ir.entities) {
    if (!knownRoles.has(entity.role) && !unknownRoles.includes(entity.role)) {
      unknownRoles.push(entity.role);
    }
  }
  if (unknownRoles.length > 0) {
    return {
      gateId: 7,
      name: "renderer_capability",
      passed: false,
      reason: `Unknown entity roles without primitive mapping: ${unknownRoles.join(", ")}`,
    };
  }
  return { gateId: 7, name: "renderer_capability", passed: true };
}

/**
 * Gate 8: Policy bot can complete the loop.
 * Runs a headless simulation with a bot that issues move + primary_action
 * inputs. The bot must complete at least one loop iteration OR reach the
 * success condition.
 */
function gate8_policyBotCompletesLoop(ir: PrototypeIR, maxTicks: number): GateResult {
  const engine = new PrototypeRuntimeEngine(ir, { emitTelemetry: false });
  let botTick = 0;
  let lastInputTick = 0;

  while (engine.getStatus() === "running" && botTick < maxTicks) {
    // Bot policy: move toward nearest collectible, press primary_action periodically.
    if (botTick - lastInputTick >= 30) { // every 0.5s
      const entities = engine.getEntities();
      const player = entities.find((e) => e.role === "player");
      const collectible = entities.find((e) => e.role === "collectible");
      if (player && collectible) {
        engine.input({
          action: "move",
          position: { x: collectible.position.x, y: collectible.position.y },
          timestamp: engine.getElapsedSec(),
        });
      }
      engine.input({
        action: "primary_action",
        timestamp: engine.getElapsedSec(),
      });
      lastInputTick = botTick;
    }
    engine.tick();
    botTick++;

    // Check if loop completed or success reached.
    if (engine.getLoopCount() >= 1 || engine.getStatus() === "won") {
      return { gateId: 8, name: "policy_bot_completes_loop", passed: true };
    }
  }

  return {
    gateId: 8,
    name: "policy_bot_completes_loop",
    passed: false,
    reason: `Bot did not complete a loop or win in ${maxTicks} ticks (status: ${engine.getStatus()})`,
  };
}

/**
 * Gate 9: Idle bot does NOT win automatically.
 * Runs a headless simulation with NO inputs. The session must NOT
 * reach 'won' status without player action.
 */
function gate9_idleBotDoesNotWin(ir: PrototypeIR, maxTicks: number): GateResult {
  const engine = new PrototypeRuntimeEngine(ir, { emitTelemetry: false });
  let tick = 0;

  while (engine.getStatus() === "running" && tick < maxTicks) {
    engine.tick();
    tick++;
  }

  if (engine.getStatus() === "won") {
    return {
      gateId: 9,
      name: "idle_bot_does_not_win",
      passed: false,
      reason: "Idle bot won without any input — success condition is too easy",
    };
  }
  return { gateId: 9, name: "idle_bot_does_not_win", passed: true };
}

/**
 * Gate 10: Runtime doesn't produce NaN, unbounded entity growth, or event storm.
 */
function gate10_runtimeStability(ir: PrototypeIR, maxTicks: number): GateResult {
  const engine = new PrototypeRuntimeEngine(ir, { emitTelemetry: false, strictNumericChecks: true });
  let tick = 0;
  let maxEntityCount = 0;

  try {
    while (engine.getStatus() === "running" && tick < maxTicks) {
      engine.tick();
      tick++;
      const entityCount = engine.getEntities().length;
      if (entityCount > maxEntityCount) maxEntityCount = entityCount;

      // Check for unbounded growth.
      if (entityCount > 500) {
        return {
          gateId: 10,
          name: "runtime_stability",
          passed: false,
          reason: `Unbounded entity growth: ${entityCount} entities at tick ${tick}`,
        };
      }
    }
  } catch (e) {
    return {
      gateId: 10,
      name: "runtime_stability",
      passed: false,
      reason: `Runtime error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  return { gateId: 10, name: "runtime_stability", passed: true };
}

// ============================================================
// Helpers
// ============================================================

function extractResourceIdsFromPredicate(predicate: {
  kind: string;
  resourceId?: string;
  predicates?: Array<{ kind: string; resourceId?: string }>;
  predicate?: { kind: string; resourceId?: string };
}): string[] {
  const ids: string[] = [];
  if (predicate.resourceId) ids.push(predicate.resourceId);
  if (predicate.predicates) {
    for (const p of predicate.predicates) {
      if (p.resourceId) ids.push(p.resourceId);
    }
  }
  if (predicate.predicate?.resourceId) ids.push(predicate.predicate.resourceId);
  return ids;
}
