import type { ArtifactStatus } from "@/lib/contracts/artifact-envelope";

export type PipelineRunStatus = ArtifactStatus;

export function stageFailureStatus(httpStatus?: number): ArtifactStatus {
  if (httpStatus === 422) return "needs_review";
  if (httpStatus === 424) return "blocked";
  return "failed";
}

export function derivePipelineRunStatus(
  statuses: readonly ArtifactStatus[],
): PipelineRunStatus {
  if (statuses.length === 0) return "failed";
  if (statuses.every((status) => status === "success")) return "success";

  const producedUsefulOutput = statuses.some(
    (status) => status === "success" || status === "partial",
  );
  if (producedUsefulOutput) return "partial";
  if (statuses.includes("failed")) return "failed";
  if (statuses.includes("needs_review")) return "needs_review";
  if (statuses.includes("partial")) return "partial";
  return "blocked";
}

export function isSuccessfulRun(status: PipelineRunStatus): boolean {
  return status === "success";
}
