import { describe, expect, it } from "vitest";
import { createArtifactEnvelope } from "@/lib/contracts/artifact-envelope";
import {
  CONTRACT_STAGE_IDS,
  validateStageInput,
} from "@/lib/contracts/stage-contracts";
import {
  buildStageRequestBody,
  createPipelineContext,
  extractConceptMechanics,
  recordStageOutput,
  resolvePipelineIdea,
  seedStageOutput,
  type PipelineInput,
} from "./pipeline-context";

const INPUT: PipelineInput = {
  idea: "A game about generic exploration",
  genre: null,
  useAi: false,
  targetAesthetics: [],
  totalLevels: 42,
  format: "one_sheet",
};

function conceptOutput() {
  return {
    id: "project-1",
    primary_genre: "puzzle",
    aesthetic_profile: { primary: "discovery", secondary: "challenge", tertiary: "fellowship" },
    mechanic_set: {
      base: [{ name: "Rotate Rooms" }],
      combat: [],
      progression: [{ name: "Unlock Light Paths" }],
      spatial: [{ name: "Redirect Light" }],
      social: [{ name: "Synchronize Robots" }],
    },
    artifact: createArtifactEnvelope("concept", { idea: INPUT.idea }),
  };
}

describe("pipeline context", () => {
  it("preserves real RU/EN project ideas without substituting canned text", () => {
    const ru = "Головоломка о двух роботах и перенаправлении света";
    const en = "A strategy game about flooded-world caravans";
    expect(resolvePipelineIdea(undefined, ru, "Проект")).toBe(ru);
    expect(resolvePipelineIdea(en, ru, "Проект")).toBe(en);
    expect(resolvePipelineIdea(undefined, null, "Short")).toBeNull();
  });

  it("extracts the mechanics selected by Concept without generic fallbacks", () => {
    expect(extractConceptMechanics(conceptOutput())).toEqual([
      "Rotate Rooms",
      "Unlock Light Paths",
      "Redirect Light",
      "Synchronize Robots",
    ]);
  });

  it("feeds Concept genre, aesthetics and mechanics into Core Loop and MDA", () => {
    const context = createPipelineContext();
    const concept = conceptOutput();
    const artifact = recordStageOutput(context, "concept", concept);

    const core = buildStageRequestBody("core_loop", INPUT, context);
    expect(core).toMatchObject({
      concept_id: "project-1",
      genre: "puzzle",
      primary_aesthetic: "discovery",
      mechanics: ["Rotate Rooms", "Unlock Light Paths", "Redirect Light", "Synchronize Robots"],
    });
    expect(core.mechanics).not.toEqual(expect.arrayContaining(["explore", "combat", "reward"]));
    expect(core.upstream_versions).toEqual({ concept: `${artifact.artifactId}@${artifact.schemaVersion}` });

    const mda = buildStageRequestBody("mda", INPUT, context);
    expect(mda).toMatchObject({
      genre: "puzzle",
      target_aesthetics: ["discovery", "challenge", "fellowship"],
      existing_mechanics: ["Rotate Rooms", "Unlock Light Paths", "Redirect Light", "Synchronize Robots"],
    });
  });

  it("builds Balance objects from selected mechanics and carries cumulative lineage", () => {
    const context = createPipelineContext();
    const concept = conceptOutput();
    recordStageOutput(context, "concept", concept);
    const coreArtifact = createArtifactEnvelope("core_loop", { mechanics: ["Rotate Rooms"] });
    recordStageOutput(context, "core_loop", { artifact: coreArtifact });
    const mdaArtifact = createArtifactEnvelope("mda", { existing_mechanics: ["Rotate Rooms"] });
    recordStageOutput(context, "mda", { artifact: mdaArtifact });

    const balance = buildStageRequestBody("balance", INPUT, context);
    const objects = balance.objects as Array<{ name: string; attributes: Record<string, number> }>;
    expect(objects.map((object) => object.name)).toEqual([
      "Rotate Rooms",
      "Unlock Light Paths",
      "Redirect Light",
      "Synchronize Robots",
    ]);
    expect(Object.values(objects[0].attributes).every(Number.isFinite)).toBe(true);
    expect(balance.upstream_versions).toEqual({
      concept: expect.stringContaining("@1.0.0"),
      core_loop: `${coreArtifact.artifactId}@${coreArtifact.schemaVersion}`,
      mda: `${mdaArtifact.artifactId}@${mdaArtifact.schemaVersion}`,
    });
  });

  it("uses deterministic idea fallback only when Concept output is unavailable", () => {
    const context = createPipelineContext();
    const body = buildStageRequestBody("core_loop", {
      ...INPUT,
      idea: "Исследовать мир и строить поселения",
      genre: "strategy",
    }, context);
    expect(body.mechanics).toEqual(["explore", "build", "interact", "progress"]);
    expect(body.genre).toBe("strategy");
  });

  it("rejects output whose artifact type does not match its stage", () => {
    expect(() => recordStageOutput(
      createPipelineContext(),
      "mda",
      { artifact: createArtifactEnvelope("concept", {}) },
    )).toThrow(/artifact type concept/);
  });

  it("seeds legacy persisted output without inventing an artifact version", () => {
    const context = createPipelineContext();
    seedStageOutput(context, "concept", {
      primary_genre: "rpg",
      mechanic_set: { base: ["Explore"] },
    });
    expect(context.outputs.concept).toBeDefined();
    expect(context.upstreamVersions).toEqual({});
  });

  it("builds contract-valid requests for all eight stages with cumulative lineage", () => {
    const context = createPipelineContext();

    for (const stage of CONTRACT_STAGE_IDS) {
      if (stage === "concept") {
        const request = buildStageRequestBody(stage, INPUT, context);
        expect(validateStageInput(stage, request), stage).toEqual({ success: true });
        recordStageOutput(context, stage, conceptOutput());
        continue;
      }

      const request = buildStageRequestBody(stage, INPUT, context);
      expect(validateStageInput(stage, request), stage).toEqual({ success: true });
      recordStageOutput(context, stage, {
        artifact: createArtifactEnvelope(stage, request),
      });
    }

    expect(Object.keys(context.upstreamVersions)).toEqual([...CONTRACT_STAGE_IDS]);
  });
});
