import { describe, expect, it } from "vitest";
import { createArtifactEnvelope } from "@/lib/contracts/artifact-envelope";
import { CONTRACT_STAGE_IDS } from "@/lib/contracts/stage-contracts";
import {
  parsePipelineFreshnessState,
  recordFreshArtifact,
} from "@/lib/pipeline-stale";
import { evaluatePipelineVersionCommit } from "./pipeline-versioning";

function acceptedPipelineState(): string {
  let state = parsePipelineFreshnessState(null);
  for (const stage of CONTRACT_STAGE_IDS) {
    state = recordFreshArtifact(
      state,
      stage,
      createArtifactEnvelope(stage, {}),
      true,
    );
  }
  return JSON.stringify(state);
}

describe("pipeline version commit decision", () => {
  it("commits only a successful run with a complete accepted fresh snapshot", () => {
    expect(evaluatePipelineVersionCommit("success", acceptedPipelineState())).toEqual({
      shouldCommit: true,
      reason: "ready",
      missingStages: [],
    });
  });

  it.each(["partial", "failed", "blocked", "needs_review"] as const)(
    "does not commit a %s run",
    (status) => {
      expect(evaluatePipelineVersionCommit(status, acceptedPipelineState())).toMatchObject({
        shouldCommit: false,
        reason: "run_not_successful",
      });
    },
  );

  it("does not commit when a persisted artifact is unaccepted", () => {
    let state = JSON.parse(acceptedPipelineState());
    state.artifacts.validation.acceptedAt = null;
    expect(evaluatePipelineVersionCommit("success", JSON.stringify(state))).toEqual({
      shouldCommit: false,
      reason: "artifacts_not_accepted_fresh",
      missingStages: ["validation"],
    });
  });

  it("does not commit when a downstream artifact is stale", () => {
    let state = parsePipelineFreshnessState(acceptedPipelineState());
    state = recordFreshArtifact(
      state,
      "concept",
      createArtifactEnvelope("concept", { changed: true }),
      true,
    );
    const decision = evaluatePipelineVersionCommit("success", JSON.stringify(state));
    expect(decision.shouldCommit).toBe(false);
    expect(decision.missingStages).toContain("core_loop");
    expect(decision.missingStages).toContain("validation");
  });
});
