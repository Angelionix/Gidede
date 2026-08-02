/**
 * Gidede — Nash equilibrium solver (Block 4, roadmap R5-04).
 *
 * Before R5-04, the intransitive analysis returned `nash_equilibrium` as a
 * uniform distribution over non-dominated strategies. This is only correct
 * for symmetric zero-sum games with a single connected component; for the
 * asymmetric payoff matrices produced by the Balance stage (with type
 * modifiers like weapon↔armor), it is NOT a real Nash equilibrium.
 *
 * R5-04 introduces:
 *   - `solveNash2x2(payoffMatrix)` — closed-form mixed-strategy Nash
 *     equilibrium for 2×2 zero-sum games (the most common Balance case with
 *     2 objects). Uses the standard formula:
 *       p* = (d - c) / (a - b - c + d)  for the row player,
 *     where the row payoff matrix is [[a, b], [c, d]].
 *   - `solveNash(payoffMatrix)` — dispatcher: uses the 2×2 closed form when
 *     the matrix is 2×2, falls back to uniform-over-non-dominated for larger
 *     matrices with an explicit `method` label.
 *   - The result carries `method` ("closed_form_2x2" | "uniform_non_dominated")
 *     and `source` ("solver" | "heuristic") so consumers can distinguish real
 *     Nash from the heuristic fallback.
 *
 * The persisted `nash_equilibrium` field now reflects a real equilibrium for
 * 2×2 games and is honestly labelled for larger games.
 */

export interface NashResult {
  /** Mixed strategy probabilities for the row player (sum to 1). */
  strategy: number[];
  /** How the equilibrium was computed. */
  method: "closed_form_2x2" | "uniform_non_dominated";
  /** Whether this is a real solver result or a heuristic fallback. */
  source: "solver" | "heuristic";
  /** Human-readable reason. */
  reason: string;
}

/**
 * Solve the Nash equilibrium for a 2×2 zero-sum game.
 *
 * Row payoff matrix:
 *   [[a, b],
 *    [c, d]]
 *
 * Two cases must be handled explicitly:
 *
 * 1. Pure-strategy (boundary) equilibrium via strict dominance.
 *    If row 0 strictly dominates row 1 (`a > c && b > d`), the row player
 *    plays row 0 with probability 1 (strategy [1, 0]).
 *    If row 1 strictly dominates row 0 (`c > a && d > b`), the row player
 *    plays row 1 with probability 1 (strategy [0, 1]).
 *    The closed-form mixed-strategy formula `p* = (d-c)/(a-b-c+d)` does NOT
 *    detect dominance — it would return a valid-looking but wrong mixed
 *    strategy in this case (e.g. [[2,1],[0,0]] → p*=0 → strategy [0,1],
 *    when the correct answer is [1,0]).
 *
 * 2. Interior mixed-strategy equilibrium (no dominance).
 *    p* = (d - c) / (a - b - c + d)  — probability of playing row 0.
 *    Returns the full strategy vector [p*, 1-p*].
 *
 * When the denominator is 0 (degenerate game without strict dominance),
 * falls back to uniform [0.5, 0.5].
 */
