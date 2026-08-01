/**
 * Gidede — Concept market-fit model (Block 1, roadmap R4-04).
 *
 * Replaces the legacy single-score market-fit lookup with an honest two-layer
 * model that separates a genre-based heuristic prior from external market
 * evidence. The final score is always traceable to its sources, and consumers
 * can distinguish "this is a rule-of-thumb prior" from "this is backed by
 * reference games / competitor analysis / market research / playtest data".
 *
 * Design principles:
 *   - Without external data, the score is explicitly labelled as a heuristic
 *     prior with `confidence: "low"` and `source: "heuristic_prior"`. The
 *     score is NOT presented as a precise market measurement.
 *   - When the user supplies reference games (or, in future, competitor
 *     analysis / market research / playtest evidence), they are recorded as
 *     `evidence[]` entries with their own source/confidence/notes, and the
 *     final score becomes a weighted blend of prior + evidence.
 *   - Deterministic: same inputs always produce the same score, evidence and
 *     reasons.
 *   - Evidence is never fabricated. Empty evidence is reported honestly.
 */

export interface MarketEvidence {
  /** Where the evidence came from. */
  source: "reference_games" | "competitor_analysis" | "market_research" | "playtest";
  /** Concrete references (game titles, document IDs, study names). */
  references: string[];
  /** How strong this evidence is for market-fit judgement. */
  confidence: "low" | "medium" | "high";
  /** Human-readable note about what this evidence contributes. */
  notes?: string;
}

export interface MarketFitResult {
  /** Final blended market-fit score in [0, 1]. */
  score: number;
  /** Heuristic prior (always present). */
  prior: {
    /** Prior score after genre lookup + multi-genre bonus, in [0, 1]. */
    score: number;
    /** Weight of the prior in the final blend (1 when no evidence, <1 otherwise). */
    weight: number;
    /** Human-readable reason for the prior score. */
    reason: string;
  };
  /** External evidence entries (empty when none supplied). */
  evidence: MarketEvidence[];
  /** Weighted evidence score; undefined when no evidence is present. */
  evidence_score?: number;
  /** Overall confidence label reflecting evidence strength. */
  confidence: "low" | "medium" | "high";
  /** Human-readable reason explaining the final score and its sources. */
  reason: string;
  /** Targeted improvement recommendation for raising confidence. */
  improvement: string;
  /** Whether the final score is heuristic-only or evidence-weighted. */
  source: "heuristic_prior" | "evidence_weighted";
}

/**
 * Heuristic prior market-fit score by primary genre.
 *
 * These are rule-of-thumb prior beliefs about genre audience size on the
 * Western market, NOT measurements. They are intentionally conservative and
 * should be replaced or blended with evidence as soon as external data is
 * available. Sourced from general industry intuition, not from a specific
 * market dataset.
 */
const MARKET_FIT_PRIOR_BY_GENRE: Record<string, number> = {
  rpg: 0.85,
  shooter: 0.85,
  strategy: 0.8,
  mmorpg: 0.75,
  action: 0.8,
  adventure: 0.75,
  puzzle: 0.7,
  platformer: 0.7,
  roguelike: 0.65,
  horror: 0.65,
  sandbox: 0.65,
  racing: 0.6,
  fighting: 0.6,
  tower_defense: 0.55,
  rhythm: 0.5,
  metroidvania: 0.5,
  visual_novel: 0.45,
  idle: 0.55,
  stealth: 0.5,
  survival_horror: 0.6,
  action_rpg: 0.82,
  jrpg: 0.78,
  tactical_rpg: 0.7,
  rts: 0.72,
  tbs: 0.68,
  simulation: 0.62,
  party: 0.55,
  educational: 0.5,
  sports: 0.65,
};

const DEFAULT_PRIOR = 0.6;
const MULTI_GENRE_BONUS = 0.1;
const PRIOR_CAP = 0.95;

/**
 * Compute market-fit score with explicit separation of heuristic prior and
 * external evidence.
 *
 * @param primaryGenre    The primary genre selected for the concept.
 * @param hasMultiGenre   Whether the concept spans multiple subgenres.
 * @param referenceGames  Optional list of reference game titles supplied by
 *   the user. Each title becomes a low-confidence `reference_games` evidence
 *   entry, because user-provided titles are not verified against a market
 *   dataset.
 * @param extraEvidence   Optional additional evidence entries (competitor
 *   analysis, market research, playtest). Allows future integrations to feed
 *   stronger evidence without changing the contract.
 */
