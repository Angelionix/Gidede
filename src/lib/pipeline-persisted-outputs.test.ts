import { describe, expect, it } from "vitest";
import { createArtifactEnvelope } from "@/lib/contracts/artifact-envelope";
import { buildPersistedPipelineOutputs } from "./pipeline-persisted-outputs";

describe("persisted pipeline outputs", () => {
  it("reconstructs Concept and reads downstream full profiles", () => {
    const artifact = createArtifactEnvelope("concept", { idea: "Persisted idea" });
    const outputs = buildPersistedPipelineOutputs({
      id: "project-1",
      concept: {
        genre: "puzzle",
        inputData: JSON.stringify({ primary_genre: "puzzle" }),
        aestheticProfile: JSON.stringify({ primary: "discovery" }),
        mechanicSet: JSON.stringify({ base: ["rotate"] }),
        validationReport: JSON.stringify({ critical_count: 0 }),
        generationMetadata: JSON.stringify({ artifact }),
      },
      coreLoop: { fullProfile: JSON.stringify({ artifact: createArtifactEnvelope("core_loop", {}) }) },
    });
    expect(outputs.concept).toMatchObject({
      id: "project-1",
      primary_genre: "puzzle",
      validation_report: { critical_count: 0 },
      artifact,
    });
    expect(outputs.core_loop?.artifact).toBeDefined();
  });

  it("ignores malformed legacy JSON instead of inventing output", () => {
    expect(buildPersistedPipelineOutputs({
      id: "project-1",
      coreLoop: { fullProfile: "not-json" },
    }).core_loop).toBeUndefined();
  });
});
