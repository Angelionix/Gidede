/**
 * R4-10: Unit tests for Bond matrix from artifact evidence.
 *
 * Covers:
 *   - Matrix cells filled from real artifact data (mechanic names, USP, platforms).
 *   - Dissonance detection: cozy+combat, intense+no-combat, horror+fellowship, VR+social, empty base, ludonarrative.
 *   - Row/column consistency scores reflect actual dissonance count (not compatibility transform).
 *   - Overall consistency aggregates row+column.
 *   - Determinism.
 *   - R4-10 acceptance: cells from artifacts, dissonances from concrete pairs.
 */

import { describe, it, expect } from "vitest";
import {
  buildBondMatrixFromArtifacts,
  detectBondDissonances,
  buildBondValidationFromArtifacts,
  type BondArtifactEvidence,
} from "./bond-matrix";

function makeEvidence(overrides: Partial<BondArtifactEvidence> = {}): BondArtifactEvidence {
  return {
    mechanicSet: {
      base: [{ mechanic_name: "Изучение мира" }, { mechanic_name: "Инвентарь" }],
      combat: [{ mechanic_name: "Броня" }, { mechanic_name: "Запас патронов" }],
      progression: [{ mechanic_name: "Очки опыта" }],
      spatial: [{ mechanic_name: "Карта" }],
      social: [{ mechanic_name: "Лидерборд" }],
    },
    aesthetics: { primary: "challenge", secondary: "fantasy", tertiary: "discovery" },
    usp: "A dark RPG where every decision reshapes the world",
    genre: "rpg",
    platforms: ["PC"],
    predictedAesthetics: { challenge: 0.8, fantasy: 0.6, discovery: 0.4 },
    ...overrides,
  };
}

describe("buildBondMatrixFromArtifacts — cells from real artifacts", () => {
  it("fills Механика → Фиксированный with actual base mechanic names", () => {
    const matrix = buildBondMatrixFromArtifacts(makeEvidence());
    const cell = matrix.find((c) => c.element === "Механика" && c.level === "Фиксированный");
    expect(cell).toBeDefined();
    expect(cell!.content).toContain("Изучение мира");
    expect(cell!.content).toContain("Инвентарь");
  });

  it("fills История → Фиксированный with the concept USP", () => {
    const matrix = buildBondMatrixFromArtifacts(makeEvidence({ usp: "Unique selling proposition text" }));
    const cell = matrix.find((c) => c.element === "История" && c.level === "Фиксированный");
    expect(cell).toBeDefined();
    expect(cell!.content).toContain("Unique selling proposition text");
  });

  it("fills Эстетика → Фиксированный with the target aesthetic", () => {
    const matrix = buildBondMatrixFromArtifacts(makeEvidence());
    const cell = matrix.find((c) => c.element === "Эстетика" && c.level === "Фиксированный");
    expect(cell).toBeDefined();
    expect(cell!.content).toContain("challenge");
    expect(cell!.content).toContain("fantasy");
  });

  it("fills Технология → Фиксированный with the platform list", () => {
    const matrix = buildBondMatrixFromArtifacts(makeEvidence({ platforms: ["PC", "VR"] }));
    const cell = matrix.find((c) => c.element === "Технология" && c.level === "Фиксированный");
    expect(cell).toBeDefined();
    expect(cell!.content).toContain("PC");
    expect(cell!.content).toContain("VR");
  });

  it("fills Эстетика → Динамический with top predicted aesthetics", () => {
    const matrix = buildBondMatrixFromArtifacts(makeEvidence({
      predictedAesthetics: { challenge: 0.9, fantasy: 0.7, discovery: 0.3 },
    }));
    const cell = matrix.find((c) => c.element === "Эстетика" && c.level === "Динамический");
    expect(cell).toBeDefined();
    expect(cell!.content).toContain("challenge");
    expect(cell!.content).toContain("90%");
  });

  it("falls back to 'недостаточно данных' when predictedAesthetics is absent", () => {
    const matrix = buildBondMatrixFromArtifacts(makeEvidence({ predictedAesthetics: undefined }));
    const cell = matrix.find((c) => c.element === "Эстетика" && c.level === "Динамический");
    expect(cell!.content).toContain("недостаточно данных");
  });

  it("produces exactly 12 cells (4 elements × 3 levels)", () => {
    const matrix = buildBondMatrixFromArtifacts(makeEvidence());
    expect(matrix).toHaveLength(12);
  });

  it("handles empty mechanic set gracefully", () => {
    const matrix = buildBondMatrixFromArtifacts(makeEvidence({
      mechanicSet: { base: [], combat: [], progression: [], spatial: [], social: [] },
    }));
    const cell = matrix.find((c) => c.element === "Механика" && c.level === "Фиксированный");
    expect(cell!.content).toContain("не определены");
  });
});

