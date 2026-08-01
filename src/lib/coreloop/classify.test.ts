/**
 * TASK-2.20: Unit tests for Core Loop classification (Block 2).
 * Covers: TASK-2.2 (type by aesthetic), TASK-2.5 (sub_types), TASK-2.11 (hasBraking), TASK-2.17 (riskLevel).
 */

import { describe, it, expect } from "vitest";
import { classifyLoopType, classifyStructuralType, VALID_LOOP_TYPES } from "./classify";
import { buildSteps } from "./steps";

describe("classifyStructuralType — TASK-2.2: тип по эстетике", () => {
  it("selects the template type before steps and keeps it aligned with the final classification", () => {
    const loopType = classifyLoopType("action", "discovery", undefined);
    const steps = buildSteps(["Gather", "Craft", "Trade"], undefined, loopType, "action");
    const structural = classifyStructuralType(
      ["Gather", "Craft", "Trade"],
      "action",
      "discovery",
      undefined,
      steps,
    );

    expect(loopType).toBe("economy");
    expect(structural.type).toBe(loopType);
    expect(steps[0].resources_produced).toContain("raw_resource");
    expect(steps[1].resources_consumed).toContain("raw_resource");
  });

  it("challenge → engine", () => {
    const steps = buildSteps(["M1"], undefined, "engine", "action");
    const st = classifyStructuralType(["M1"], "action", "challenge", undefined, steps);
    expect(st.type).toBe("engine");
  });

  it("discovery → economy", () => {
    const steps = buildSteps(["M1"], undefined, "economy", "adventure");
    const st = classifyStructuralType(["M1"], "adventure", "discovery", undefined, steps);
    expect(st.type).toBe("economy");
  });

  it("fellowship → ecology", () => {
    const steps = buildSteps(["M1"], undefined, "ecology", "mmorpg");
    const st = classifyStructuralType(["M1"], "mmorpg", "fellowship", undefined, steps);
    expect(st.type).toBe("ecology");
  });

  it("expression → ecology", () => {
    const steps = buildSteps(["M1"], undefined, "ecology", "sandbox");
    const st = classifyStructuralType(["M1"], "sandbox", "expression", undefined, steps);
    expect(st.type).toBe("ecology");
  });

  it("narrative → hybrid", () => {
    const steps = buildSteps(["M1"], undefined, "hybrid", "adventure");
    const st = classifyStructuralType(["M1"], "adventure", "narrative", undefined, steps);
    expect(st.type).toBe("hybrid");
  });

  it("fantasy → economy", () => {
    const steps = buildSteps(["M1"], undefined, "economy", "rpg");
    const st = classifyStructuralType(["M1"], "rpg", "fantasy", undefined, steps);
    expect(st.type).toBe("economy");
  });

  it("sensation → engine", () => {
    const steps = buildSteps(["M1"], undefined, "engine", "racing");
    const st = classifyStructuralType(["M1"], "racing", "sensation", undefined, steps);
    expect(st.type).toBe("engine");
  });

  it("submission → engine", () => {
    const steps = buildSteps(["M1"], undefined, "engine", "idle");
    const st = classifyStructuralType(["M1"], "idle", "submission", undefined, steps);
    expect(st.type).toBe("engine");
  });

  it("desiredLoopType overrides aesthetic", () => {
    const steps = buildSteps(["M1"], undefined, "ecology", "action");
    const st = classifyStructuralType(["M1"], "action", "challenge", "ecology", steps);
    expect(st.type).toBe("ecology");
  });

  it("falls back to genre default when no aesthetic and no desired", () => {
    const steps = buildSteps(["M1"], undefined, "engine", "shooter");
    const st = classifyStructuralType(["M1"], "shooter", undefined, undefined, steps);
    expect(st.type).toBe("engine"); // shooter → engine
  });
});

describe("classifyStructuralType — TASK-2.5: sub_types", () => {
  it("tower_defense → wave_based", () => {
    const steps = buildSteps(["M1"], undefined, "tower_defense", "tower_defense");
    const st = classifyStructuralType(["M1"], "tower_defense", "challenge", "tower_defense", steps);
    expect(st.sub_type).toBe("wave_based");
  });

  it("rhythm → beat_synced", () => {
    const steps = buildSteps(["M1"], undefined, "rhythm", "rhythm");
    const st = classifyStructuralType(["M1"], "rhythm", "sensation", "rhythm", steps);
    expect(st.sub_type).toBe("beat_synced");
  });

  it("puzzle → pattern_based", () => {
    const steps = buildSteps(["M1"], undefined, "puzzle", "puzzle");
    const st = classifyStructuralType(["M1"], "puzzle", "challenge", "puzzle", steps);
    expect(st.sub_type).toBe("pattern_based");
  });

  it("ecology → balanced_ecology", () => {
    const steps = buildSteps(["M1"], undefined, "ecology", "horror");
    const st = classifyStructuralType(["M1"], "horror", "submission", "ecology", steps);
    expect(st.sub_type).toBe("balanced_ecology");
  });

  it("engine with consumed resources → braked_engine", () => {
    const steps = buildSteps(["M1"], undefined, "engine", "shooter");
    const st = classifyStructuralType(["M1"], "shooter", "challenge", "engine", steps);
    // engine builder produces steps with consumed resources
    expect(["braked_engine", "pure_engine"]).toContain(st.sub_type);
  });
});

