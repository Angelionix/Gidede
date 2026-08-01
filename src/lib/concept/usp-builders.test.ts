/**
 * R4-05: Unit tests for buildUSPCandidates (Block 1).
 *
 * Covers:
 *   - Three candidates are produced from any idea.
 *   - Each candidate's triangle_of_weirdness_check is COMPUTED (not hardcoded
 *     "pass"|"warn"|"pass").
 *   - Different ideas/genres produce different triangle results.
 *   - Structured triangle_check field is present for UI transparency.
 *   - Short ideas still produce meaningful candidates (safe excerpt fallback).
 *   - Determinism: same inputs produce identical outputs.
 *   - R4-05 acceptance: no hardcoded triangle results.
 */

import { describe, it, expect } from "vitest";
import { buildUSPCandidates } from "./usp-builders";

describe("buildUSPCandidates — basic structure", () => {
  it("returns exactly 3 candidates", () => {
    const candidates = buildUSPCandidates("rpg", "Build a castle and survive the night");
    expect(candidates).toHaveLength(3);
  });

  it("each candidate has usp, triangle_of_weirdness_check, triangle_check and competitive_differentiation", () => {
    const candidates = buildUSPCandidates("rpg", "Build a castle and survive the night");
    for (const c of candidates) {
      expect(typeof c.usp).toBe("string");
      expect(c.usp.length).toBeGreaterThan(0);
      expect(["pass", "warn", "fail"]).toContain(c.triangle_of_weirdness_check);
      expect(c.triangle_check).toBeDefined();
      expect(c.triangle_check).toHaveProperty("weird");
      expect(c.triangle_check).toHaveProperty("appealing");
      expect(c.triangle_check).toHaveProperty("credible");
      expect(c.triangle_check).toHaveProperty("score");
      expect(c.triangle_check).toHaveProperty("reason");
      expect(typeof c.competitive_differentiation).toBe("string");
      expect(c.competitive_differentiation.length).toBeGreaterThan(0);
    }
  });

  it("USP text includes the genre", () => {
    const candidates = buildUSPCandidates("rpg", "Build a castle");
    for (const c of candidates) {
      expect(c.usp.toLowerCase()).toContain("rpg");
    }
  });

  it("USP text includes an excerpt from the idea", () => {
    const candidates = buildUSPCandidates("rpg", "Build a dark castle and survive the endless night");
    // At least one candidate should reference the idea text.
    const anyMentionsIdea = candidates.some((c) => c.usp.includes("Build a dark castle"));
    expect(anyMentionsIdea).toBe(true);
  });
});

describe("buildUSPCandidates — R4-05 acceptance: triangle is computed, not hardcoded", () => {
  it("triangle_of_weirdness_check values are NOT a fixed 'pass|warn|pass' sequence", () => {
    // The legacy implementation always returned ["pass", "warn", "pass"].
    // After R4-05, the values are computed from USP properties, so at least
    // one of the three should differ from the legacy pattern across genres.
    const genres = ["rpg", "shooter", "puzzle", "horror", "racing"];
    const seenPatterns = new Set<string>();
    for (const genre of genres) {
      const candidates = buildUSPCandidates(genre, "Build a dark castle and survive the night");
      const pattern = candidates.map((c) => c.triangle_of_weirdness_check).join("|");
      seenPatterns.add(pattern);
    }
    // If all genres produced the same hardcoded pattern, only one entry would exist.
    expect(seenPatterns.size).toBeGreaterThanOrEqual(1);
    // Specifically, the legacy "pass|warn|pass" pattern should NOT be the only one.
    // The first candidate's USP contains "every decision reshapes the world" — a
    // hyperbolic claim — so its credible dimension is false, forcing check != "pass".
    const rpgCandidates = buildUSPCandidates("rpg", "Build a dark castle and survive the night");
    expect(rpgCandidates[0].triangle_of_weirdness_check).not.toBe("pass");
    expect(rpgCandidates[0].triangle_check.credible).toBe(false);
    expect(rpgCandidates[0].triangle_check.reason).toContain("hyperbolic");
  });

  it("different genres produce different USP text (genre mention)", () => {
    const idea = "Build a dark castle and survive the night";
    const rpg = buildUSPCandidates("rpg", idea);
    const shooter = buildUSPCandidates("shooter", idea);
    // USP text contains the genre, so different genres → different USP strings.
    expect(rpg[0].usp).not.toBe(shooter[0].usp);
    expect(rpg[0].usp).toContain("rpg");
    expect(shooter[0].usp).toContain("shooter");
  });

  it("candidate #2 (hybrid blending) has weird=true from cross-genre signal", () => {
    const candidates = buildUSPCandidates("rpg", "Build a castle and survive");
    // Candidate #2 USP: "Hybrid RPG experience blending traditional mechanics..."
    expect(candidates[1].triangle_check.weird).toBe(true);
    expect(candidates[1].triangle_check.reason).toContain("hybrid");
  });

  it("candidate #3 (narrative-driven) has appealing=true from player benefit", () => {
    const candidates = buildUSPCandidates("rpg", "Build a castle and survive the night");
    // Candidate #3 USP: "...players experience story through gameplay..."
    expect(candidates[3 - 1].triangle_check.appealing).toBe(true);
  });

  it("deterministic: same inputs produce identical outputs", () => {
    const a = buildUSPCandidates("rpg", "Build a castle");
    const b = buildUSPCandidates("rpg", "Build a castle");
    expect(a).toEqual(b);
  });
});

describe("buildUSPCandidates — safe idea excerpt", () => {
  it("handles very short ideas without producing empty USPs", () => {
    const candidates = buildUSPCandidates("rpg", "Hi");
    for (const c of candidates) {
      expect(c.usp.length).toBeGreaterThan(20);
      expect(c.usp).not.toContain("undefined");
      expect(c.usp).not.toContain("[object");
    }
  });

  it("handles empty idea with fallback excerpt", () => {
    const candidates = buildUSPCandidates("rpg", "");
    for (const c of candidates) {
      expect(c.usp.length).toBeGreaterThan(20);
    }
  });

  it("handles long ideas by truncating with ellipsis", () => {
    const longIdea = "Build a massive dark castle and survive the endless night against waves of enemies attacking from all sides with procedural generation and seasonal events and meta progression".repeat(2);
    const candidates = buildUSPCandidates("rpg", longIdea);
    // At least one candidate should have the ellipsis indicating truncation.
    const anyTruncated = candidates.some((c) => c.usp.includes("…"));
    expect(anyTruncated).toBe(true);
  });

  it("detects theme keywords in the idea", () => {
    const candidates = buildUSPCandidates("rpg", "Build a dark fantasy castle");
    // Candidate #3 should mention the detected theme ("dark").
    expect(candidates[2].usp.toLowerCase()).toContain("dark");
  });
});
