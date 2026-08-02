/**
 * Predicate evaluator for PrototypeIR.
 *
 * Evaluates PredicateSpec against the runtime state (resources, steps,
 * loop count, elapsed time, entity counts). Used for:
 * - step activation/completion predicates
 * - session success/failure conditions
 * - objective satisfaction
 * - rule guards
 * - control binding context predicates
 *
 * Design spec: docs/PLAYABLE_PROTOTYPE_COMPILER_DESIGN.md (section 6, PredicateSpec)
 */

import type { PredicateSpec } from "../ir/types";
import type { RuntimeState } from "./state";

/**
 * Evaluate a predicate against the current runtime state.
 * Returns true if the predicate is satisfied.
 */
export function evaluatePredicate(
  predicate: PredicateSpec,
  state: RuntimeState,
): boolean {
  switch (predicate.kind) {
    case "resource_gte":
      return (state.resources.get(predicate.resourceId) ?? 0) >= predicate.value;

    case "resource_lte":
      return (state.resources.get(predicate.resourceId) ?? 0) <= predicate.value;

    case "step_completed":
      return state.completedSteps.has(predicate.stepId);

    case "loop_count_gte":
      return state.loopCount >= predicate.value;

    case "time_elapsed_gte":
      return state.elapsedSec >= predicate.seconds;

    case "entity_count_lte": {
      let count = 0;
      for (const e of state.entities.values()) {
        if (e.role === predicate.roleId) count++;
      }
      return count <= predicate.value;
    }

    case "and":
      return predicate.predicates.every((p) => evaluatePredicate(p, state));

    case "or":
      return predicate.predicates.some((p) => evaluatePredicate(p, state));

    case "not":
      return !evaluatePredicate(predicate.predicate, state);

    default:
      // Exhaustiveness check — if a new predicate kind is added, this
      // will surface at runtime.
      return false;
  }
}