export function computeMarketFit(
  primaryGenre: string,
  hasMultiGenre: boolean,
  referenceGames: string[] = [],
  extraEvidence: MarketEvidence[] = [],
): MarketFitResult {
  const genrePrior = MARKET_FIT_PRIOR_BY_GENRE[primaryGenre] ?? DEFAULT_PRIOR;
  const priorScore = Math.min(
    PRIOR_CAP,
    genrePrior + (hasMultiGenre ? MULTI_GENRE_BONUS : 0),
  );

  // Collect evidence: reference games (low confidence) + any extra evidence.
  const evidence: MarketEvidence[] = [];
  const cleanReferences = referenceGames
    .map((g) => (typeof g === "string" ? g.trim() : ""))
    .filter((g) => g.length > 0);
  if (cleanReferences.length > 0) {
    evidence.push({
      source: "reference_games",
      references: cleanReferences,
      confidence: "low",
      notes: `${cleanReferences.length} reference game(s) supplied by the user — indirect signal, not verified market data`,
    });
  }
  for (const e of extraEvidence) {
    evidence.push(e);
  }

  // Evidence score: when only reference_games evidence is present, the
  // evidence score is a small lift over the prior (the designer at least
  // researched competitors). When stronger evidence (competitor_analysis,
  // market_research, playtest) is supplied, the evidence score can deviate
  // further from the prior — but we keep the lift conservative because the
  // prior is already a reasonable baseline.
  let evidenceScore: number | undefined;
  let evidenceWeight = 0;
  if (evidence.length > 0) {
    let lift = 0.05; // small lift for any evidence (research done)
    for (const e of evidence) {
      if (e.source === "competitor_analysis" && e.confidence === "medium") lift = Math.max(lift, 0.08);
      if (e.source === "competitor_analysis" && e.confidence === "high") lift = Math.max(lift, 0.12);
      if (e.source === "market_research" && e.confidence === "medium") lift = Math.max(lift, 0.1);
      if (e.source === "market_research" && e.confidence === "high") lift = Math.max(lift, 0.15);
      if (e.source === "playtest" && e.confidence === "high") lift = Math.max(lift, 0.1);
    }
    evidenceScore = Math.min(PRIOR_CAP, priorScore + lift);
    evidenceWeight = 0.3; // evidence contributes 30% of the final score
  }

  const finalScore = evidenceScore !== undefined
    ? priorScore * (1 - evidenceWeight) + evidenceScore * evidenceWeight
    : priorScore;

  // Overall confidence: highest evidence confidence, or "low" when no evidence.
  let confidence: "low" | "medium" | "high" = "low";
  if (evidence.length > 0) {
    const confidences = evidence.map((e) => e.confidence);
    if (confidences.includes("high")) confidence = "high";
    else if (confidences.includes("medium")) confidence = "medium";
    else confidence = "low";
  }

  const source: "heuristic_prior" | "evidence_weighted" = evidence.length > 0
    ? "evidence_weighted"
    : "heuristic_prior";

  const priorReason = `Жанр "${primaryGenre}" prior ${genrePrior}${
    hasMultiGenre ? ` + ${MULTI_GENRE_BONUS} multi-genre bonus` : ""
  } = ${priorScore}`;

  const reason = evidence.length === 0
    ? `Heuristic prior only — ${priorReason}. No external market evidence supplied; score is a rule-of-thumb, not a measurement.`
    : `Prior ${priorScore} blended with ${evidence.length} evidence source(s) [confidence: ${confidence}] → ${finalScore.toFixed(2)}`;

  const improvement = evidence.length === 0
    ? "Attach reference games, competitor analysis or market research to upgrade from heuristic prior to evidence-backed market score"
    : confidence === "low"
    ? "Strengthen evidence: add competitor analysis with sales/audience data or playtest results for higher confidence"
    : "Add market_research evidence with concrete audience-size data to reach high confidence";

  return {
    score: Number(finalScore.toFixed(2)),
    prior: {
      score: Number(priorScore.toFixed(2)),
      weight: Number((1 - evidenceWeight).toFixed(2)),
      reason: priorReason,
    },
    evidence,
    evidence_score: evidenceScore !== undefined ? Number(evidenceScore.toFixed(2)) : undefined,
    confidence,
    reason,
    improvement,
    source,
  };
}
