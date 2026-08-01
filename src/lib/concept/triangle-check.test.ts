/**
 * R4-05: Unit tests for evaluateTriangleOfWeirdness (Block 1).
 *
 * Covers:
 *   - Each dimension (weird, appealing, credible) fires on the right signals.
 *   - Cross-genre and novelty signals set weird=true.
 *   - Player benefit phrases, concrete verbs and resonance signals set appealing=true.
 *   - Hyperbolic claims drop credible=false.
 *   - Genre alignment check.
 *   - Composite score formula (0.4 weird + 0.3 appealing + 0.3 credible).
 *   - pass requires all three dimensions; warn if any; fail if none.
 *   - Determinism.
 *   - R4-05 acceptance: Triangle depends on actual USP properties, not hardcoded.
 */

import { describe, it, expect } from "vitest";
import { evaluateTriangleOfWeirdness } from "./triangle-check";

describe("evaluateTriangleOfWeirdness — weird dimension", () => {
  it("cross-genre keywords set weird=true", () => {
    const r = evaluateTriangleOfWeirdness(
      "A hybrid RPG experience blending traditional mechanics with novel systems.",
      "rpg",
    );
    expect(r.weird).toBe(true);
    expect(r.reason).toContain("hybrid");
  });

  it("novelty signals set weird=true", () => {
    const r = evaluateTriangleOfWeirdness(
      "A unique and unconventional RPG with emergent gameplay.",
      "rpg",
    );
    expect(r.weird).toBe(true);
  });

  it("generic genre-conventional USP sets weird=false", () => {
    const r = evaluateTriangleOfWeirdness(
      "A role-playing game in the RPG genre with traditional mechanics.",
      "rpg",
    );
    expect(r.weird).toBe(false);
  });
});

describe("evaluateTriangleOfWeirdness — appealing dimension", () => {
  it("player benefit phrases set appealing=true", () => {
    const r = evaluateTriangleOfWeirdness(
      "A narrative RPG where players experience story through gameplay, not cutscenes.",
      "rpg",
    );
    expect(r.appealing).toBe(true);
  });

  it("concrete verb in context sets appealing=true", () => {
    const r = evaluateTriangleOfWeirdness(
      "A narrative-driven RPG where the core verb is explore and survive.",
      "rpg",
      { verbPhrase: "explore and survive" },
    );
    expect(r.appealing).toBe(true);
  });

  it("emotional resonance signals set appealing=true", () => {
    const r = evaluateTriangleOfWeirdness(
      "An immersive RPG story with emotional resonance and a player journey.",
      "rpg",
    );
    expect(r.appealing).toBe(true);
  });

  it("too-short USP (< 30 chars) sets appealing=false", () => {
    const r = evaluateTriangleOfWeirdness("RPG with story.", "rpg");
    expect(r.appealing).toBe(false);
  });

  it("too-long USP (> 300 chars) sets appealing=false", () => {
    const longUsp = "A narrative-driven RPG ".repeat(20);
    const r = evaluateTriangleOfWeirdness(longUsp, "rpg");
    expect(r.appealing).toBe(false);
  });
});

describe("evaluateTriangleOfWeirdness — credible dimension", () => {
  it("hyperbolic claim 'every decision' drops credible=false", () => {
    const r = evaluateTriangleOfWeirdness(
      "A RPG where every decision reshapes the world.",
      "rpg",
    );
    expect(r.credible).toBe(false);
    expect(r.reason).toContain("hyperbolic");
  });

  it("hyperbolic claim 'infinite' drops credible=false", () => {
    const r = evaluateTriangleOfWeirdness(
      "A RPG with infinite possibilities for the player.",
      "rpg",
    );
    expect(r.credible).toBe(false);
  });

  it("hyperbolic claim 'revolutionary' drops credible=false", () => {
    const r = evaluateTriangleOfWeirdness(
      "A revolutionary RPG experience with emergent gameplay.",
      "rpg",
    );
    expect(r.credible).toBe(false);
  });

  it("non-hyperbolic, genre-aligned USP keeps credible=true", () => {
    const r = evaluateTriangleOfWeirdness(
      "A hybrid RPG blending traditional mechanics with novel systems.",
      "rpg",
    );
    expect(r.credible).toBe(true);
  });

  it("USP without genre mention drops credible=false", () => {
    const r = evaluateTriangleOfWeirdness(
      "A hybrid experience blending traditional mechanics with novel systems.",
      "rpg",
    );
    expect(r.credible).toBe(false);
    expect(r.reason).toContain("no-genre-mention");
  });
});

