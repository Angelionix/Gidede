/**
 * R4-09: Unit tests for the dominance lens evaluator.
 *
 * Covers:
 *   - Heuristic fallback when Balance evidence is absent.
 *   - Balance evidence scoring: dominant strategy, dominated count, max_share, gini.
 *   - Source labelling: "balance_evidence" vs "heuristic".
 *   - Issues and suggestions generation.
 *   - extractBalanceDominanceEvidence from Balance output records.
 *   - Determinism.
 *   - R4-09 acceptance: Lens #41 derived from Balance dominance, not synergy.
 */

import { describe, it, expect } from "vitest";
import {
  evaluateDominanceLens,
  extractBalanceDominanceEvidence,
  type BalanceDominanceEvidence,
} from "./dominance-lens";

describe("evaluateDominanceLens — heuristic fallback (no Balance evidence)", () => {
  it("returns synergy-proxy score when evidence is null", () => {
    const r = evaluateDominanceLens(null, 80);
    expect(r.source).toBe("heuristic");
    expect(r.score).toBe(Number((0.5 + 0.8 * 0.5).toFixed(3))); // 0.9
    expect(r.reason).toContain("synergy proxy");
    expect(r.issues).toEqual([]);
  });

  it("returns synergy-proxy score when evidence is undefined", () => {
    const r = evaluateDominanceLens(undefined, 60);
    expect(r.source).toBe("heuristic");
    expect(r.score).toBe(0.8); // 0.5 + 0.6*0.5
  });

  it("returns 0.5 when synergyScore is 0 or undefined", () => {
    expect(evaluateDominanceLens(null, 0).score).toBe(0.5);
    expect(evaluateDominanceLens(null).score).toBe(0.5);
  });

  it("caps score at 1.0 for high synergy", () => {
    expect(evaluateDominanceLens(null, 200).score).toBe(1);
  });
});

