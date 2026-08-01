/**
 * Honest provenance metadata for algorithmic scores (roadmap R0-03).
 *
 * Score values stay backward compatible. Each stage adds this companion map
 * so consumers can distinguish templates, heuristics, simulations, solvers,
 * playtest evidence and LLM-generated judgements.
 */

export const ALGORITHM_METHODS = [
  "template",
  "heuristic",
  "simulation",
  "solver",
  "playtest_evidence",
  "llm_generated",
] as const;

export type AlgorithmMethod = (typeof ALGORITHM_METHODS)[number];

export type AlgorithmStage =
  | "concept"
  | "core_loop"
  | "mda"
  | "balance"
  | "progression"
  | "economy"
  | "gdd"
  | "validation";

export interface AlgorithmScoreMetadata {
  method: AlgorithmMethod;
  assumptions: readonly string[];
}

export interface AlgorithmMetadata {
  taxonomy_version: 1;
  scores: Readonly<Record<string, AlgorithmScoreMetadata>>;
}

const score = (
  method: AlgorithmMethod,
  ...assumptions: [string, ...string[]]
): AlgorithmScoreMetadata => ({ method, assumptions });

const SCORE_METADATA_BY_STAGE = {
  concept: {
    "mechanic_set.compatibility_score": score(
      "heuristic",
      "Compatibility is based on genre coverage (fraction of requested genres represented in the selected set) plus an optional hybrid bonus for intentional cross-genre additions.",
      "Cross-genre mechanics are excluded from the penalty calculation — they are tracked separately as cross_genre_mechanics and contribute positively to hybrid design.",
      "Coverage thresholds and hybrid bonus cap are rule-of-thumb defaults, not measured production data.",
    ),
    "mechanic_set.synergies_detected[*].score": score(
      "template",
      "Synergy values are rule/template constants, not measured interaction effects.",
    ),
    "mechanic_set.*[*].id": score(
      "heuristic",
      "Mechanic ids are deterministic transliteration slugs of the MechanicsDB Russian name, used as the stable join key across Concept, Core Loop and MDA stages (R4-07).",
      "Fallback entries from GENRE_MECHANICS.default get slugified English ids tagged source='genre_default'.",
      "Ids are stable per name but not human-curated — two different names cannot collide, but a name change produces a different id.",
    ),
    "validation_report.eight_filters.*.score": score(
      "heuristic",
      "Keyword, length, genre and mechanic proxies approximate the eight qualitative filters.",
    ),
    "validation_report.eight_filters.feasibility.score": score(
      "heuristic",
      "Feasibility is a weighted composite of mechanics compatibility, team capacity (mechanics per developer), budget tier and platform complexity.",
      "When no constraints are supplied, falls back to compatibility-only legacy score for backward compatibility.",
      "Budget and team-size thresholds are rule-of-thumb defaults, not measured production data.",
    ),
    "validation_report.eight_filters.market_fit.score": score(
      "heuristic",
      "Market fit is a genre-based heuristic prior blended with any supplied external evidence (reference games, competitor analysis, market research, playtest).",
      "Without external evidence, the score is a rule-of-thumb prior labelled with confidence 'low' and source 'heuristic_prior', not a market measurement.",
      "Reference games supplied by the user are treated as low-confidence indirect evidence, not verified market data.",
    ),
    "usp_candidates[*].triangle_of_weirdness_check": score(
      "heuristic",
      "Triangle of Weirdness is evaluated per USP from cross-genre/novelty signals (weird), player-benefit/verb/resonance signals (appealing), and absence of hyperbolic claims plus genre mention (credible).",
      "Pass requires all three dimensions; warn if any; fail if none.",
      "Signal lists are rule-of-thumb keyword heuristics, not a validated design-quality model.",
    ),
    "validation_report.triangle_check.score": score(
      "heuristic",
      "The current Triangle of Weirdness dimensions are rule-derived and not user-validated.",
    ),
    "validation_report.overall_score": score(
      "heuristic",
      "Overall score is an arithmetic aggregation of heuristic filter scores.",
    ),
  },
  core_loop: {
    "validation.score": score(
      "heuristic",
      "Validation score is the fraction of deterministic structural checklist conditions that pass.",
      "Fun is a separate unverified hypothesis until playtest evidence is recorded.",
    ),
  },
  mda: {
    "mechanic_set.compatibility_score": score(
      "heuristic",
      "Compatibility is derived from static MDA mappings and tag overlap.",
    ),
    "mechanic_set.synergy_score": score(
      "heuristic",
      "Synergy is inferred from co-selected mechanics and static mappings.",
    ),
    "classic_mda_result.match_scores.*": score(
      "heuristic",
      "Aesthetic matches are deterministic transformations of selected mechanics, not observed player responses.",
    ),
    "classic_mda_result.overall_match": score(
      "heuristic",
      "Overall match aggregates synthetic aesthetic match scores.",
    ),
    "classic_mda_result.iterations": score(
      "simulation",
      "iterations_done reflects the real number of MDA iteration loop passes (R4-08): each iteration evaluates the mechanic set, adds a mechanic for the weakest target aesthetic if below threshold, and records a diff.",
      "The loop terminates on convergence, max_iterations (5), or no_candidates — not a hardcoded constant.",
      "Iteration diffs are persisted in classic_mda_result.iteration_diffs for audit.",
    ),
    "lens_validation.results[*].score": score(
      "heuristic",
      "Lens answers use compatibility-derived rules and fixed fallbacks rather than a complete Shell lens audit.",
    ),
    "lens_validation.results[41].score": score(
      "heuristic",
      "Lens #41 (dominant strategy) is derived from Balance intransitive dominance evidence when available (source='balance_evidence'), falling back to the synergy proxy when Balance has not yet run (source='heuristic').",
      "The Balance-evidence score penalises has_dominant_strategy, dominated_strategies count, max_share > 0.5 and gini > 0.7.",
    ),
    "lens_validation.overall_score": score(
      "heuristic",
      "Overall lens score is the mean of heuristic lens results.",
    ),
    "bond_validation.row_consistency[*].score": score(
      "heuristic",
      "Row consistency reflects the count of dissonances detected at that level (R4-10), not a compatibility transform.",
      "Dissonances are detected from concrete incompatible pairs (e.g. cozy aesthetic + combat-heavy mechanics, horror genre + fellowship aesthetic).",
    ),
    "bond_validation.col_consistency[*].score": score(
      "heuristic",
      "Column consistency reflects the count of dissonances detected for that element (R4-10).",
    ),
    "bond_validation.overall_consistency": score(
      "heuristic",
      "Overall consistency aggregates row and column consistency scores; it drops when dissonances are present.",
    ),
    "bond_validation.dissonances": score(
      "heuristic",
      "Dissonances are detected from concrete incompatible artifact pairs (R4-10): cozy+combat, intense+no-combat, horror+fellowship, VR+social, empty-base, target-not-in-predicted.",
    ),
  },
  balance: {
    "q_factor_result.q_factors[*].synergy_score": score(
      "heuristic",
      "Synergy is a deterministic name-hash proxy, not an interaction simulation.",
    ),
    "monte_carlo_result.win_rates.*": score(
      "simulation",
      "Win rates come from repeated RNG trials over the synthetic payoff model.",
      "The payoff model is not an executable gameplay model.",
    ),
    "machinations_result.aggregated.stability_index": score(
      "simulation",
      "Stability is measured over generated resource-flow trials with fixed synthetic rules.",
    ),
    "stability.overall_stability": score(
      "heuristic",
      "Overall stability aggregates synthetic balance diagnostics and is not a playtest score.",
    ),
  },
  progression: {
    "content_plan.perceived_difficulty_table[*].target_perceived_difficulty": score(
      "heuristic",
      "Perceived difficulty is generated from configured curves, not measured from players.",
    ),
    "validation.overall_score": score(
      "heuristic",
      "Overall score subtracts fixed penalties for detected critical, warning and info issues.",
    ),
  },
  economy: {
    "conversion_graph.chains[*].profitability": score(
      "heuristic",
      "Profitability is computed from generated conversion rates and costs.",
    ),
    "conversion_graph.avg_profitability": score(
      "heuristic",
      "Average profitability is the arithmetic mean of generated conversion chains.",
    ),
    "sim_result.aggregated.stability_index": score(
      "simulation",
      "Stability is estimated by seeded trials over generated faucet/drain values.",
      "The graph is not executed as a full Machinations semantics model.",
    ),
  },
  gdd: {
    "coverage_score": score(
      "template",
      "Coverage counts sections labelled auto_fill or ai_enrich regardless of semantic completeness.",
    ),
    "data_mapping.coverage_score": score(
      "template",
      "Coverage is the filled-source ratio over the selected section template.",
    ),
    "assembled_document.coverage_score": score(
      "template",
      "Coverage measures section presence, not design-document quality or review acceptance.",
    ),
  },
  validation: {
    "mda_check.overall_mda_score": score(
      "heuristic",
      "Score starts from a fixed baseline and applies rule-based bonuses and penalties.",
    ),
    "balance_check.overall_balance_score": score(
      "heuristic",
      "Score aggregates persisted diagnostics with fixed thresholds and penalties.",
    ),
    "narrative_check.overall_narrative_score": score(
      "heuristic",
      "Score uses field presence and keyword proxies rather than reader research.",
    ),
    "summary.overall_score": score(
      "heuristic",
      "Readiness is a weighted aggregation of checklist proxies and skipped-stage defaults.",
      "It is not equivalent to a successful prototype or playtest gate.",
    ),
  },
} satisfies Record<AlgorithmStage, Record<string, AlgorithmScoreMetadata>>;

export function getStageAlgorithmMetadata(stage: AlgorithmStage): AlgorithmMetadata {
  return {
    taxonomy_version: 1,
    scores: SCORE_METADATA_BY_STAGE[stage],
  };
}
