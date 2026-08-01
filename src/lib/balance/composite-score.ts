/**
 * Gidede — Composite balance score (Block 4, roadmap R5-08).
 *
 * Before R5-08, `overallBalanceScore = stability.overall_stability` — a single
 * Machinations-derived metric that IGNORED transitive OP/UP imbalance,
 * intransitive dominance, and Monte Carlo verdict. A game with massive
 * transitive imbalance but stable Machinations decay curves scored "balanced".
 *
 * R5-08 introduces `computeCompositeBalanceScore(inputs)`:
 *   - Starts from Machinations stability (0-1).
 *   - Penalises transitive OP/UP count (overpowered + underpowered objects).
 *   - Penalises intransitive dominance (has_dominant_strategy + dominated count).
 *   - Penalises Monte Carlo verdict (POOR > MODERATE > GOOD).
 *   - Hard gate: if any critical issue exists, score is capped at 0.3.
 *   - Returns the composite score + per-factor breakdown for transparency.
 */

export interface CompositeScoreInputs {
  /** Machinations stability index (0-1). */
  stabilityIndex: number;
  /** Transitive overpowered object count. */
  overpoweredCount: number;
  /** Transitive underpowered object count. */
  underpoweredCount: number;
  /** Total objects analysed (for normalising OP/UP to a fraction). */
  totalObjects: number;
  /** Whether intransitive analysis found a dominant strategy. */
  hasDominantStrategy: boolean;
  /** Number of dominated strategies. */
  dominatedStrategyCount: number;
  /** Monte Carlo verdict: "GOOD" | "MODERATE" | "POOR". */
  monteCarloVerdict: "GOOD" | "MODERATE" | "POOR";
  /** Critical issues from Machinations (runaway/stall frequency above threshold). */
  criticalIssueCount: number;
}

export interface CompositeScoreFactor {
  name: string;
  contribution: number;
  reason: string;
}

export interface CompositeScoreResult {
  /** Composite balance score in [0, 1]. */
  score: number;
  /** Per-factor breakdown. */
  factors: CompositeScoreFactor[];
  /** Whether the hard gate (critical issues) was triggered. */
  hard_gate_triggered: boolean;
  /** Human-readable reason. */
  reason: string;
}

/**
 * Compute a composite balance score from multiple sub-analyses.
 *
 * Formula:
 *   score = stability
 *     - 0.10 * (overpowered_fraction + underpowered_fraction)   [transitive]
 *     - 0.15 if has_dominant_strategy                             [intransitive]
 *     - 0.05 * (dominated_fraction)                               [intransitive]
 *     - 0.00 if GOOD, 0.10 if MODERATE, 0.20 if POOR             [Monte Carlo]
 *   then clamp to [0, 1].
 *
 * Hard gate: if criticalIssueCount > 0, score is capped at 0.3 (cannot be
 * "balanced" when critical issues exist, regardless of stability).
 */
export function computeCompositeBalanceScore(inputs: CompositeScoreInputs): CompositeScoreResult {
  const factors: CompositeScoreFactor[] = [];
  let score = inputs.stabilityIndex;

  factors.push({
    name: "stability",
    contribution: inputs.stabilityIndex,
    reason: `Machinations stability index: ${inputs.stabilityIndex.toFixed(3)}`,
  });

  // Transitive OP/UP penalty.
  const total = Math.max(1, inputs.totalObjects);
  const opFraction = inputs.overpoweredCount / total;
  const upFraction = inputs.underpoweredCount / total;
  const transitivePenalty = 0.10 * (opFraction + upFraction);
  score -= transitivePenalty;
  factors.push({
    name: "transitive_imbalance",
    contribution: -transitivePenalty,
    reason: `${inputs.overpoweredCount} OP + ${inputs.underpoweredCount} UP of ${inputs.totalObjects} → -${transitivePenalty.toFixed(3)}`,
  });

  // Intransitive dominance penalty.
  let intransitivePenalty = 0;
  if (inputs.hasDominantStrategy) {
    intransitivePenalty += 0.15;
  }
  const dominatedFraction = inputs.dominatedStrategyCount / total;
  intransitivePenalty += 0.05 * dominatedFraction;
  score -= intransitivePenalty;
  factors.push({
    name: "intransitive_dominance",
    contribution: -intransitivePenalty,
    reason: inputs.hasDominantStrategy
      ? `dominant strategy + ${inputs.dominatedStrategyCount} dominated → -${intransitivePenalty.toFixed(3)}`
      : `${inputs.dominatedStrategyCount} dominated → -${intransitivePenalty.toFixed(3)}`,
  });

  // Monte Carlo verdict penalty.
  const mcPenalty = inputs.monteCarloVerdict === "POOR" ? 0.20
    : inputs.monteCarloVerdict === "MODERATE" ? 0.10
    : 0;
  score -= mcPenalty;
  factors.push({
    name: "monte_carlo_verdict",
    contribution: -mcPenalty,
    reason: `MC verdict "${inputs.monteCarloVerdict}" → -${mcPenalty.toFixed(3)}`,
  });

  // Hard gate: critical issues cap the score.
  const hardGate = inputs.criticalIssueCount > 0;
  if (hardGate) {
    score = Math.min(score, 0.3);
  }

  // Clamp to [0, 1].
  score = Math.max(0, Math.min(1, score));

  const reason = hardGate
    ? `Composite score capped at 0.3 due to ${inputs.criticalIssueCount} critical issue(s)`
    : `Composite score from stability ${inputs.stabilityIndex.toFixed(2)} - transitive ${transitivePenalty.toFixed(3)} - intransitive ${intransitivePenalty.toFixed(3)} - MC ${mcPenalty.toFixed(3)}`;

  return {
    score: Number(score.toFixed(3)),
    factors,
    hard_gate_triggered: hardGate,
    reason,
  };
}
