/**
 * POST /api/v1/pipeline/run-full-pipeline/[projectId]
 *
 * Runs the design stages in dependency order. Explicit critical quality
 * signals stop the run and block downstream stages. A later request may pass
 * `resume_from` after the blocking stage has been corrected and persisted.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, signAccessToken } from "@/lib/server-auth";
import { NOT_FOUND, SERVER_ERROR, UNAUTH, VALIDATION_ERROR } from "@/lib/api-helpers";
import { BLOCK_NAMES, loadProjectPipelineSnapshot } from "@/lib/pipeline-helpers";
import {
  buildStageRequestBody,
  createPipelineContext,
  recordStageOutput,
  resolvePipelineIdea,
  resolvePipelineInput,
  seedStageOutput,
} from "@/lib/pipeline-context";
import type { ArtifactStatus } from "@/lib/contracts/artifact-envelope";
import type { ContractStageId } from "@/lib/contracts/stage-contracts";
import {
  derivePipelineRunStatus,
  isSuccessfulRun,
  stageFailureStatus,
} from "@/lib/pipeline-run-status";
import {
  evaluateStageQuality,
  validateResumePrerequisite,
  type QualityGateResult,
} from "@/lib/pipeline-quality-gates";
import { buildPersistedPipelineOutputs } from "@/lib/pipeline-persisted-outputs";
import { evaluatePipelineVersionCommit } from "@/lib/pipeline-versioning";
import { db } from "@/lib/db";

interface StageDef {
  stage: ContractStageId;
  block_id: number;
  endpoint: string;
}

interface StageResult {
  stage: ContractStageId;
  block_id: number;
  block_name: string;
  status: ArtifactStatus;
  message: string;
  http_status?: number;
  latency_ms?: number;
  artifact_id?: string;
  schema_version?: string;
  quality_gate?: QualityGateResult;
}

const STAGES: readonly StageDef[] = [
  { stage: "concept", block_id: 1, endpoint: "/api/v1/concept/generate" },
  { stage: "core_loop", block_id: 2, endpoint: "/api/v1/coreloop/design" },
  { stage: "mda", block_id: 3, endpoint: "/api/v1/mda/analyze" },
  { stage: "balance", block_id: 4, endpoint: "/api/v1/balance/analyze" },
  { stage: "progression", block_id: 5, endpoint: "/api/v1/progression/design" },
  { stage: "economy", block_id: 5, endpoint: "/api/v1/economy/design" },
  { stage: "gdd", block_id: 6, endpoint: "/api/v1/gdd/generate" },
  { stage: "validation", block_id: 6, endpoint: "/api/v1/checklists/validate" },
];

function internalBaseUrl(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto") || "http";
  const host = forwardedHost || request.headers.get("host") || "localhost:3000";
  return `${forwardedProtocol}://${host}`;
}

function blockedStagesAfter(stageIndex: number, cause: string): StageResult[] {
  return STAGES.slice(stageIndex + 1).map((stage) => ({
    stage: stage.stage,
    block_id: stage.block_id,
    block_name: BLOCK_NAMES[stage.block_id] || `Block ${stage.block_id}`,
    status: "blocked",
    message: `Stage «${stage.stage}» is blocked by ${cause}.`,
  }));
}

function failedStage(
  stage: StageDef,
  httpStatus: number,
  detail: string,
  latencyMs: number,
): StageResult {
  const status = stageFailureStatus(httpStatus);
  return {
    stage: stage.stage,
    block_id: stage.block_id,
    block_name: BLOCK_NAMES[stage.block_id] || `Block ${stage.block_id}`,
    status,
    message: `Stage «${stage.stage}» returned ${status}: ${detail}`,
    http_status: httpStatus,
    latency_ms: latencyMs,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const startedAt = Date.now();
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const { projectId } = await params;
    const requestBody = await request.json().catch(() => ({}));
    const project = await db.project.findFirst({
      where: { id: projectId, userId: user.id, deletedAt: null },
      include: {
        concept: true,
        coreLoop: true,
        mdaProfile: true,
        balanceResult: true,
        progression: true,
        economy: true,
        gdd: true,
        checklist: true,
      },
    });
    if (!project) return NOT_FOUND();

    const idea = resolvePipelineIdea(requestBody?.idea, project.description, project.name);
    if (!idea) {
      return VALIDATION_ERROR(
        "Для запуска заполните описание проекта или передайте idea длиной не менее 10 символов",
      );
    }

    const requestedResumeStage = typeof requestBody?.resume_from === "string"
      ? requestBody.resume_from.trim()
      : "concept";
    const startIndex = STAGES.findIndex((stage) => stage.stage === requestedResumeStage);
    if (startIndex < 0) {
      return VALIDATION_ERROR(`Неизвестная стадия resume_from: ${requestedResumeStage}`);
    }

    const input = resolvePipelineInput(requestBody, idea, project.genre);
    const context = createPipelineContext();
    const persistedOutputs = buildPersistedPipelineOutputs(project);

    for (let index = 0; index < startIndex; index += 1) {
      const stage = STAGES[index].stage;
      const persistedOutput = persistedOutputs[stage];
      const prerequisite = validateResumePrerequisite(stage, persistedOutput);
      if (!prerequisite.ok) {
        return VALIDATION_ERROR(
          `Нельзя продолжить с ${requestedResumeStage}: ${prerequisite.reason}`,
        );
      }
      seedStageOutput(context, stage, persistedOutput);
    }

    const internalToken = signAccessToken(user.id, user.email);
    const authHeader = `Bearer ${internalToken}`;
    const baseUrl = internalBaseUrl(request);
    const stages: StageResult[] = [];

    for (let stageIndex = startIndex; stageIndex < STAGES.length; stageIndex += 1) {
      const stage = STAGES[stageIndex];
      const stageStartedAt = Date.now();
      const stageBody = buildStageRequestBody(stage.stage, input, context);

      try {
        const response = await fetch(`${baseUrl}${stage.endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify({ project_id: projectId, ...stageBody }),
          redirect: "manual",
        });
        const latencyMs = Date.now() - stageStartedAt;

        if (response.ok) {
          const stageOutput: unknown = await response.json();
          const artifact = recordStageOutput(context, stage.stage, stageOutput);
          const qualityGate = evaluateStageQuality(stage.stage, stageOutput);
          const stageStatus = artifact.status === "success" ? qualityGate.status : artifact.status;
          stages.push({
            stage: stage.stage,
            block_id: stage.block_id,
            block_name: BLOCK_NAMES[stage.block_id] || `Block ${stage.block_id}`,
            status: stageStatus,
            message: stageStatus === "success"
              ? `Stage «${stage.stage}» completed and passed its quality gate.`
              : `Stage «${stage.stage}» requires review: ${[...qualityGate.criticalIssues, ...qualityGate.reviewIssues].join("; ")}.`,
            http_status: response.status,
            latency_ms: latencyMs,
            artifact_id: artifact.artifactId,
            schema_version: artifact.schemaVersion,
            quality_gate: qualityGate,
          });

          if (qualityGate.shouldStop) {
            stages.push(...blockedStagesAfter(stageIndex, `critical gate at ${stage.stage}`));
            const runStatus = derivePipelineRunStatus(stages.map((result) => result.status));
            const completedCount = stages.filter((result) => result.artifact_id).length;
            const nextStage = STAGES[stageIndex + 1]?.stage ?? null;
            const finalSnapshot = await loadProjectPipelineSnapshot(user.id, projectId);
            return NextResponse.json({
              ok: isSuccessfulRun(runStatus),
              status: runStatus,
              project_id: projectId,
              concept_idea: idea,
              resumed_from: requestedResumeStage,
              stages,
              stages_completed: completedCount,
              stages_total: STAGES.length - startIndex,
              latency_ms: Date.now() - startedAt,
              completion_percent: finalSnapshot?.completionPercent ?? 0,
              version_committed: false,
              project_version: project.version,
              artifact_versions: context.upstreamVersions,
              stopped_by: stage.stage,
              quality_gate: qualityGate,
              resume: nextStage
                ? {
                    from_stage: nextStage,
                    blocked_by: stage.stage,
                    required_artifact_id: artifact.artifactId,
                  }
                : null,
              note: `Pipeline stopped at critical gate ${stage.stage}. Correct that stage before resuming.`,
            });
          }
          continue;
        }

        let detail = `HTTP ${response.status}`;
        try {
          const errorBody = await response.json();
          detail = errorBody?.detail || errorBody?.message || JSON.stringify(errorBody).slice(0, 200);
        } catch {
          // Keep the HTTP fallback.
        }
        stages.push(failedStage(stage, response.status, detail, latencyMs));
        stages.push(...blockedStagesAfter(stageIndex, `failure at ${stage.stage}`));
        const runStatus = derivePipelineRunStatus(stages.map((result) => result.status));
        const completedCount = stages.filter((result) => result.artifact_id).length;
        return NextResponse.json({
          ok: isSuccessfulRun(runStatus),
          status: runStatus,
          project_id: projectId,
          concept_idea: idea,
          resumed_from: requestedResumeStage,
          stages,
          stages_completed: completedCount,
          stages_total: STAGES.length - startIndex,
          latency_ms: Date.now() - startedAt,
          version_committed: false,
          project_version: project.version,
          artifact_versions: context.upstreamVersions,
          stopped_by: stage.stage,
          resume: { from_stage: stage.stage, blocked_by: stage.stage },
          error: detail,
        }, { status: completedCount > 0 ? 200 : response.status === 422 ? 422 : 500 });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        stages.push({
          stage: stage.stage,
          block_id: stage.block_id,
          block_name: BLOCK_NAMES[stage.block_id] || `Block ${stage.block_id}`,
          status: "failed",
          message: `Stage «${stage.stage}» failed: ${message}`,
          latency_ms: Date.now() - stageStartedAt,
        });
        stages.push(...blockedStagesAfter(stageIndex, `failure at ${stage.stage}`));
        const runStatus = derivePipelineRunStatus(stages.map((result) => result.status));
        const completedCount = stages.filter((result) => result.artifact_id).length;
        return NextResponse.json({
          ok: isSuccessfulRun(runStatus),
          status: runStatus,
          project_id: projectId,
          concept_idea: idea,
          resumed_from: requestedResumeStage,
          stages,
          stages_completed: completedCount,
          stages_total: STAGES.length - startIndex,
          latency_ms: Date.now() - startedAt,
          version_committed: false,
          project_version: project.version,
          artifact_versions: context.upstreamVersions,
          stopped_by: stage.stage,
          resume: { from_stage: stage.stage, blocked_by: stage.stage },
          error: message,
        }, { status: completedCount > 0 ? 200 : 500 });
      }
    }

    const finalSnapshot = await loadProjectPipelineSnapshot(user.id, projectId);
    const completedCount = stages.filter((stage) => stage.artifact_id).length;
    const runStatus = derivePipelineRunStatus(stages.map((stage) => stage.status));
    const versionDecision = evaluatePipelineVersionCommit(
      runStatus,
      finalSnapshot?.pipelineState,
    );
    let committedVersion = project.version;

    if (runStatus === "success" && !versionDecision.shouldCommit) {
      return NextResponse.json({
        ok: false,
        status: "needs_review",
        execution_status: runStatus,
        project_id: projectId,
        concept_idea: idea,
        resumed_from: requestedResumeStage,
        stages,
        stages_completed: completedCount,
        stages_total: STAGES.length - startIndex,
        latency_ms: Date.now() - startedAt,
        completion_percent: finalSnapshot?.completionPercent ?? 0,
        version_committed: false,
        version_commit_reason: versionDecision.reason,
        version_commit_missing_stages: versionDecision.missingStages,
        project_version: project.version,
        artifact_versions: context.upstreamVersions,
        resume: null,
        error: "The run completed, but the saved pipeline snapshot is not fully accepted and fresh.",
      }, { status: 409 });
    }

    if (versionDecision.shouldCommit) {
      const versionCommit = await db.project.updateMany({
        where: {
          id: projectId,
          userId: user.id,
          deletedAt: null,
          version: project.version,
        },
        data: { version: { increment: 1 } },
      });
      if (versionCommit.count !== 1) {
        const currentProject = await db.project.findUnique({
          where: { id: projectId },
          select: { version: true },
        });
        return NextResponse.json({
          ok: false,
          status: "failed",
          project_id: projectId,
          concept_idea: idea,
          resumed_from: requestedResumeStage,
          stages,
          stages_completed: completedCount,
          stages_total: STAGES.length - startIndex,
          latency_ms: Date.now() - startedAt,
          completion_percent: finalSnapshot?.completionPercent ?? 0,
          version_committed: false,
          project_version: currentProject?.version ?? null,
          expected_project_version: project.version,
          artifact_versions: context.upstreamVersions,
          resume: null,
          error: "Project version changed while the pipeline was running. Reload and run again.",
        }, { status: 409 });
      }
      committedVersion += 1;
    }

    return NextResponse.json({
      ok: isSuccessfulRun(runStatus),
      status: runStatus,
      project_id: projectId,
      concept_idea: idea,
      resumed_from: requestedResumeStage,
      stages,
      stages_completed: completedCount,
      stages_total: STAGES.length - startIndex,
      latency_ms: Date.now() - startedAt,
      completion_percent: finalSnapshot?.completionPercent ?? 0,
      version_committed: versionDecision.shouldCommit,
      version_commit_reason: versionDecision.reason,
      version_commit_missing_stages: versionDecision.missingStages,
      project_version: committedVersion,
      artifact_versions: context.upstreamVersions,
      resume: null,
      note: runStatus === "success"
        ? `All ${stages.length} requested stages completed and passed their quality gates.`
        : `Pipeline completed with status ${runStatus}; review stages[].quality_gate.`,
    });
  } catch (error) {
    console.error("[pipeline/run-full-pipeline] error:", error);
    return SERVER_ERROR();
  }
}
