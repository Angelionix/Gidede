/**
 * R4-03: Unit tests for computeFeasibility (Block 1, Concept feasibility).
 *
 * Covers:
 *   - Legacy fallback when no constraints are supplied (backward compatibility).
 *   - Composite model activation when any constraint is supplied.
 *   - Each factor's effect on score and explanation.
 *   - Budget parsing: tier keywords, currency amounts, edge cases.
 *   - Platform complexity: known/unknown platforms, multi-platform penalty.
 *   - Team capacity: mechanics-per-developer thresholds.
 *   - Explainability: reason mentions active constraints, improvement targets weakest factor.
 *   - Determinism: same inputs produce identical outputs.
 */

import { describe, it, expect } from "vitest";
import { computeFeasibility, parseBudget } from "./feasibility";

const baseMechanicSet = {
  total_count: 12,
  compatibility_score: 86,
};

describe("computeFeasibility — legacy fallback (no constraints)", () => {
  it("returns compatibility-only score when no constraints are supplied", () => {
    const r = computeFeasibility(baseMechanicSet, {});
    expect(r.composite).toBe(false);
    expect(r.score).toBe(0.9); // compat 86 → 0.9 (legacy)
    expect(r.factors).toHaveLength(1);
    expect(r.factors[0].name).toBe("mechanics_compatibility");
    expect(r.factors[0].weight).toBe(1);
  });

  it("returns low legacy score for poor compatibility", () => {
    const r = computeFeasibility({ total_count: 3, compatibility_score: 30 }, {});
    expect(r.composite).toBe(false);
    expect(r.score).toBe(0.4);
  });

  it("returns medium legacy score for mid compatibility", () => {
    const r = computeFeasibility({ total_count: 6, compatibility_score: 65 }, {});
    expect(r.score).toBe(0.75);
  });

  it("ignores empty/whitespace constraints as 'no constraints'", () => {
    const r = computeFeasibility(baseMechanicSet, {
      budget: "   ",
      platform: [],
      team_size: 0,
    });
    expect(r.composite).toBe(false);
  });

  it("is deterministic across repeated calls", () => {
    const a = computeFeasibility(baseMechanicSet, { team_size: 4, budget: "low" });
    const b = computeFeasibility(baseMechanicSet, { team_size: 4, budget: "low" });
    expect(a).toEqual(b);
  });
});

