import { describe, expect, it } from "vitest";
import type { PipelineFreshnessState } from "./pipeline-stale";
import {
  checkPrototypeFreshness,
  createPrototypeArtifact,
  PrototypeLineageError,
} from "./prototype-lineage";
import { buildPrototypeConfig, generatePrototypeHtml } from "./prototype-generator";

function pipelineState(overrides: Partial<PipelineFreshnessState["artifacts"]> = {}): string {
  return JSON.stringify({
    version: 1,
    artifacts: {
      concept: {
        artifactId: "concept-v1",
        schemaVersion: "1.0.0",
        inputHash: "concept-hash",
        status: "success",
        upstreamVersions: {},
        staleSince: null,
        staleReason: null,
        acceptedAt: "2026-08-01T10:00:00.000Z",
      },
      core_loop: {
        artifactId: "core-v1",
        schemaVersion: "1.0.0",
        inputHash: "core-hash",
        status: "success",
        upstreamVersions: { concept: "concept-v1@1.0.0" },
        staleSince: null,
        staleReason: null,
        acceptedAt: "2026-08-01T10:01:00.000Z",
      },
      ...overrides,
    },
  });
}

describe("prototype artifact lineage — R2-06", () => {
  it("pins a generated prototype to the exact accepted Core Loop lineage", () => {
    const artifact = createPrototypeArtifact(
      "project-1",
      pipelineState(),
      { mode: "2d", type: "engine", steps: ["Acquire", "Spend"] },
      { prototypeId: "prototype-1", generatedAt: "2026-08-01T10:02:00.000Z" },
    );

    expect(artifact).toMatchObject({
      prototypeId: "prototype-1",
      schemaVersion: "1.0.0",
      projectId: "project-1",
      sourceArtifactVersions: {
        concept: "concept-v1@1.0.0",
        core_loop: "core-v1@1.0.0",
      },
    });
    expect(artifact.inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(checkPrototypeFreshness(artifact, pipelineState())).toEqual({ fresh: true, reason: null });
  });

  it("marks the prototype stale when its Core Loop version changes", () => {
    const artifact = createPrototypeArtifact("project-1", pipelineState(), { mode: "2d" });
    const changed = pipelineState({
      core_loop: {
        artifactId: "core-v2",
        schemaVersion: "1.0.0",
        inputHash: "new-core-hash",
        status: "success",
        upstreamVersions: { concept: "concept-v1@1.0.0" },
        staleSince: null,
        staleReason: null,
        acceptedAt: "2026-08-01T10:03:00.000Z",
      },
    });

    expect(checkPrototypeFreshness(artifact, changed)).toEqual({
      fresh: false,
      reason: "core_loop:core-v1@1.0.0->core-v2@1.0.0",
    });
  });

  it("refuses generation from a stale Core Loop", () => {
    const stale = pipelineState({
      core_loop: {
        artifactId: "core-v1",
        schemaVersion: "1.0.0",
        inputHash: "core-hash",
        status: "success",
        upstreamVersions: { concept: "concept-v1@1.0.0" },
        staleSince: "2026-08-01T10:03:00.000Z",
        staleReason: "concept:concept-v1->concept-v2",
        acceptedAt: "2026-08-01T10:01:00.000Z",
      },
    });

    expect(() => createPrototypeArtifact("project-1", stale, { mode: "2d" }))
      .toThrowError(PrototypeLineageError);
  });

  it("changes the input hash for a different prototype configuration", () => {
    const left = createPrototypeArtifact("project-1", pipelineState(), { mode: "2d", type: "engine" });
    const right = createPrototypeArtifact("project-1", pipelineState(), { mode: "3d", type: "engine" });
    expect(left.inputHash).not.toBe(right.inputHash);
  });

  it.each(["2d", "3d"] as const)("embeds the prototype identity into %s playtest events", (mode) => {
    const config = buildPrototypeConfig({ structuralType: "engine", steps: ["Acquire", "Spend"] }, mode);
    const html = generatePrototypeHtml(config, "prototype-version-42");
    expect(html).toContain("prototypeId: 'prototype-version-42'");
  });
});
