import type { PipelineRunStatus } from "@/lib/pipeline-run-status";
import { CONTRACT_STAGE_IDS, type ContractStageId } from "@/lib/contracts/stage-contracts";
import {
  parsePipelineFreshnessState,
  stageIsAcceptedFresh,
} from "@/lib/pipeline-stale";

export interface PipelineVersionCommitDecision {
  shouldCommit: boolean;
  reason: "ready" | "run_not_successful" | "artifacts_not_accepted_fresh";
  missingStages: ContractStageId[];
}

/**
 * A project version represents one coherent, accepted pipeline snapshot.
 * Successful execution alone is insufficient: every persisted artifact must
 * also be accepted and fresh after the run has finished saving its outputs.
 */
export function evaluatePipelineVersionCommit(
  runStatus: PipelineRunStatus,
  pipelineState: string | null | undefined,
): PipelineVersionCommitDecision {
  if (runStatus !== "success") {
    return {
      shouldCommit: false,
      reason: "run_not_successful",
      missingStages: [],
    };
  }

  const freshness = parsePipelineFreshnessState(pipelineState);
  const missingStages = CONTRACT_STAGE_IDS.filter(
    (stage) => !stageIsAcceptedFresh(freshness, stage),
  );

  if (missingStages.length > 0) {
    return {
      shouldCommit: false,
      reason: "artifacts_not_accepted_fresh",
      missingStages,
    };
  }

  return { shouldCommit: true, reason: "ready", missingStages: [] };
}
