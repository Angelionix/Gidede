import { describe, expect, it } from "vitest";
import {
  derivePipelineRunStatus,
  isSuccessfulRun,
  stageFailureStatus,
} from "./pipeline-run-status";

describe("pipeline run status", () => {
  it("maps transport and validation failures to domain statuses", () => {
    expect(stageFailureStatus(422)).toBe("needs_review");
    expect(stageFailureStatus(424)).toBe("blocked");
    expect(stageFailureStatus(500)).toBe("failed");
    expect(stageFailureStatus()).toBe("failed");
  });

  it("reports success only when every stage succeeds", () => {
    expect(derivePipelineRunStatus(["success", "success"])).toBe("success");
    expect(isSuccessfulRun("success")).toBe(true);
    expect(isSuccessfulRun("partial")).toBe(false);
  });

  it("does not mask downstream failures after useful output was produced", () => {
    expect(derivePipelineRunStatus(["success", "failed", "blocked"])).toBe("partial");
    expect(derivePipelineRunStatus(["success", "needs_review"])).toBe("partial");
  });

  it("preserves the actionable root status when no useful output exists", () => {
    expect(derivePipelineRunStatus(["failed", "blocked"])).toBe("failed");
    expect(derivePipelineRunStatus(["needs_review", "blocked"])).toBe("needs_review");
    expect(derivePipelineRunStatus(["blocked", "blocked"])).toBe("blocked");
    expect(derivePipelineRunStatus([])).toBe("failed");
  });
});
