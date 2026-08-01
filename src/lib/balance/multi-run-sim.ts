/**
 * Gidede — Multi-run simulation with confidence intervals (Block 4, R5-09).
 *
 * Before R5-09, the Machinations simulation claimed `runs: 10` but executed
 * only 1 pass per object. The Monte Carlo ran 200 iterations but reported
 * only point estimates (no uncertainty bounds).
 *
 * R5-09 introduces:
 *   - `runMultiRunSimulation(simFn, nRuns, baseSeed)` — runs N independent
 *     seeded simulation passes and aggregates mean, std, and confidence
 *     interval for each metric.
 *   - `computeConfidenceInterval(values, confidence)` — Student-t-style
 *     interval for small samples (falls back to normal approximation for
 *     large samples).
 *   - `aggregateRuns(runs)` — reduces an array of per-run metric records
 *     into a single aggregated record with mean/std/ci_lower/ci_upper per
 *     metric.
 *
 * The Machinations simulation now actually runs N passes (default 10) with
 * different seeds derived from the base seed, and the Monte Carlo result
 * gains confidence intervals on win_rates.
 */

/**
 * Compute the mean of an array of numbers.
 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Compute the sample standard deviation (Bessel-corrected, n-1 denominator).
 * Returns 0 for samples of length < 2.
 */
export function std(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const sumSq = values.reduce((s, v) => s + (v - m) ** 2, 0);
  return Math.sqrt(sumSq / (values.length - 1));
}

/**
 * Compute a confidence interval for a sample of values.
 *
 * Uses the normal approximation (z-score) for large samples (n >= 30) and
 * a conservative t-like multiplier for small samples. The `confidence`
 * parameter is in [0, 1] (e.g. 0.95 for 95% CI).
 *
 * Returns { mean, std, ci_lower, ci_upper, n }.
 */
export interface ConfidenceInterval {
  mean: number;
  std: number;
  n: number;
  ci_lower: number;
  ci_upper: number;
  confidence: number;
}

export function computeConfidenceInterval(
  values: number[],
  confidence = 0.95,
): ConfidenceInterval {
  const n = values.length;
  const m = mean(values);
  const s = std(values);

  if (n === 0) {
    return { mean: 0, std: 0, n: 0, ci_lower: 0, ci_upper: 0, confidence };
  }
  if (n === 1) {
    // Single sample — no degrees of freedom for std; CI is the point itself.
    return { mean: m, std: 0, n: 1, ci_lower: m, ci_upper: m, confidence };
  }

  // z-score for common confidence levels (normal approximation).
  // For n < 30, use a conservative multiplier (t-distribution with n-1 df
  // is wider; we approximate with z * 1.3 for small samples to be safe).
  const zScores: Record<number, number> = {
    0.90: 1.645,
    0.95: 1.96,
    0.99: 2.576,
  };
  const z = zScores[confidence] ?? 1.96;
  const multiplier = n < 30 ? z * 1.3 : z; // conservative for small samples
  const margin = (multiplier * s) / Math.sqrt(n);

  return {
    mean: Number(m.toFixed(4)),
    std: Number(s.toFixed(4)),
    n,
    ci_lower: Number((m - margin).toFixed(4)),
    ci_upper: Number((m + margin).toFixed(4)),
    confidence,
  };
}

/**
 * Run N independent simulation passes with different seeds.
 *
 * @param simFn     A function (runIndex, seed) => Record<string, number>
 *                  that performs one simulation pass and returns the metrics.
 * @param nRuns     Number of independent runs (default 10).
 * @param baseSeed  The base seed; each run gets `baseSeed + runIndex`.
 * @returns Array of per-run metric records (length nRuns).
 */
export function runMultiRunSimulation(
  simFn: (runIndex: number, seed: number) => Record<string, number>,
  nRuns: number,
  baseSeed: number,
): Record<string, number>[] {
  const runs: Record<string, number>[] = [];
  for (let r = 0; r < nRuns; r++) {
    runs.push(simFn(r, baseSeed + r * 0x9E3779B9));
  }
  return runs;
}

/**
 * Aggregate an array of per-run metric records into a single record of
 * ConfidenceInterval, one per metric key.
 *
 * @param runs       Array of per-run metric records (from runMultiRunSimulation).
 * @param confidence Confidence level for the intervals (default 0.95).
 * @returns Record<string, ConfidenceInterval> keyed by metric name.
 */
export function aggregateRuns(
  runs: Record<string, number>[],
  confidence = 0.95,
): Record<string, ConfidenceInterval> {
  if (runs.length === 0) return {};

  // Collect all metric keys.
  const keys = new Set<string>();
  for (const run of runs) {
    for (const k of Object.keys(run)) keys.add(k);
  }

  const aggregated: Record<string, ConfidenceInterval> = {};
  for (const key of keys) {
    const values = runs
      .map((r) => r[key])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    aggregated[key] = computeConfidenceInterval(values, confidence);
  }
  return aggregated;
}
