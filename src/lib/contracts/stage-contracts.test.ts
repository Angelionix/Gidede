import { describe, expect, it } from "vitest";
import { getStageAlgorithmMetadata } from "@/lib/algorithm-metadata";
import {
  ARTIFACT_SCHEMA_VERSION,
  ARTIFACT_STAGE_IDS,
  createArtifactEnvelope,
} from "./artifact-envelope";
import {
  assertStageOutput,
  CONTRACT_STAGE_IDS,
  STAGE_CONTRACTS_V1,
  STAGE_CONTRACT_VERSION,
  StageOutputContractError,
  validateStageInput,
  type ContractStageId,
} from "./stage-contracts";

const VALID_INPUTS: Record<ContractStageId, unknown> = {
  concept: { idea: "A sufficiently detailed game idea" },
  core_loop: { mechanics: ["explore"] },
  mda: {},
  balance: {
    objects: [
      { name: "A", attributes: { power: 1 } },
      { name: "B", attributes: { power: 2 } },
    ],
  },
  progression: {},
  economy: {},
  gdd: {},
  validation: {},
};

function output(stage: ContractStageId): Record<string, unknown> {
  const common = {
    contract_version: STAGE_CONTRACT_VERSION,
    algorithm_metadata: getStageAlgorithmMetadata(stage),
    artifact: createArtifactEnvelope(stage, VALID_INPUTS[stage]),
  };
  const byStage: Record<ContractStageId, Record<string, unknown>> = {
    concept: {
      id: "p",
      genre: "rpg",
      primary_genre: "rpg",
      subgenres: [],
      genre_classification: {
        classifier_version: "1.0.0",
        selection_source: "keyword_match",
        selected_primary: "rpg",
        selected_subgenres: [],
        candidates: [{ genre: "rpg", score: 1, matched_keywords: ["rpg"] }],
      },
      mechanic_set: {},
      validation_report: {},
      status: "completed",
    },
    core_loop: { id: "p", structural_type: {}, steps: [{}], validation: {} },
    mda: { aesthetic_profile: {}, dynamics_target: {}, mechanic_set: {} },
    balance: { id: "p", balance_map: {}, transitive_result: {}, stability: {} },
    progression: { id: "p", macro_model: {}, tier_model: {}, curves: {}, validation: {} },
    economy: { id: "p", inventory: {}, classification: {}, conversion_graph: {}, sim_result: {} },
    gdd: { format_spec: {}, data_mapping: {}, assembled_document: {}, coverage_score: 0.5 },
    validation: { scope: {}, summary: {} },
  };
  return { ...common, ...byStage[stage] };
}

describe("stage contracts v1", () => {
  it("defines an explicit versioned input and output schema for every stage", () => {
    expect(Object.keys(STAGE_CONTRACTS_V1)).toEqual([...CONTRACT_STAGE_IDS]);
    expect(ARTIFACT_STAGE_IDS).toEqual(CONTRACT_STAGE_IDS);
    expect(ARTIFACT_SCHEMA_VERSION).toBe(STAGE_CONTRACT_VERSION);
    for (const stage of CONTRACT_STAGE_IDS) {
      expect(STAGE_CONTRACTS_V1[stage].version).toBe(STAGE_CONTRACT_VERSION);
      expect(validateStageInput(stage, VALID_INPUTS[stage]).success).toBe(true);
      expect(() => assertStageOutput(stage, output(stage))).not.toThrow();
    }
  });

  it("rejects malformed inputs before stage execution", () => {
    expect(validateStageInput("concept", { idea: "short" }).success).toBe(false);
    expect(validateStageInput("core_loop", { mechanics: [] }).success).toBe(false);
    expect(validateStageInput("balance", {
      objects: [
        { name: "A", attributes: { power: "high" } },
        { name: "B", attributes: { power: 2 } },
      ],
    }).success).toBe(false);
    expect(validateStageInput("mda", {
      upstream_versions: { concept: 2 },
    }).success).toBe(false);
    expect(validateStageInput("mda", {
      upstream_versions: { concept: "concept-artifact@2" },
    }).success).toBe(true);
  });

  it("normalizes progression and GDD aliases to canonical contract fields", () => {
    const progression = validateStageInput("progression", {
      total_levels: "37",
    });
    expect(progression.success).toBe(true);
    if (progression.success) {
      expect(progression.data.target_levels).toBe("37");
      expect(progression.data).not.toHaveProperty("total_levels");
    }

    const gdd = validateStageInput("gdd", { format: "full" });
    expect(gdd.success).toBe(true);
    if (gdd.success) {
      expect(gdd.data.target_format).toBe("full_gdd");
      expect(gdd.data).not.toHaveProperty("format");
    }
  });

  it("gives canonical fields precedence when both alias names are present", () => {
    const progression = validateStageInput("progression", {
      target_levels: 24,
      total_levels: 99,
    });
    expect(progression.success && progression.data.target_levels).toBe(24);

    const gdd = validateStageInput("gdd", {
      target_format: "ten_pager",
      format: "full",
    });
    expect(gdd.success && gdd.data.target_format).toBe("ten_pager");
  });

  it("rejects an invalid or unversioned output before persistence", () => {
    const invalid = output("concept");
    delete invalid.contract_version;
    expect(() => assertStageOutput("concept", invalid)).toThrow(StageOutputContractError);

    const wrongVersion = { ...output("gdd"), contract_version: "2.0.0" };
    expect(() => assertStageOutput("gdd", wrongVersion)).toThrow(/gdd@1\.0\.0/);
  });

  it("rejects internally inconsistent genre evidence", () => {
    const invalid = output("concept");
    invalid.genre_classification = {
      classifier_version: "1.0.0",
      selection_source: "keyword_match",
      selected_primary: "rpg",
      selected_subgenres: ["rpg"],
      candidates: [{ genre: "shooter", score: 2, matched_keywords: ["shooter"] }],
    };

    expect(() => assertStageOutput("concept", invalid)).toThrow(StageOutputContractError);
  });
});