describe("detectBondDissonances — concrete incompatible pairs", () => {
  it("flags cozy aesthetic + combat-heavy mechanics", () => {
    const dissonances = detectBondDissonances(makeEvidence({
      aesthetics: { primary: "submission", secondary: "expression", tertiary: "discovery" },
      mechanicSet: {
        base: [{ mechanic_name: "a" }],
        combat: [{ mechanic_name: "c1" }, { mechanic_name: "c2" }, { mechanic_name: "c3" }],
        progression: [], spatial: [], social: [],
      },
    }));
    const cozy = dissonances.find((d) => d.issue.includes("Cozy"));
    expect(cozy).toBeDefined();
    expect(cozy!.pair.a).toBe("aesthetic:submission");
    expect(cozy!.pair.b).toBe("combat_count:3");
  });

  it("flags intense aesthetic + no combat mechanics (critical)", () => {
    const dissonances = detectBondDissonances(makeEvidence({
      aesthetics: { primary: "challenge", secondary: "sensation", tertiary: "discovery" },
      mechanicSet: {
        base: [{ mechanic_name: "a" }],
        combat: [],
        progression: [], spatial: [], social: [],
      },
    }));
    const intense = dissonances.find((d) => d.issue.includes("Intense"));
    expect(intense).toBeDefined();
    expect(intense!.severity).toBe("critical");
    expect(intense!.pair.b).toBe("combat:empty");
  });

  it("flags horror genre + fellowship aesthetic", () => {
    const dissonances = detectBondDissonances(makeEvidence({
      genre: "horror",
      aesthetics: { primary: "fellowship", secondary: "challenge", tertiary: "discovery" },
    }));
    const horror = dissonances.find((d) => d.issue.includes("хоррор"));
    expect(horror).toBeDefined();
    expect(horror!.pair.a).toBe("genre:horror");
    expect(horror!.pair.b).toBe("aesthetic:fellowship");
  });

  it("flags VR platform + many social mechanics", () => {
    const dissonances = detectBondDissonances(makeEvidence({
      platforms: ["VR"],
      mechanicSet: {
        base: [{ mechanic_name: "a" }],
        combat: [],
        progression: [],
        spatial: [],
        social: [{ mechanic_name: "s1" }, { mechanic_name: "s2" }, { mechanic_name: "s3" }],
      },
    }));
    const vr = dissonances.find((d) => d.issue.includes("VR"));
    expect(vr).toBeDefined();
    expect(vr!.pair.a).toBe("platform:VR");
  });

  it("flags empty base category (critical)", () => {
    const dissonances = detectBondDissonances(makeEvidence({
      mechanicSet: {
        base: [],
        combat: [{ mechanic_name: "c1" }],
        progression: [], spatial: [], social: [],
      },
    }));
    const empty = dissonances.find((d) => d.issue.includes("base пуста"));
    expect(empty).toBeDefined();
    expect(empty!.severity).toBe("critical");
  });

  it("flags ludonarrative dissonance when target aesthetic not in top-3 predicted", () => {
    const dissonances = detectBondDissonances(makeEvidence({
      aesthetics: { primary: "submission", secondary: "expression", tertiary: "discovery" },
      predictedAesthetics: { challenge: 0.9, fantasy: 0.8, narrative: 0.7 },
    }));
    const ludo = dissonances.find((d) => d.issue.includes("ludonarrative"));
    expect(ludo).toBeDefined();
    expect(ludo!.pair.a).toBe("target:submission");
  });

  it("returns no dissonances for a well-aligned concept", () => {
    const dissonances = detectBondDissonances(makeEvidence({
      aesthetics: { primary: "challenge", secondary: "fantasy", tertiary: "discovery" },
      genre: "rpg",
      platforms: ["PC"],
      predictedAesthetics: { challenge: 0.9, fantasy: 0.7, discovery: 0.5 },
      mechanicSet: {
        base: [{ mechanic_name: "a" }, { mechanic_name: "b" }],
        combat: [{ mechanic_name: "c1" }],
        progression: [{ mechanic_name: "p1" }],
        spatial: [{ mechanic_name: "s1" }],
        social: [{ mechanic_name: "soc1" }],
      },
    }));
    expect(dissonances).toHaveLength(0);
  });
});

