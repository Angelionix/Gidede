/**
 * Gidede — Dominance lens evaluator (Block 3, roadmap R4-09).
 *
 * Replaces the synergy-proxy score for Lens #41 «Доминантная стратегия» with
 * a real evaluation derived from Balance intransitive dominance evidence.
 *
 * Before R4-09: Lens #41 score = `0.5 + (synergy_score / 100) * 0.5` — a
 * synergy proxy that has nothing to do with actual dominant strategies.
 *
 * After R4-09: when Balance evidence is available (forwarded via the pipeline
 * context when MDA is re-run after Balance), Lens #41's score is derived from
 * `dominated_strategies`, `has_dominant_strategy` and `strategy_balance.max_share`.
 * When Balance is NOT available (first forward pass, MDA before Balance), the
 * lens falls back to the synergy proxy with an explicit `source: "heuristic"`
 * label so consumers know it's not dominance evidence.
 */

export interface BalanceDominanceEvidence {
  /** Whether Balance detected a dominant strategy. */
  has_dominant_strategy?: boolean;
  /** List of dominated strategy names (longer = worse for Lens #41). */
  dominated_strategies?: string[];
  /** Total number of strategies analysed by Balance. */
  total_strategies?: number;
  /** Highest Nash equilibrium share (0-1). >0.5 means one strategy dominates. */
  max_share?: number;
  /** Gini coefficient of strategy balance (0 = perfect equality, 1 = monopoly). */
  gini?: number;
}

export interface DominanceLensResult {
  /** Lens #41 score in [0, 1]. High = no dominant strategy (good). */
  score: number;
  /** Where the score came from. */
  source: "balance_evidence" | "heuristic";
  /** Human-readable reason. */
  reason: string;
  /** Issues found (dominated strategies, high max_share, etc.). */
  issues: string[];
  /** Targeted suggestions. */
  suggestions: string[];
}

/**
 * Evaluate Lens #41 «Доминантная стратегия» from Balance intransitive
 * dominance evidence.
 *
 * Scoring model (when Balance evidence is present):
 *   - Start at 1.0 (no dominant strategy assumed).
 *   - If `has_dominant_strategy` is true → score drops to 0.2 (critical).
 *   - For each dominated strategy, subtract `0.15` (capped at -0.6).
 *   - If `max_share > 0.5` → subtract `(max_share - 0.5) * 2` (one strategy
 *     takes more than half the Nash mix).
 *   - If `gini > 0.7` → subtract 0.1 (high inequality).
 *   - Clamp to [0, 1].
 *
 * @param evidence  Balance dominance evidence (from intransitive_result).
 *   When null/undefined, falls back to the synergy proxy.
 * @param synergyScore  The mechanic set's synergy_score (0-100). Used ONLY
 *   for the heuristic fallback when Balance evidence is absent.
 */
export function evaluateDominanceLens(
  evidence: BalanceDominanceEvidence | null | undefined,
  synergyScore?: number,
): DominanceLensResult {
  if (!evidence) {
    // Fallback: synergy proxy (pre-R4-09 behaviour), explicitly labelled.
    const score = Math.min(1, 0.5 + ((synergyScore ?? 0) / 100) * 0.5);
    return {
      score: Number(score.toFixed(3)),
      source: "heuristic",
      reason: `Balance evidence unavailable — synergy proxy ${synergyScore ?? 0}/100 → ${score.toFixed(2)}`,
      issues: [],
      suggestions: [],
    };
  }

  // Real dominance evidence from Balance.
  let score = 1.0;
  const issues: string[] = [];
  const suggestions: string[] = [];

  if (evidence.has_dominant_strategy) {
    score = 0.2;
    issues.push("Balance detected a dominant strategy");
    suggestions.push("Redesign the payoff matrix so no single strategy strictly dominates all others");
  }

  const dominatedCount = evidence.dominated_strategies?.length ?? 0;
  const totalStrategies = evidence.total_strategies ?? Math.max(dominatedCount, 1);
  if (dominatedCount > 0) {
    const penalty = Math.min(0.6, dominatedCount * 0.15);
    score -= penalty;
    issues.push(`${dominatedCount} of ${totalStrategies} strategies are dominated: ${(evidence.dominated_strategies ?? []).slice(0, 3).join(", ")}${dominatedCount > 3 ? "…" : ""}`);
    suggestions.push("Add counter-balancing mechanics or situational modifiers so dominated strategies become viable in some contexts");
  }

  if (typeof evidence.max_share === "number" && evidence.max_share > 0.5) {
    const penalty = (evidence.max_share - 0.5) * 2;
    score -= penalty;
    issues.push(`Nash max share ${(evidence.max_share * 100).toFixed(0)}% is too high — one strategy dominates the mix`);
    suggestions.push("Introduce RPS cycles or situational counters to distribute the Nash share more evenly");
  }

  if (typeof evidence.gini === "number" && evidence.gini > 0.7) {
    score -= 0.1;
    issues.push(`Gini ${evidence.gini.toFixed(2)} indicates high strategy inequality`);
    suggestions.push("Broaden the viable strategy space to reduce Gini below 0.7");
  }

  score = Math.max(0, Math.min(1, score));

  if (issues.length === 0) {
    return {
      score: Number(score.toFixed(3)),
      source: "balance_evidence",
      reason: `Balance evidence: no dominant strategy, ${dominatedCount}/${totalStrategies} dominated, max_share ${(evidence.max_share ?? 0).toFixed(2)}, gini ${(evidence.gini ?? 0).toFixed(2)} → ${score.toFixed(2)}`,
      issues: [],
      suggestions: [],
    };
  }

  return {
    score: Number(score.toFixed(3)),
    source: "balance_evidence",
    reason: `Balance evidence: ${issues.join("; ")} → ${score.toFixed(2)}`,
    issues,
    suggestions,
  };
}

/**
 * Extract BalanceDominanceEvidence from a Balance stage output record.
 * Returns null when the record doesn't contain intransitive dominance data.
 */
export function extractBalanceDominanceEvidence(balanceOutput: unknown): BalanceDominanceEvidence | null {
  if (!balanceOutput || typeof balanceOutput !== "object") return null;
  const obj = balanceOutput as Record<string, unknown>;
  const intransitive = obj.intransitive_result;
  if (!intransitive || typeof intransitive !== "object") return null;
  const ir = intransitive as Record<string, unknown>;

  const dominated = Array.isArray(ir.dominated_strategies)
    ? ir.dominated_strategies.map((s) => String(s)).filter(Boolean)
    : [];
  const objectNames = Array.isArray(ir.object_names)
    ? ir.object_names as string[]
    : [];
  const totalStrategies = objectNames.length || dominated.length || 0;
  const strategyBalance = ir.strategy_balance as Record<string, unknown> | undefined;

  return {
    has_dominant_strategy: typeof ir.has_dominant_strategy === "boolean" ? ir.has_dominant_strategy : undefined,
    dominated_strategies: dominated,
    total_strategies: totalStrategies > 0 ? totalStrategies : undefined,
    max_share: typeof strategyBalance?.max_share === "number" ? strategyBalance.max_share : undefined,
    gini: typeof strategyBalance?.gini === "number" ? strategyBalance.gini : undefined,
  };
}
