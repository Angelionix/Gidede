import { describe, expect, it } from "vitest";
import { createArtifactEnvelope } from "@/lib/contracts/artifact-envelope";
import {
  downstreamStages,
  acceptedFreshCompletion,
  parsePipelineFreshnessState,
  reconcilePipelineFreshness,
  recordFreshArtifact,
  stageIsAcceptedFresh,
  stageIsStale,
} from "./pipeline-stale";

describe("pipeline stale propagation", () => {
  it("computes transitive descendants from the explicit dependency graph", () => {
    expect(downstreamStages("concept")).toEqual([
      "core_loop", "mda", "balance", "progression", "economy", "gdd", "validation",
    ]);
    expect(downstreamStages("progression")).toEqual(["economy", "gdd", "validation"]);
    expect(downstreamStages("validation")).toEqual([]);
  });

  it("marks every existing downstream artifact stale when Concept changes", () => {
    let state = parsePipelineFreshnessState(null);
    for (const stage of ["concept", "core_loop", "mda", "balance", "progression", "economy", "gdd", "validation"] as const) {
      state = recordFreshArtifact(state, stage, createArtifactEnvelope(stage, {}), true, "2026-08-01T12:00:00.000Z");
    }
    state = recordFreshArtifact(
      state,
      "concept",
      createArtifactEnvelope("concept", { idea: "changed" }),
      true,
      "2026-08-01T13:00:00.000Z",
    );
    expect(stageIsStale(state, "concept")).toBe(false);
    for (const stage of downstreamStages("concept")) expect(stageIsStale(state, stage)).toBe(true);
  });

  it("refreshing a stage clears only that stage while keeping its descendants stale", () => {
    let state = parsePipelineFreshnessState(null);
    state = recordFreshArtifact(state, "progression", createArtifactEnvelope("progression", {}), true);
    state = recordFreshArtifact(state, "economy", createArtifactEnvelope("economy", {}), true);
    state = recordFreshArtifact(state, "gdd", createArtifactEnvelope("gdd", {}), true);
    state = recordFreshArtifact(state, "progression", createArtifactEnvelope("progression", { changed: true }), true);
    expect(stageIsStale(state, "economy")).toBe(true);
    expect(stageIsStale(state, "gdd")).toBe(true);
    state = recordFreshArtifact(state, "economy", createArtifactEnvelope("economy", { changed: true }), true);
    expect(stageIsStale(state, "economy")).toBe(false);
    expect(stageIsStale(state, "gdd")).toBe(true);
  });

  it("bootstraps an old project and detects lineage mismatch without prior state", () => {
    const oldConcept = createArtifactEnvelope("concept", { idea: "old" });
    const newConcept = createArtifactEnvelope("concept", { idea: "new" });
    const core = createArtifactEnvelope("core_loop", {
      upstream_versions: { concept: `${oldConcept.artifactId}@${oldConcept.schemaVersion}` },
    });
    const state = reconcilePipelineFreshness(parsePipelineFreshnessState(null), {
      concept: { artifact: newConcept },
      core_loop: { artifact: core },
    }, "2026-08-01T14:00:00.000Z");
    expect(stageIsStale(state, "concept")).toBe(false);
    expect(stageIsStale(state, "core_loop")).toBe(true);
  });

  it("counts only accepted and non-stale artifacts toward completion", () => {
    let state = parsePipelineFreshnessState(null);
    state = recordFreshArtifact(state, "concept", createArtifactEnvelope("concept", {}), true);
    state = recordFreshArtifact(state, "core_loop", createArtifactEnvelope("core_loop", {}), true);
    expect(stageIsAcceptedFresh(state, "concept")).toBe(true);
    expect(stageIsAcceptedFresh(state, "core_loop")).toBe(true);
    expect(acceptedFreshCompletion(state)).toBe(24);

    state = recordFreshArtifact(state, "concept", createArtifactEnvelope("concept", { changed: true }), true);
    expect(stageIsAcceptedFresh(state, "core_loop")).toBe(false);
    expect(acceptedFreshCompletion(state)).toBe(12);

    state = recordFreshArtifact(state, "core_loop", createArtifactEnvelope("core_loop", { changed: true }), false);
    expect(stageIsAcceptedFresh(state, "core_loop")).toBe(false);
    expect(acceptedFreshCompletion(state)).toBe(12);
  });
});
