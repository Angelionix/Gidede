import { describe, expect, it } from "vitest";
import {
  ALGORITHM_METHODS,
  getStageAlgorithmMetadata,
  type AlgorithmStage,
} from "./algorithm-metadata";

const STAGES: AlgorithmStage[] = [
  "concept",
  "core_loop",
  "mda",
  "balance",
  "progression",
  "economy",
  "gdd",
  "validation",
];

describe("algorithm score metadata", () => {
  it("exposes the complete, closed method taxonomy", () => {
    expect(ALGORITHM_METHODS).toEqual([
      "template",
      "heuristic",
      "simulation",
      "solver",
      "playtest_evidence",
      "llm_generated",
    ]);
  });

  it("documents score provenance for every pipeline stage", () => {
    for (const stage of STAGES) {
      const metadata = getStageAlgorithmMetadata(stage);
      expect(metadata.taxonomy_version).toBe(1);
      expect(Object.keys(metadata.scores).length, stage).toBeGreaterThan(0);

      for (const [path, provenance] of Object.entries(metadata.scores)) {
        expect(path.trim(), stage).not.toBe("");
        expect(ALGORITHM_METHODS).toContain(provenance.method);
        expect(provenance.assumptions.length, `${stage}:${path}`).toBeGreaterThan(0);
        for (const assumption of provenance.assumptions) {
          expect(assumption.trim(), `${stage}:${path}`).not.toBe("");
        }
      }
    }
  });

  it("does not mislabel current heuristic stages as solver or playtest evidence", () => {
    const currentMethods = STAGES.flatMap((stage) =>
      Object.values(getStageAlgorithmMetadata(stage).scores).map((item) => item.method),
    );

    expect(currentMethods).not.toContain("solver");
    expect(currentMethods).not.toContain("playtest_evidence");
    expect(currentMethods).not.toContain("llm_generated");
    expect(currentMethods).toContain("template");
    expect(currentMethods).toContain("heuristic");
    expect(currentMethods).toContain("simulation");
  });
});
