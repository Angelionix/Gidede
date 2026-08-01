import { describe, expect, it } from "vitest";
import { getStageAlgorithmMetadata } from "@/lib/algorithm-metadata";
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
  };
  const byStage: Record<ContractStageId, Record<string, unknown>> = {
    concept: { id: "p", genre: "rpg", mechanic_set: {}, validation_report: {}, status: "completed" },
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
    for (const stage of CONTRACT_STAGE_IDS) {
      expect(STAGE_CONTRACTS_V1[stage].version).toBe(STAGE_CONTRACT_VERSION);
      expect(validateStageInput(stage, VALID_INPUTS[stage])).toEqual({ success: true });
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
  });

  it("rejects an invalid or unversioned output before persistence", () => {
    const invalid = output("concept");
    delete invalid.contract_version;
    expect(() => assertStageOutput("concept", invalid)).toThrow(StageOutputContractError);

    const wrongVersion = { ...output("gdd"), contract_version: "2.0.0" };
    expect(() => assertStageOutput("gdd", wrongVersion)).toThrow(/gdd@1\.0\.0/);
  });
});