describe("evaluateDominanceLens — balance evidence scoring", () => {
  it("returns 1.0 when Balance reports no dominance issues", () => {
    const evidence: BalanceDominanceEvidence = {
      has_dominant_strategy: false,
      dominated_strategies: [],
      total_strategies: 4,
      max_share: 0.25,
      gini: 0.1,
    };
    const r = evaluateDominanceLens(evidence, 50);
    expect(r.source).toBe("balance_evidence");
    expect(r.score).toBe(1);
    expect(r.issues).toEqual([]);
    expect(r.reason).toContain("no dominant strategy");
  });

  it("drops to 0.2 when has_dominant_strategy is true", () => {
    const evidence: BalanceDominanceEvidence = {
      has_dominant_strategy: true,
      dominated_strategies: [],
      total_strategies: 4,
    };
    const r = evaluateDominanceLens(evidence, 90);
    expect(r.score).toBe(0.2);
    expect(r.issues).toContain("Balance detected a dominant strategy");
    expect(r.suggestions.length).toBeGreaterThan(0);
  });

  it("subtracts 0.15 per dominated strategy (capped at -0.6)", () => {
    const evidence2: BalanceDominanceEvidence = {
      has_dominant_strategy: false,
      dominated_strategies: ["A", "B"],
      total_strategies: 4,
      max_share: 0.25,
      gini: 0.1,
    };
    const r2 = evaluateDominanceLens(evidence2, 50);
    expect(r2.score).toBe(Number((1 - 0.3).toFixed(3))); // 0.7

    const evidence4: BalanceDominanceEvidence = {
      has_dominant_strategy: false,
      dominated_strategies: ["A", "B", "C", "D"],
      total_strategies: 4,
      max_share: 0.25,
      gini: 0.1,
    };
    const r4 = evaluateDominanceLens(evidence4, 50);
    expect(r4.score).toBe(Number((1 - 0.6).toFixed(3))); // 0.4 (capped penalty)
  });

  it("subtracts penalty when max_share > 0.5", () => {
    const evidence: BalanceDominanceEvidence = {
      has_dominant_strategy: false,
      dominated_strategies: [],
      total_strategies: 4,
      max_share: 0.7,
      gini: 0.1,
    };
    const r = evaluateDominanceLens(evidence, 50);
    // score = 1 - (0.7-0.5)*2 = 1 - 0.4 = 0.6
    expect(r.score).toBe(0.6);
    expect(r.issues.some((i) => i.includes("max share"))).toBe(true);
  });

  it("subtracts 0.1 when gini > 0.7", () => {
    const evidence: BalanceDominanceEvidence = {
      has_dominant_strategy: false,
      dominated_strategies: [],
      total_strategies: 4,
      max_share: 0.25,
      gini: 0.8,
    };
    const r = evaluateDominanceLens(evidence, 50);
    expect(r.score).toBe(0.9); // 1 - 0.1
    expect(r.issues.some((i) => i.includes("Gini"))).toBe(true);
  });

  it("combines multiple penalties", () => {
    const evidence: BalanceDominanceEvidence = {
      has_dominant_strategy: true,
      dominated_strategies: ["A", "B"],
      total_strategies: 4,
      max_share: 0.6,
      gini: 0.75,
    };
    const r = evaluateDominanceLens(evidence, 90);
    // Start 0.2 (dominant) - 0.3 (2 dominated) - 0.2 (max_share 0.6) - 0.1 (gini) = -0.4 → clamped to 0
    expect(r.score).toBe(0);
    expect(r.issues.length).toBe(4);
  });

  it("clamps score to [0, 1]", () => {
    const extreme: BalanceDominanceEvidence = {
      has_dominant_strategy: true,
      dominated_strategies: ["A", "B", "C", "D", "E"],
      total_strategies: 5,
      max_share: 0.95,
      gini: 0.95,
    };
    const r = evaluateDominanceLens(extreme, 0);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(1);
  });

  it("source is 'balance_evidence' when evidence is present", () => {
    const r = evaluateDominanceLens({ has_dominant_strategy: false }, 50);
    expect(r.source).toBe("balance_evidence");
  });

  it("is deterministic: same inputs → same output", () => {
    const evidence: BalanceDominanceEvidence = {
      has_dominant_strategy: false,
      dominated_strategies: ["A"],
      total_strategies: 3,
      max_share: 0.4,
      gini: 0.3,
    };
    const a = evaluateDominanceLens(evidence, 50);
    const b = evaluateDominanceLens(evidence, 50);
    expect(a).toEqual(b);
  });
});

describe("extractBalanceDominanceEvidence — from Balance output records", () => {
  it("extracts evidence from a well-formed Balance output", () => {
    const balanceOutput = {
      intransitive_result: {
        has_dominant_strategy: false,
        dominated_strategies: ["weak_strategy"],
        object_names: ["sword", "shield", "bow", "weak_strategy"],
        strategy_balance: { max_share: 0.3, gini: 0.2, entropy: 1.8 },
      },
    };
    const evidence = extractBalanceDominanceEvidence(balanceOutput);
    expect(evidence).not.toBeNull();
    expect(evidence!.has_dominant_strategy).toBe(false);
    expect(evidence!.dominated_strategies).toEqual(["weak_strategy"]);
    expect(evidence!.total_strategies).toBe(4);
    expect(evidence!.max_share).toBe(0.3);
    expect(evidence!.gini).toBe(0.2);
  });

  it("returns null when balance output has no intransitive_result", () => {
    expect(extractBalanceDominanceEvidence({})).toBeNull();
    expect(extractBalanceDominanceEvidence(null)).toBeNull();
    expect(extractBalanceDominanceEvidence(undefined)).toBeNull();
    expect(extractBalanceDominanceEvidence("not-an-object")).toBeNull();
  });

  it("returns null when intransitive_result is not an object", () => {
    expect(extractBalanceDominanceEvidence({ intransitive_result: "string" })).toBeNull();
    expect(extractBalanceDominanceEvidence({ intransitive_result: 42 })).toBeNull();
  });

  it("handles missing optional fields gracefully", () => {
    const balanceOutput = {
      intransitive_result: {
        dominated_strategies: ["A"],
      },
    };
    const evidence = extractBalanceDominanceEvidence(balanceOutput);
    expect(evidence).not.toBeNull();
    expect(evidence!.has_dominant_strategy).toBeUndefined();
    expect(evidence!.dominated_strategies).toEqual(["A"]);
    expect(evidence!.total_strategies).toBe(1); // falls back to dominated.length
    expect(evidence!.max_share).toBeUndefined();
    expect(evidence!.gini).toBeUndefined();
  });
});

