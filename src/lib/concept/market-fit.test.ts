/**
 * R4-04: Unit tests for computeMarketFit (Block 1, Concept market fit).
 *
 * Covers:
 *   - Heuristic prior only when no evidence is supplied.
 *   - Evidence-weighted mode activation when reference games are supplied.
 *   - Confidence labelling: low (no evidence), low (reference games only),
 *     medium (competitor_analysis with medium confidence), high (market_research high).
 *   - Prior score by genre + multi-genre bonus.
 *   - Reason and improvement reflect the source/confidence honestly.
 *   - Determinism: same inputs produce identical outputs.
 *   - R4-04 acceptance: without external data, score is honestly labelled as
 *     heuristic prior (not a pseudo-precise market measurement).
 */

import { describe, it, expect } from "vitest";
import { computeMarketFit, type MarketEvidence } from "./market-fit";

describe("computeMarketFit — heuristic prior (no evidence)", () => {
  it("returns heuristic_prior source with low confidence when no evidence supplied", () => {
    const r = computeMarketFit("rpg", false, [], []);
    expect(r.source).toBe("heuristic_prior");
    expect(r.confidence).toBe("low");
    expect(r.evidence).toEqual([]);
    expect(r.evidence_score).toBeUndefined();
  });

  it("prior score matches genre lookup (rpg = 0.85)", () => {
    const r = computeMarketFit("rpg", false, [], []);
    expect(r.prior.score).toBe(0.85);
    expect(r.score).toBe(0.85);
  });

  it("prior score matches genre lookup (visual_novel = 0.45)", () => {
    const r = computeMarketFit("visual_novel", false, [], []);
    expect(r.prior.score).toBe(0.45);
  });

  it("multi-genre bonus adds 0.1 to prior", () => {
    const r = computeMarketFit("rpg", true, [], []);
    expect(r.prior.score).toBe(0.95); // 0.85 + 0.1, capped at 0.95
  });

  it("multi-genre bonus capped at 0.95", () => {
    const r = computeMarketFit("shooter", true, [], []);
    expect(r.prior.score).toBe(0.95); // 0.85 + 0.1 = 0.95
  });

  it("unknown genre falls back to default prior 0.6", () => {
    const r = computeMarketFit("quantum-genre", false, [], []);
    expect(r.prior.score).toBe(0.6);
  });

  it("reason honestly states heuristic prior only and rule-of-thumb nature", () => {
    const r = computeMarketFit("rpg", false, [], []);
    expect(r.reason).toContain("Heuristic prior only");
    expect(r.reason).toContain("rpg");
    expect(r.reason).toContain("not a measurement");
    expect(r.reason.toLowerCase()).toContain("no external");
  });

  it("improvement recommends attaching evidence to upgrade", () => {
    const r = computeMarketFit("rpg", false, [], []);
    expect(r.improvement).toContain("reference games");
    expect(r.improvement).toContain("market research");
  });

  it("prior weight is 1.0 when no evidence", () => {
    const r = computeMarketFit("rpg", false, [], []);
    expect(r.prior.weight).toBe(1);
  });
});

describe("computeMarketFit — reference games evidence", () => {
  it("activates evidence_weighted mode when reference games supplied", () => {
    const r = computeMarketFit("rpg", false, ["Skyrim", "Witcher 3"], []);
    expect(r.source).toBe("evidence_weighted");
    expect(r.evidence).toHaveLength(1);
    expect(r.evidence[0].source).toBe("reference_games");
    expect(r.evidence[0].references).toEqual(["Skyrim", "Witcher 3"]);
    expect(r.evidence[0].confidence).toBe("low");
  });

  it("reference games evidence produces evidence_score > prior (small lift)", () => {
    const r = computeMarketFit("rpg", false, ["Skyrim"], []);
    expect(r.evidence_score).toBeDefined();
    expect(r.evidence_score).toBeGreaterThan(r.prior.score);
  });

  it("final score is a blend of prior (70%) and evidence (30%)", () => {
    const r = computeMarketFit("rpg", false, ["Skyrim"], []);
    // prior=0.85, evidence_score=0.9 (0.85+0.05 lift), final = 0.85*0.7 + 0.9*0.3 = 0.595+0.27 = 0.865
    expect(r.score).toBe(Number((0.85 * 0.7 + (0.85 + 0.05) * 0.3).toFixed(2)));
  });

  it("prior weight drops to 0.7 when evidence is present", () => {
    const r = computeMarketFit("rpg", false, ["Skyrim"], []);
    expect(r.prior.weight).toBe(0.7);
  });

  it("confidence stays 'low' for reference-games-only evidence", () => {
    const r = computeMarketFit("rpg", false, ["Skyrim", "Witcher 3"], []);
    expect(r.confidence).toBe("low");
  });

  it("empty/whitespace reference games are filtered out (no evidence created)", () => {
    const r = computeMarketFit("rpg", false, ["", "  ", ""], []);
    expect(r.evidence).toEqual([]);
    expect(r.source).toBe("heuristic_prior");
  });

  it("reason mentions evidence count and confidence", () => {
    const r = computeMarketFit("rpg", false, ["Skyrim"], []);
    expect(r.reason).toContain("1 evidence source");
    expect(r.reason).toContain("confidence");
  });

  it("improvement for low-confidence evidence recommends strengthening", () => {
    const r = computeMarketFit("rpg", false, ["Skyrim"], []);
    expect(r.improvement).toContain("Strengthen");
    expect(r.improvement).toMatch(/competitor|playtest/);
  });
});

