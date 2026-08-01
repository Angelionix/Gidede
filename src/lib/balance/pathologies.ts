/**
 * Gidede — Balance pathologies detection (Block 4, TASK-4.9).
 *
 * Bible 5.13: 8 balance pathologies:
 *   1. Dominant Strategy — one strategy strictly better than all others
 *   2. Runaway — positive feedback loop without brake → snowball
 *   3. Dead Zone — strategies that are never viable
 *   4. Mandatory Choice — one strategy so essential it's mandatory
 *   5. Build Gap — minmaxer vs casual gap too large
 *   6. Inflation — resource devaluation over time
 *   7. Economy Fragility — single-point-of-failure in economy
 *   8. Perceived Unfairness — player perception of imbalance (subjective metric)
 *
 * Before: only 3 generic pathologies (Runaway accumulation, Stall/stagnation, Build gap too large).
 * After: all 8 Bible pathologies with specific detection logic.
 */

export interface BalancePathology {
  name: string;
  type: string;
  severity: "critical" | "warning" | "info";
  description: string;
  correction: string;
  bible_ref: string;
}

export interface PathologyDetectionInput {
  transitiveOverpowered: string[];
  transitiveUnderpowered: string[];
  dominatedStrategies: string[];
  hasDominantStrategy: boolean;
  nashEquilibrium: number[];
  maxShare: number;
  runawayFrequency: number;
  stallFrequency: number;
  buildGap: number;
  stabilityIndex: number;
  winRateSpread: number;
  rankingCorrelation: number;
}

/**
 * Detect all 8 Bible 5.13 balance pathologies.
 */
export function detectBalancePathologies(input: PathologyDetectionInput): BalancePathology[] {
  const pathologies: BalancePathology[] = [];

  // 1. Dominant Strategy (5.13.1)
  if (input.hasDominantStrategy && input.dominatedStrategies.length > 0) {
    pathologies.push({
      name: "Dominant Strategy",
      type: "dominant_strategy",
      severity: "critical",
      description: `${input.dominatedStrategies.length} dominated strategies: ${input.dominatedStrategies.join(", ")} — one path is strictly better`,
      correction: "Rebalance dominated objects to break the dominant path; introduce trade-offs",
      bible_ref: "Bible 5.13.1",
    });
  }

  // 2. Runaway (5.13.2)
  if (input.runawayFrequency > 0.3) {
    pathologies.push({
      name: "Runaway",
      type: "runaway",
      severity: input.runawayFrequency > 0.5 ? "critical" : "warning",
      description: `Runaway frequency ${(input.runawayFrequency * 100).toFixed(0)}% — positive feedback loops cause snowballing`,
      correction: "Add balancing sinks to drain excess resources; introduce catch-up mechanics",
      bible_ref: "Bible 5.13.2",
    });
  }

  // 3. Dead Zone (5.13.3)
  if (input.transitiveUnderpowered.length > 0) {
    pathologies.push({
      name: "Dead Zone",
      type: "dead_zone",
      severity: "warning",
      description: `${input.transitiveUnderpowered.length} objects underpowered: ${input.transitiveUnderpowered.join(", ")} — never viable`,
      correction: "Boost underpowered objects' power or reduce their cost to make them situational picks",
      bible_ref: "Bible 5.13.3",
    });
  }

  // 4. Mandatory Choice (5.13.4)
  if (input.maxShare > 0.5) {
    pathologies.push({
      name: "Mandatory Choice",
      type: "mandatory_choice",
      severity: "warning",
      description: `Nash equilibrium max share ${(input.maxShare * 100).toFixed(0)}% — one strategy is mandatory`,
      correction: "Diversify strategies; reduce the dominant strategy's power or add counters",
      bible_ref: "Bible 5.13.4",
    });
  }

  // 5. Build Gap (5.13.5)
  if (input.buildGap > 0.25) {
    pathologies.push({
      name: "Build Gap",
      type: "build_gap",
      severity: input.buildGap > 0.4 ? "critical" : "warning",
      description: `Build gap ${input.buildGap.toFixed(2)} — minmaxer vs casual gap too large`,
      correction: "Reduce build gap by tuning minmaxer vs casual paths; add diminishing returns",
      bible_ref: "Bible 5.13.5",
    });
  }

  // 6. Inflation (5.13.6) — derived from stability index
  if (input.stabilityIndex < 0.4) {
    pathologies.push({
      name: "Inflation",
      type: "inflation",
      severity: "warning",
      description: `Stability index ${input.stabilityIndex.toFixed(2)} — resource devaluation over time`,
      correction: "Add resource sinks; implement diminishing returns on accumulation",
      bible_ref: "Bible 5.13.6",
    });
  }

  // 7. Economy Fragility (5.13.7)
  if (input.stallFrequency > 0.3) {
    pathologies.push({
      name: "Economy Fragility",
      type: "economy_fragility",
      severity: "warning",
      description: `Stall frequency ${(input.stallFrequency * 100).toFixed(0)}% — single-point-of-failure in economy`,
      correction: "Add redundant resource paths; ensure every pool has both faucet and drain",
      bible_ref: "Bible 5.13.7",
    });
  }

  // 8. Perceived Unfairness (5.13.8)
  if (input.winRateSpread > 30 || input.rankingCorrelation < 0.5) {
    pathologies.push({
      name: "Perceived Unfairness",
      type: "perceived_unfairness",
      severity: input.winRateSpread > 40 ? "critical" : "warning",
      description: `Win rate spread ${input.winRateSpread.toFixed(0)}%, ranking correlation ${input.rankingCorrelation.toFixed(2)} — players perceive imbalance`,
      correction: "Tune win rates toward 45-55% spread; improve ranking correlation via transitive tuning",
      bible_ref: "Bible 5.13.8",
    });
  }

  return pathologies;
}