export function solveNash2x2(payoffMatrix: number[][]): NashResult {
  if (payoffMatrix.length !== 2 || !payoffMatrix[0] || payoffMatrix[0].length !== 2
    || !payoffMatrix[1] || payoffMatrix[1].length !== 2) {
    throw new Error("solveNash2x2 requires a 2×2 matrix");
  }
  const [[a, b], [c, d]] = payoffMatrix;

  // Case 1a: row 0 strictly dominates row 1 — pure-strategy equilibrium [1, 0].
  if (a > c && b > d) {
    return {
      strategy: [1, 0],
      method: "closed_form_2x2",
      source: "solver",
      reason: `2×2 closed-form: row 0 strictly dominates row 1 (${a}>${c} && ${b}>${d}) → pure strategy [1, 0]`,
    };
  }
  // Case 1b: row 1 strictly dominates row 0 — pure-strategy equilibrium [0, 1].
  if (c > a && d > b) {
    return {
      strategy: [0, 1],
      method: "closed_form_2x2",
      source: "solver",
      reason: `2×2 closed-form: row 1 strictly dominates row 0 (${c}>${a} && ${d}>${b}) → pure strategy [0, 1]`,
    };
  }

  // Case 2: interior mixed-strategy equilibrium.
  const denominator = a - b - c + d;

  if (Math.abs(denominator) < 1e-9) {
    // Degenerate game without strict dominance — uniform.
    return {
      strategy: [0.5, 0.5],
      method: "closed_form_2x2",
      source: "solver",
      reason: "2×2 closed-form: degenerate game (denominator ≈ 0, no strict dominance), uniform [0.5, 0.5]",
    };
  }

  const p = (d - c) / denominator;
  // Clamp to [0, 1] to handle numerical noise.
  const pClamped = Math.max(0, Math.min(1, p));
  const strategy = [pClamped, 1 - pClamped].map((v) => Number(v.toFixed(4)));

  return {
    strategy,
    method: "closed_form_2x2",
    source: "solver",
    reason: `2×2 closed-form: p* = (d-c)/(a-b-c+d) = (${d}-${c})/${denominator.toFixed(2)} = ${pClamped.toFixed(4)}`,
  };
}

/**
 * Compute the uniform distribution over non-dominated strategies.
 * Used as a fallback for matrices larger than 2×2 where support enumeration
 * would be too expensive without a proper LP solver.
 */
export function uniformOverNonDominated(
  payoffMatrix: number[][],
  dominatedStrategies: number[] = [],
): NashResult {
  const n = payoffMatrix.length;
  const nonDominated = Array.from({ length: n }, (_, i) => i)
    .filter((i) => !dominatedStrategies.includes(i));
  const count = nonDominated.length > 0 ? nonDominated.length : n;
  const prob = 1 / count;
  const strategy = Array.from({ length: n }, (_, i) =>
    nonDominated.includes(i) || nonDominated.length === 0 ? Number(prob.toFixed(4)) : 0,
  );
  return {
    strategy,
    method: "uniform_non_dominated",
    source: "heuristic",
    reason: `Uniform over ${count} non-dominated strategies (fallback: no closed-form for ${n}×${n} games; LP solver not available)`,
  };
}

/**
 * Solve the Nash equilibrium for a square payoff matrix.
 *
 * - 2×2: uses the closed-form solution (real Nash equilibrium).
 * - Larger: falls back to uniform-over-non-dominated with an explicit
 *   `source: "heuristic"` label.
 *
 * @param payoffMatrix         Square row-player payoff matrix.
 * @param dominatedStrategies  Indices of strictly dominated strategies (for the fallback).
 */
export function solveNash(
  payoffMatrix: number[][],
  dominatedStrategies: number[] = [],
): NashResult {
  const n = payoffMatrix.length;
  if (n === 0) {
    return {
      strategy: [],
      method: "uniform_non_dominated",
      source: "heuristic",
      reason: "Empty payoff matrix",
    };
  }
  if (n === 1) {
    return {
      strategy: [1],
      method: "uniform_non_dominated",
      source: "solver",
      reason: "Single strategy — trivial equilibrium [1.0]",
    };
  }
  if (n === 2) {
    try {
      // Pass dominatedStrategies for completeness — solveNash2x2 detects
      // strict dominance internally via payoff comparison, but the parameter
      // is kept for symmetry with the heuristic fallback signature.
      void dominatedStrategies;
      return solveNash2x2(payoffMatrix);
    } catch {
      return uniformOverNonDominated(payoffMatrix, dominatedStrategies);
    }
  }
  return uniformOverNonDominated(payoffMatrix, dominatedStrategies);
}