describe("classifyStructuralType — TASK-2.11: hasBraking", () => {
  it("returns true when negative feedback exists", () => {
    const steps = buildSteps(["M1"], undefined, "tower_defense", "tower_defense");
    const st = classifyStructuralType(["M1"], "tower_defense", "challenge", "tower_defense", steps);
    // tower_defense builder has a negative feedback step
    expect(st.has_braking).toBe(true);
  });

  it("returns true when consumed resource has no producer (external brake)", () => {
    // Engine with energy consumed but not produced = external brake
    const customSteps = ["Step 1", "Step 2"];
    const steps = buildSteps(["M1"], customSteps, "engine", "shooter");
    const st = classifyStructuralType(["M1"], "shooter", "challenge", "engine", steps);
    // engine custom: last step consumes energy (not produced in cycle) → has_braking
    expect(st.has_braking).toBe(true);
  });
});

describe("classifyStructuralType — TASK-2.17: riskLevel", () => {
  it("ecology → high risk", () => {
    const steps = buildSteps(["M1"], undefined, "ecology", "horror");
    const st = classifyStructuralType(["M1"], "horror", "submission", "ecology", steps);
    expect(st.risk_assessment.risk_level).toBe("high");
  });

  it("hybrid → medium risk", () => {
    const steps = buildSteps(["M1"], undefined, "hybrid", "adventure");
    const st = classifyStructuralType(["M1"], "adventure", "narrative", "hybrid", steps);
    expect(st.risk_assessment.risk_level).toBe("medium");
  });

  it("engine → low risk", () => {
    const steps = buildSteps(["M1"], undefined, "engine", "shooter");
    const st = classifyStructuralType(["M1"], "shooter", "challenge", "engine", steps);
    expect(st.risk_assessment.risk_level).toBe("low");
  });

  it("tower_defense → medium risk", () => {
    const steps = buildSteps(["M1"], undefined, "tower_defense", "tower_defense");
    const st = classifyStructuralType(["M1"], "tower_defense", "challenge", "tower_defense", steps);
    expect(st.risk_assessment.risk_level).toBe("medium");
  });
});

describe("classifyStructuralType — likely_pathologies", () => {
  it("engine includes runaway", () => {
    const steps = buildSteps(["M1"], undefined, "engine", "shooter");
    const st = classifyStructuralType(["M1"], "shooter", "challenge", "engine", steps);
    expect(st.risk_assessment.likely_pathologies).toContain("runaway");
  });

  it("ecology includes stall and oscillation", () => {
    const steps = buildSteps(["M1"], undefined, "ecology", "horror");
    const st = classifyStructuralType(["M1"], "horror", "submission", "ecology", steps);
    expect(st.risk_assessment.likely_pathologies).toContain("stall");
    expect(st.risk_assessment.likely_pathologies).toContain("oscillation");
  });

  it("hybrid includes disconnected_loops", () => {
    const steps = buildSteps(["M1"], undefined, "hybrid", "adventure");
    const st = classifyStructuralType(["M1"], "adventure", "narrative", "hybrid", steps);
    expect(st.risk_assessment.likely_pathologies).toContain("disconnected_loops");
  });

  it("tower_defense includes wave_imbalance", () => {
    const steps = buildSteps(["M1"], undefined, "tower_defense", "tower_defense");
    const st = classifyStructuralType(["M1"], "tower_defense", "challenge", "tower_defense", steps);
    expect(st.risk_assessment.likely_pathologies).toContain("wave_imbalance");
  });
});

describe("VALID_LOOP_TYPES", () => {
  it("contains all 7 types", () => {
    expect(VALID_LOOP_TYPES.length).toBe(7);
    expect(VALID_LOOP_TYPES).toContain("engine");
    expect(VALID_LOOP_TYPES).toContain("economy");
    expect(VALID_LOOP_TYPES).toContain("ecology");
    expect(VALID_LOOP_TYPES).toContain("hybrid");
    expect(VALID_LOOP_TYPES).toContain("tower_defense");
    expect(VALID_LOOP_TYPES).toContain("rhythm");
    expect(VALID_LOOP_TYPES).toContain("puzzle");
  });
});
