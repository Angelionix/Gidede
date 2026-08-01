import { describe, expect, it } from "vitest";
import {
  buildBlocks,
  derivePipelineNotifications,
  nextBlockToFill,
  type ProjectPipelineSnapshot,
} from "./pipeline-helpers";

function snapshot(pipelineState: string | null): ProjectPipelineSnapshot {
  return {
    projectId: "project-1",
    projectName: "Test project",
    projectDescription: "A sufficiently detailed project description",
    projectGenre: "puzzle",
    hasConcept: true,
    hasCoreLoop: true,
    hasMda: true,
    hasBalance: true,
    hasProgression: true,
    hasEconomy: true,
    hasGdd: true,
    hasChecklist: true,
    completionPercent: 100,
    currentStage: "validation",
    updatedAt: new Date("2026-08-01T12:00:00.000Z"),
    pipelineState,
  };
}

describe("pipeline block freshness", () => {
  it("does not treat legacy DB rows without accepted artifacts as completed", () => {
    const legacy = snapshot(null);
    expect(buildBlocks(legacy).find((item) => item.block_id === 1)?.status).toBe("in_progress");
    expect(nextBlockToFill(legacy)).toBe(1);
  });

  it("maps stale stage state to its owning block", () => {
    const state = JSON.stringify({
      version: 1,
      artifacts: {
        economy: {
          artifactId: "economy-1",
          schemaVersion: "1.0.0",
          inputHash: "hash",
          status: "success",
          upstreamVersions: {},
          staleSince: "2026-08-01T13:00:00.000Z",
          staleReason: "progression:old->new",
        },
      },
    });
    const block = buildBlocks(snapshot(state)).find((item) => item.block_id === 5);
    expect(block).toMatchObject({
      status: "stale",
      stale_since: "2026-08-01T13:00:00.000Z",
      stale_reason: "progression:old->new",
    });
  });

  it("emits a persistent stale warning from the same state", () => {
    const state = JSON.stringify({
      version: 1,
      artifacts: {
        gdd: {
          artifactId: "gdd-1",
          schemaVersion: "1.0.0",
          inputHash: "hash",
          status: "success",
          upstreamVersions: {},
          staleSince: "2026-08-01T13:00:00.000Z",
          staleReason: "economy:old->new",
        },
      },
    });
    expect(derivePipelineNotifications(snapshot(state))).toEqual(expect.arrayContaining([
      expect.objectContaining({ block_id: 6, stale_reason: "economy:old->new" }),
    ]));
  });
});