describe("R4-09 acceptance: Lens #41 from Balance dominance, not synergy", () => {
  it("with Balance evidence, score is derived from dominance — NOT synergy", () => {
    const evidence: BalanceDominanceEvidence = {
      has_dominant_strategy: true,
      dominated_strategies: [],
      total_strategies: 4,
    };
    // Even with synergy_score=100 (which would give 1.0 via the proxy),
    // the Balance-evidence score is 0.2 because has_dominant_strategy=true.
    const r = evaluateDominanceLens(evidence, 100);
    expect(r.score).toBe(0.2);
    expect(r.source).toBe("balance_evidence");
  });

  it("without Balance evidence, score falls back to synergy proxy (labelled heuristic)", () => {
    const r = evaluateDominanceLens(null, 80);
    expect(r.source).toBe("heuristic");
    expect(r.score).toBe(0.9); // synergy proxy
    expect(r.reason).toContain("Balance evidence unavailable");
  });

  it("changing Balance evidence changes the score (not synergy)", () => {
    const noDominance: BalanceDominanceEvidence = {
      has_dominant_strategy: false,
      dominated_strategies: [],
      total_strategies: 4,
      max_share: 0.25,
      gini: 0.1,
    };
    const withDominance: BalanceDominanceEvidence = {
      has_dominant_strategy: true,
      dominated_strategies: ["A", "B"],
      total_strategies: 4,
      max_share: 0.6,
      gini: 0.5,
    };
    const r1 = evaluateDominanceLens(noDominance, 50);
    const r2 = evaluateDominanceLens(withDominance, 50);
    expect(r1.score).toBeGreaterThan(r2.score);
    expect(r1.source).toBe("balance_evidence");
    expect(r2.source).toBe("balance_evidence");
  });

  it("extractBalanceDominanceEvidence reads real Balance output shape", () => {
    // This is the actual shape persisted by /api/v1/balance/analyze.
    const realBalanceOutput = {
      intransitive_result: {
        payoff_matrix: [[0, 0.1], [-0.1, 0]],
        object_names: ["weapon_a", "weapon_b"],
        nash_equilibrium: [0.5, 0.5],
        is_intransitive: true,
        dominated_strategies: ["weapon_b"],
        strategy_balance: { entropy: 0.693, max_share: 0.5, gini: 0.0 },
        rps_cycles: [{ cycle: ["weapon_a", "weapon_b", "weapon_a"] }],
        has_dominant_strategy: false,
      },
    };
    const evidence = extractBalanceDominanceEvidence(realBalanceOutput);
    expect(evidence).not.toBeNull();
    expect(evidence!.has_dominant_strategy).toBe(false);
    expect(evidence!.dominated_strategies).toEqual(["weapon_b"]);
    expect(evidence!.total_strategies).toBe(2);
    expect(evidence!.max_share).toBe(0.5);
    expect(evidence!.gini).toBe(0);
    // Score: 1 - 0.15 (1 dominated) = 0.85 (max_share=0.5 is not >0.5, gini=0 not >0.7)
    const r = evaluateDominanceLens(evidence, 50);
    expect(r.score).toBe(0.85);
  });
});