describe("computeMarketFit — stronger evidence", () => {
  it("competitor_analysis with medium confidence raises overall confidence to medium", () => {
    const evidence: MarketEvidence[] = [{
      source: "competitor_analysis",
      references: ["steamdb-sales-report.pdf"],
      confidence: "medium",
      notes: "Sales data for 5 direct competitors",
    }];
    const r = computeMarketFit("rpg", false, [], evidence);
    expect(r.confidence).toBe("medium");
    expect(r.evidence).toHaveLength(1);
  });

  it("market_research with high confidence raises overall confidence to high", () => {
    const evidence: MarketEvidence[] = [{
      source: "market_research",
      references: ["newzoo-2026-rpg-report"],
      confidence: "high",
      notes: "Audience-size study with methodology",
    }];
    const r = computeMarketFit("rpg", false, [], evidence);
    expect(r.confidence).toBe("high");
  });

  it("playtest with high confidence raises overall confidence to high", () => {
    const evidence: MarketEvidence[] = [{
      source: "playtest",
      references: ["playtest-cohort-A-2026-03"],
      confidence: "high",
      notes: "50-player cohort, retention measured",
    }];
    const r = computeMarketFit("rpg", false, [], evidence);
    expect(r.confidence).toBe("high");
  });

  it("market_research high produces larger lift than reference_games", () => {
    const refOnly = computeMarketFit("rpg", false, ["Skyrim"], []);
    const research = computeMarketFit("rpg", false, [], [{
      source: "market_research",
      references: ["newzoo"],
      confidence: "high",
    }]);
    expect(research.evidence_score!).toBeGreaterThan(refOnly.evidence_score!);
  });

  it("improvement for medium/high confidence recommends market_research for high", () => {
    const r = computeMarketFit("rpg", false, [], [{
      source: "competitor_analysis",
      references: ["x"],
      confidence: "medium",
    }]);
    expect(r.improvement).toContain("market_research");
  });

  it("mixed evidence (reference_games + competitor_analysis) creates 2 entries", () => {
    const r = computeMarketFit("rpg", false, ["Skyrim"], [{
      source: "competitor_analysis",
      references: ["report.pdf"],
      confidence: "medium",
    }]);
    expect(r.evidence).toHaveLength(2);
    expect(r.confidence).toBe("medium"); // highest evidence confidence
  });
});

describe("computeMarketFit — R4-04 acceptance: honest labelling", () => {
  it("without external data, score is NOT presented as a precise market measurement", () => {
    const r = computeMarketFit("rpg", false, [], []);
    // source must be heuristic_prior, not a fake evidence claim
    expect(r.source).toBe("heuristic_prior");
    // confidence must be low
    expect(r.confidence).toBe("low");
    // evidence array must be empty
    expect(r.evidence).toHaveLength(0);
    // reason must NOT claim market data
    expect(r.reason.toLowerCase()).not.toContain("measured");
    expect(r.reason.toLowerCase()).not.toContain("audience data");
  });

  it("with evidence, source switches to evidence_weighted", () => {
    const r = computeMarketFit("rpg", false, ["Skyrim"], []);
    expect(r.source).toBe("evidence_weighted");
    expect(r.evidence).toHaveLength(1);
  });

  it("changing evidence changes score explainably", () => {
    const noEvidence = computeMarketFit("rpg", false, [], []);
    const withRef = computeMarketFit("rpg", false, ["Skyrim"], []);
    const withResearch = computeMarketFit("rpg", false, [], [{
      source: "market_research",
      references: ["newzoo"],
      confidence: "high",
    }]);
    // score should increase as evidence gets stronger
    expect(withRef.score).toBeGreaterThanOrEqual(noEvidence.score);
    expect(withResearch.score).toBeGreaterThanOrEqual(withRef.score);
    // reasons must differ
    expect(noEvidence.reason).not.toBe(withRef.reason);
    expect(withRef.reason).not.toBe(withResearch.reason);
  });

  it("changing genre changes prior and final score (heuristic mode)", () => {
    const rpg = computeMarketFit("rpg", false, [], []);
    const vn = computeMarketFit("visual_novel", false, [], []);
    expect(rpg.score).toBeGreaterThan(vn.score);
    expect(rpg.prior.score).toBeGreaterThan(vn.prior.score);
  });

  it("deterministic: same inputs produce identical outputs", () => {
    const a = computeMarketFit("rpg", true, ["Skyrim"], [{
      source: "market_research",
      references: ["x"],
      confidence: "high",
    }]);
    const b = computeMarketFit("rpg", true, ["Skyrim"], [{
      source: "market_research",
      references: ["x"],
      confidence: "high",
    }]);
    expect(a).toEqual(b);
  });

  it("score is bounded in [0, 1]", () => {
    const extreme = computeMarketFit("rpg", true, ["A", "B", "C"], [
      { source: "market_research", references: ["x"], confidence: "high" },
      { source: "playtest", references: ["y"], confidence: "high" },
    ]);
    expect(extreme.score).toBeGreaterThanOrEqual(0);
    expect(extreme.score).toBeLessThanOrEqual(1);
  });
});