describe("buildBondValidationFromArtifacts — consistency scores", () => {
  it("row consistency scores reflect actual dissonance count (not compatibility)", () => {
    const result = buildBondValidationFromArtifacts(makeEvidence({
      aesthetics: { primary: "challenge", secondary: "fantasy", tertiary: "discovery" },
      mechanicSet: {
        base: [],
        combat: [],
        progression: [], spatial: [], social: [],
      },
    }));
    // base empty + intense+no-combat → 2 dissonances in Механика column
    const mechCol = result.col_consistency.find((c) => c.element === "Механика");
    expect(mechCol!.score).toBeLessThan(1);
    expect(mechCol!.dissonances.length).toBeGreaterThan(0);
  });

  it("overall_consistency is lower when dissonances exist", () => {
    const clean = buildBondValidationFromArtifacts(makeEvidence({
      aesthetics: { primary: "challenge", secondary: "fantasy", tertiary: "discovery" },
      predictedAesthetics: { challenge: 0.9, fantasy: 0.7, discovery: 0.5 },
      mechanicSet: {
        base: [{ mechanic_name: "a" }],
        combat: [{ mechanic_name: "c1" }],
        progression: [], spatial: [], social: [],
      },
    }));
    const dissonant = buildBondValidationFromArtifacts(makeEvidence({
      aesthetics: { primary: "submission", secondary: "expression", tertiary: "discovery" },
      mechanicSet: {
        base: [],
        combat: [{ mechanic_name: "c1" }, { mechanic_name: "c2" }, { mechanic_name: "c3" }],
        progression: [], spatial: [], social: [],
      },
    }));
    expect(dissonant.overall_consistency).toBeLessThan(clean.overall_consistency);
  });

  it("dissonances array is populated (not always empty)", () => {
    const result = buildBondValidationFromArtifacts(makeEvidence({
      aesthetics: { primary: "challenge", secondary: "fantasy", tertiary: "discovery" },
      mechanicSet: {
        base: [],
        combat: [],
        progression: [], spatial: [], social: [],
      },
    }));
    expect(result.dissonances.length).toBeGreaterThan(0);
  });

  it("marks matrix cells with has_dissonance=true when they have dissonances", () => {
    const result = buildBondValidationFromArtifacts(makeEvidence({
      aesthetics: { primary: "challenge", secondary: "fantasy", tertiary: "discovery" },
      mechanicSet: {
        base: [],
        combat: [],
        progression: [], spatial: [], social: [],
      },
    }));
    const markedCells = result.matrix.filter((c) => c.has_dissonance);
    expect(markedCells.length).toBeGreaterThan(0);
  });

  it("is deterministic: same inputs → same output", () => {
    const evidence = makeEvidence();
    const a = buildBondValidationFromArtifacts(evidence);
    const b = buildBondValidationFromArtifacts(evidence);
    expect(a).toEqual(b);
  });
});

describe("R4-10 acceptance: Bond matrix from artifact evidence", () => {
  it("matrix cells reference actual artifact data, not hardcoded strings", () => {
    const matrix = buildBondMatrixFromArtifacts(makeEvidence({
      usp: "My specific USP text",
      platforms: ["Switch", "Mobile"],
    }));
    const storyFixed = matrix.find((c) => c.element === "История" && c.level === "Фиксированный");
    expect(storyFixed!.content).toContain("My specific USP text");
    const techFixed = matrix.find((c) => c.element === "Технология" && c.level === "Фиксированный");
    expect(techFixed!.content).toContain("Switch");
    expect(techFixed!.content).toContain("Mobile");
  });

  it("dissonances are created from concrete incompatible pairs (not always empty)", () => {
    const dissonances = detectBondDissonances(makeEvidence({
      aesthetics: { primary: "submission", secondary: "expression", tertiary: "discovery" },
      mechanicSet: {
        base: [{ mechanic_name: "a" }],
        combat: [{ mechanic_name: "c1" }, { mechanic_name: "c2" }, { mechanic_name: "c3" }],
        progression: [], spatial: [], social: [],
      },
    }));
    expect(dissonances.length).toBeGreaterThan(0);
    // Each dissonance has a concrete pair.
    for (const d of dissonances) {
      expect(d.pair.a).toBeTruthy();
      expect(d.pair.b).toBeTruthy();
      expect(d.severity).toMatch(/warning|critical/);
    }
  });

  it("consistency scores change with dissonance count (not a fixed transform)", () => {
    const clean = buildBondValidationFromArtifacts(makeEvidence({
      aesthetics: { primary: "challenge", secondary: "fantasy", tertiary: "discovery" },
      predictedAesthetics: { challenge: 0.9, fantasy: 0.7, discovery: 0.5 },
      mechanicSet: {
        base: [{ mechanic_name: "a" }],
        combat: [{ mechanic_name: "c1" }],
        progression: [], spatial: [], social: [],
      },
    }));
    const dissonant = buildBondValidationFromArtifacts(makeEvidence({
      aesthetics: { primary: "submission", secondary: "expression", tertiary: "discovery" },
      mechanicSet: {
        base: [],
        combat: [{ mechanic_name: "c1" }, { mechanic_name: "c2" }, { mechanic_name: "c3" }],
        progression: [], spatial: [], social: [],
      },
    }));
    expect(clean.overall_consistency).not.toBe(dissonant.overall_consistency);
    expect(clean.overall_consistency).toBeGreaterThan(dissonant.overall_consistency);
  });
});
