import { describe, expect, it } from "vitest";
import {
  ARTIFACT_ENVELOPE_VERSION,
  ARTIFACT_SCHEMA_VERSION,
  artifactEnvelopeSchema,
  createArtifactEnvelope,
  hashArtifactInput,
  readUpstreamVersions,
} from "./artifact-envelope";

describe("ArtifactEnvelope", () => {
  it("hashes semantically identical object inputs deterministically", () => {
    const left = { genre: "rpg", nested: { b: 2, a: 1 }, list: [3, 2, 1] };
    const right = { list: [3, 2, 1], nested: { a: 1, b: 2 }, genre: "rpg" };

    expect(hashArtifactInput(left)).toBe(hashArtifactInput(right));
    expect(hashArtifactInput(left)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes inputHash when a meaningful input changes", () => {
    expect(hashArtifactInput({ idea: "RU idea" })).not.toBe(
      hashArtifactInput({ idea: "EN idea" }),
    );
  });

  it("creates a schema-valid, traceable envelope", () => {
    const input = {
      idea: "A sufficiently detailed game idea",
      upstream_versions: { concept: "concept-artifact@3", core_loop: "core-loop-artifact@2" },
    };
    const envelope = createArtifactEnvelope("mda", input);

    expect(artifactEnvelopeSchema.safeParse(envelope).success).toBe(true);
    expect(envelope.envelopeVersion).toBe(ARTIFACT_ENVELOPE_VERSION);
    expect(envelope.schemaVersion).toBe(ARTIFACT_SCHEMA_VERSION);
    expect(envelope.inputHash).toBe(hashArtifactInput(input));
    expect(envelope.status).toBe("success");
    expect(envelope.upstreamVersions).toEqual({
      concept: "concept-artifact@3",
      core_loop: "core-loop-artifact@2",
    });
  });

  it("filters malformed upstream versions instead of recording false lineage", () => {
    expect(readUpstreamVersions({
      upstream_versions: {
        concept: "concept-artifact@1",
        empty: "",
        numeric: 2,
      },
    })).toEqual({ concept: "concept-artifact@1" });
  });

  it("rejects malformed hashes and unsupported statuses", () => {
    const envelope = createArtifactEnvelope("concept", { idea: "valid idea" });
    expect(artifactEnvelopeSchema.safeParse({ ...envelope, inputHash: "bad" }).success).toBe(false);
    expect(artifactEnvelopeSchema.safeParse({ ...envelope, status: "completed" }).success).toBe(false);
  });
});