describe("computeFeasibility — composite activation", () => {
  it("activates composite model when team_size is supplied", () => {
    const r = computeFeasibility(baseMechanicSet, { team_size: 5 });
    expect(r.composite).toBe(true);
    expect(r.factors).toHaveLength(4);
    expect(r.factors.map((f) => f.name)).toEqual([
      "mechanics_compatibility",
      "team_capacity",
      "budget",
      "platform_complexity",
    ]);
  });

  it("activates composite model when budget is supplied", () => {
    const r = computeFeasibility(baseMechanicSet, { budget: "medium" });
    expect(r.composite).toBe(true);
    expect(r.factors.find((f) => f.name === "budget")?.source).toBe("specified");
    expect(r.factors.find((f) => f.name === "team_capacity")?.source).toBe("default");
  });

  it("activates composite model when platform is supplied", () => {
    const r = computeFeasibility(baseMechanicSet, { platform: ["PC"] });
    expect(r.composite).toBe(true);
    expect(r.factors.find((f) => f.name === "platform_complexity")?.source).toBe("specified");
  });

  it("weights sum to 1 in composite mode", () => {
    const r = computeFeasibility(baseMechanicSet, { team_size: 5, budget: "high", platform: ["web"] });
    const sum = r.factors.reduce((s, f) => s + f.weight, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
  });

  it("score equals sum of factor contributions in composite mode", () => {
    const r = computeFeasibility(baseMechanicSet, { team_size: 5, budget: "high", platform: ["web"] });
    const sum = r.factors.reduce((s, f) => s + f.contribution, 0);
    expect(Math.abs(sum - r.score)).toBeLessThan(1e-9);
  });
});

describe("computeFeasibility — team capacity factor", () => {
  it("comfortable ratio (<=3 mech/dev) → 0.9", () => {
    const r = computeFeasibility({ total_count: 12, compatibility_score: 86 }, { team_size: 5 });
    // 12/5 = 2.4 → 0.9
    const team = r.factors.find((f) => f.name === "team_capacity")!;
    expect(team.score).toBe(0.9);
    expect(team.source).toBe("specified");
    expect(team.reason).toContain("12");
    expect(team.reason).toContain("5");
  });

  it("ok ratio (<=6 mech/dev) → 0.75", () => {
    const r = computeFeasibility({ total_count: 12, compatibility_score: 86 }, { team_size: 2 });
    // 12/2 = 6 → 0.75
    expect(r.factors.find((f) => f.name === "team_capacity")!.score).toBe(0.75);
  });

  it("stretched ratio (<=10 mech/dev) → 0.55", () => {
    const r = computeFeasibility({ total_count: 12, compatibility_score: 86 }, { team_size: 2 });
    // covered above; test boundary 12/2=6 is 0.75, so 10 mech, 1 dev → 10 → 0.55
    const r2 = computeFeasibility({ total_count: 10, compatibility_score: 86 }, { team_size: 1 });
    expect(r2.factors.find((f) => f.name === "team_capacity")!.score).toBe(0.55);
  });

  it("overloaded ratio (>10 mech/dev) → 0.35", () => {
    const r = computeFeasibility({ total_count: 12, compatibility_score: 86 }, { team_size: 1 });
    // 12/1 = 12 → 0.35
    expect(r.factors.find((f) => f.name === "team_capacity")!.score).toBe(0.35);
  });

  it("uses neutral default when team_size omitted in composite mode", () => {
    const r = computeFeasibility(baseMechanicSet, { budget: "medium" });
    const team = r.factors.find((f) => f.name === "team_capacity")!;
    expect(team.source).toBe("default");
    expect(team.score).toBe(0.65);
    expect(team.reason).toContain("team_size не указан");
  });

  it("larger team raises feasibility score vs small team (same mechanics)", () => {
    const small = computeFeasibility({ total_count: 12, compatibility_score: 86 }, { team_size: 1 });
    const large = computeFeasibility({ total_count: 12, compatibility_score: 86 }, { team_size: 10 });
    expect(large.score).toBeGreaterThan(small.score);
  });
});

describe("computeFeasibility — budget factor", () => {
  it("low tier → 0.5", () => {
    const r = computeFeasibility(baseMechanicSet, { budget: "low budget indie" });
    expect(r.factors.find((f) => f.name === "budget")!.score).toBe(0.5);
  });

  it("medium tier → 0.75", () => {
    const r = computeFeasibility(baseMechanicSet, { budget: "medium" });
    expect(r.factors.find((f) => f.name === "budget")!.score).toBe(0.75);
  });

  it("high tier → 0.9", () => {
    const r = computeFeasibility(baseMechanicSet, { budget: "AAA well-funded" });
    expect(r.factors.find((f) => f.name === "budget")!.score).toBe(0.9);
  });

  it("numeric amount < $50k → low tier", () => {
    const r = computeFeasibility(baseMechanicSet, { budget: "$25k" });
    expect(r.factors.find((f) => f.name === "budget")!.score).toBe(0.5);
  });

  it("numeric amount $50k–$1M → medium tier", () => {
    const r = computeFeasibility(baseMechanicSet, { budget: "$500,000" });
    expect(r.factors.find((f) => f.name === "budget")!.score).toBe(0.75);
  });

  it("numeric amount >= $1M → high tier", () => {
    const r = computeFeasibility(baseMechanicSet, { budget: "$2.5M" });
    expect(r.factors.find((f) => f.name === "budget")!.score).toBe(0.9);
  });

  it("higher budget raises feasibility score", () => {
    const low = computeFeasibility(baseMechanicSet, { budget: "low" });
    const high = computeFeasibility(baseMechanicSet, { budget: "high" });
    expect(high.score).toBeGreaterThan(low.score);
  });
});

describe("parseBudget — exhaustive budget parsing", () => {
  it("returns unspecified for empty/whitespace", () => {
    expect(parseBudget("").tier).toBe("unspecified");
    expect(parseBudget("   ").tier).toBe("unspecified");
    expect(parseBudget(undefined).tier).toBe("unspecified");
  });

  it("recognises tier keywords case-insensitively", () => {
    expect(parseBudget("LOW").tier).toBe("low");
    expect(parseBudget("Indie").tier).toBe("low");
    expect(parseBudget("bootstrapped").tier).toBe("low");
    expect(parseBudget("MEDIUM").tier).toBe("medium");
    expect(parseBudget("AA").tier).toBe("medium");
    expect(parseBudget("HIGH").tier).toBe("high");
    expect(parseBudget("AAA").tier).toBe("high");
    expect(parseBudget("triple-a").tier).toBe("high");
  });

  it("parses currency amounts with k/m suffixes", () => {
    expect(parseBudget("$50k").tier).toBe("medium"); // exactly 50000 → medium boundary
    expect(parseBudget("$1.5M").tier).toBe("high");
    expect(parseBudget("100000").tier).toBe("medium");
    expect(parseBudget("£200,000").tier).toBe("medium");
    expect(parseBudget("$1M").tier).toBe("high");
  });

  it("returns unspecified for unrecognized strings", () => {
    expect(parseBudget("some random text").tier).toBe("unspecified");
  });
});

describe("computeFeasibility — platform complexity factor", () => {
  it("web → 0.9 (simple)", () => {
    const r = computeFeasibility(baseMechanicSet, { platform: ["web"] });
    expect(r.factors.find((f) => f.name === "platform_complexity")!.score).toBe(0.9);
  });

  it("mobile → 0.8", () => {
    const r = computeFeasibility(baseMechanicSet, { platform: ["mobile"] });
    expect(r.factors.find((f) => f.name === "platform_complexity")!.score).toBe(0.8);
  });

  it("PC → 0.7", () => {
    const r = computeFeasibility(baseMechanicSet, { platform: ["PC"] });
    expect(r.factors.find((f) => f.name === "platform_complexity")!.score).toBe(0.7);
  });

  it("console → 0.5 (hard)", () => {
    const r = computeFeasibility(baseMechanicSet, { platform: ["PlayStation"] });
    expect(r.factors.find((f) => f.name === "platform_complexity")!.score).toBe(0.5);
  });

  it("VR → 0.4 (very hard)", () => {
    const r = computeFeasibility(baseMechanicSet, { platform: ["VR"] });
    expect(r.factors.find((f) => f.name === "platform_complexity")!.score).toBe(0.4);
  });

  it("unknown platform → 0.6 (moderate)", () => {
    const r = computeFeasibility(baseMechanicSet, { platform: ["quantum-computer"] });
    expect(r.factors.find((f) => f.name === "platform_complexity")!.score).toBe(0.6);
  });

  it("multi-platform applies 5% penalty per extra platform", () => {
    const single = computeFeasibility(baseMechanicSet, { platform: ["PC"] });
    const multi = computeFeasibility(baseMechanicSet, { platform: ["PC", "web", "mobile"] });
    // single PC = 0.7; multi avg = (0.7+0.9+0.8)/3 = 0.8; penalty 2*0.05=0.1 → 0.7
    expect(multi.factors.find((f) => f.name === "platform_complexity")!.score).toBeLessThan(
      single.factors.find((f) => f.name === "platform_complexity")!.score + 0.01,
    );
    expect(multi.factors.find((f) => f.name === "platform_complexity")!.reason).toContain("3 платформ");
  });

  it("uses neutral default when platform omitted", () => {
    const r = computeFeasibility(baseMechanicSet, { team_size: 5 });
    const pf = r.factors.find((f) => f.name === "platform_complexity")!;
    expect(pf.source).toBe("default");
    expect(pf.score).toBe(0.75);
  });

  it("filters out empty/whitespace platform entries", () => {
    const r = computeFeasibility(baseMechanicSet, { platform: ["PC", "  ", ""] });
    expect(r.composite).toBe(true);
    expect(r.factors.find((f) => f.name === "platform_complexity")!.source).toBe("specified");
  });
});

describe("computeFeasibility — explainability", () => {
  it("reason references only specified factors", () => {
    const r = computeFeasibility(baseMechanicSet, { team_size: 5, budget: "high" });
    // team_capacity factor reason contains the team size value
    expect(r.reason).toContain("5");
    expect(r.reason).toContain("budget");
    expect(r.reason).toContain("high");
    // platform default не должен упоминаться в reason (только specified)
    expect(r.reason).not.toContain("platform не указан");
  });

  it("improvement targets weakest specified factor (team_capacity)", () => {
    const r = computeFeasibility({ total_count: 20, compatibility_score: 86 }, { team_size: 1, budget: "high" });
    // team_capacity: 20/1 = 20 → 0.35 (weakest specified)
    expect(r.improvement).toContain("scope");
    expect(r.improvement).toContain("команд");
  });

  it("improvement targets budget when it is the weakest", () => {
    const r = computeFeasibility(baseMechanicSet, { team_size: 10, budget: "low", platform: ["web"] });
    // budget=0.5 < platform=0.9, team=0.9, compat=0.9
    expect(r.improvement).toContain("MVP");
  });

  it("improvement targets platform when it is the weakest", () => {
    const r = computeFeasibility(baseMechanicSet, { team_size: 10, budget: "high", platform: ["VR", "PlayStation", "Xbox"] });
    // multi-platform + hard platforms → lowest
    expect(r.improvement).toContain("платформ");
  });

  it("improvement recommends providing constraints when all defaults", () => {
    const r = computeFeasibility(baseMechanicSet, {});
    // legacy mode — improvement recommends providing constraints
    expect(r.improvement).toMatch(/team_size|budget|platform/);
  });

  it("reason explains compatibility factor in legacy mode", () => {
    const r = computeFeasibility({ total_count: 12, compatibility_score: 86 }, {});
    expect(r.reason).toContain("86%");
    expect(r.reason).toContain("constraints");
  });
});

describe("computeFeasibility — constraint change is explainable (R4-03 acceptance)", () => {
  it("changing team_size produces different score AND different reason", () => {
    const small = computeFeasibility({ total_count: 12, compatibility_score: 86 }, { team_size: 1 });
    const large = computeFeasibility({ total_count: 12, compatibility_score: 86 }, { team_size: 10 });
    expect(small.score).not.toBe(large.score);
    expect(small.reason).not.toBe(large.reason);
    expect(small.reason).toContain("1 чел");
    expect(large.reason).toContain("10 чел");
  });

  it("changing budget produces different score AND different reason", () => {
    const low = computeFeasibility(baseMechanicSet, { budget: "low" });
    const high = computeFeasibility(baseMechanicSet, { budget: "high" });
    expect(low.score).toBeLessThan(high.score);
    expect(low.reason).toContain("low");
    expect(high.reason).toContain("high");
  });

  it("changing platform produces different score AND different reason", () => {
    const web = computeFeasibility(baseMechanicSet, { platform: ["web"] });
    const console = computeFeasibility(baseMechanicSet, { platform: ["PlayStation"] });
    expect(web.score).toBeGreaterThan(console.score);
    expect(web.reason).toContain("web");
    expect(console.reason).toContain("PlayStation");
  });

  it("composite score is bounded in [0, 1]", () => {
    const extreme = computeFeasibility(
      { total_count: 100, compatibility_score: 100 },
      { team_size: 1, budget: "high", platform: ["VR"] },
    );
    expect(extreme.score).toBeGreaterThanOrEqual(0);
    expect(extreme.score).toBeLessThanOrEqual(1);
  });
});