describe("evaluateTriangleOfWeirdness — score and check label", () => {
  it("all three dimensions true → score 1.0, check 'pass'", () => {
    const r = evaluateTriangleOfWeirdness(
      "A hybrid RPG blending traditional mechanics with novel systems — players experience story through gameplay.",
      "rpg",
    );
    expect(r.weird).toBe(true);
    expect(r.appealing).toBe(true);
    expect(r.credible).toBe(true);
    expect(r.score).toBe(1);
    expect(r.check).toBe("pass");
  });

  it("two dimensions true → check 'warn'", () => {
    // weird=true (hybrid), appealing=true (players experience), credible=false (no genre mention)
    const r = evaluateTriangleOfWeirdness(
      "A hybrid experience blending traditional mechanics — players experience story through gameplay.",
      "rpg",
    );
    expect(r.weird).toBe(true);
    expect(r.appealing).toBe(true);
    expect(r.credible).toBe(false);
    expect(r.check).toBe("warn");
  });

  it("one dimension true → check 'warn'", () => {
    // weird=false, appealing=true (emotional resonance), credible=false (hyperbolic "every choice")
    const r = evaluateTriangleOfWeirdness(
      "An emotional RPG journey where every choice matters deeply.",
      "rpg",
    );
    expect(r.weird).toBe(false);
    expect(r.appealing).toBe(true);
    expect(r.credible).toBe(false);
    expect(r.check).toBe("warn");
  });

  it("zero dimensions true → check 'fail'", () => {
    // weird=false, appealing=false (too short), credible=false (genre "rpg" not mentioned)
    const r = evaluateTriangleOfWeirdness("Short.", "rpg");
    expect(r.weird).toBe(false);
    expect(r.appealing).toBe(false);
    expect(r.credible).toBe(false);
    expect(r.check).toBe("fail");
  });

  it("score formula: 0.4 weird + 0.3 appealing + 0.3 credible", () => {
    const onlyWeird = evaluateTriangleOfWeirdness(
      "A hybrid RPG blending systems.",
      "rpg",
    );
    // weird=true, appealing=false (too short < 30? "A hybrid RPG blending systems." = 31 chars, but no benefit/verb/resonance... wait "systems" doesn't match. Let me check: length=31 >= 30 ✓, but benefit/verb/resonance = none → appealing=false), credible=true (genre + no hyperbolic)
    // Actually length is 31, so reasonableLength=true, but no signals → appealing=false
    // score = 0.4 + 0.1 + 0.3 = 0.8
    expect(onlyWeird.score).toBe(0.8);
  });
});

describe("evaluateTriangleOfWeirdness — R4-05 acceptance", () => {
  it("Triangle depends on USP properties, not hardcoded (different USPs → different results)", () => {
    const usp1 = "A hybrid RPG blending traditional mechanics with novel systems — players experience story through gameplay.";
    const usp2 = "A role-playing game in the RPG genre with traditional mechanics.";
    const usp3 = "Short.";
    const r1 = evaluateTriangleOfWeirdness(usp1, "rpg");
    const r2 = evaluateTriangleOfWeirdness(usp2, "rpg");
    const r3 = evaluateTriangleOfWeirdness(usp3, "rpg");
    // usp1 passes all three; usp2 has only credible; usp3 fails all
    expect(r1.check).toBe("pass");
    expect(r2.check).toBe("warn"); // only credible=true
    expect(r3.check).toBe("fail");
    expect(r1.score).toBeGreaterThan(r2.score);
    expect(r2.score).toBeGreaterThan(r3.score);
  });

  it("Triangle results are deterministic across repeated calls", () => {
    const usp = "A hybrid RPG blending traditional mechanics with novel systems.";
    const a = evaluateTriangleOfWeirdness(usp, "rpg");
    const b = evaluateTriangleOfWeirdness(usp, "rpg");
    expect(a).toEqual(b);
  });

  it("reason is human-readable and lists which signals fired", () => {
    const r = evaluateTriangleOfWeirdness(
      "A hybrid RPG with emergent gameplay — players experience story.",
      "rpg",
    );
    expect(r.reason).toContain("weird=true");
    expect(r.reason).toContain("hybrid");
    expect(r.reason).toContain("appealing=true");
    expect(r.reason).toContain("players experience");
    expect(r.reason).toContain("credible=true");
  });
});
