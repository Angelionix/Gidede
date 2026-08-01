/**
 * POST /api/v1/pipeline/run-pipeline/[projectId]
 *
 * Runs selected pipeline blocks using real project data. Persisted outputs from
 * skipped upstream stages seed PipelineContext; newly executed outputs replace
 * them and feed later selected stages.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, signAccessToken } from "@/lib/server-auth";
import {
  UNAUTH,
  SERVER_ERROR,
  NOT_FOUND,
  VALIDATION_ERROR,
} from "@/lib/api-helpers";
import { loadProjectPipelineSnapshot, BLOCK_NAMES } from "@/lib/pipeline-helpers";
import {
  buildStageRequestBody,
  createPipelineContext,
  recordStageOutput,
  resolvePipelineIdea,
  resolvePipelineInput,
  seedStageOutput,
} from "@/lib/pipeline-context";
import type { ContractStageId } from "@/lib/contracts/stage-contracts";
import type { ArtifactStatus } from "@/lib/contracts/artifact-envelope";
import {
  derivePipelineRunStatus,
  isSuccessfulRun,
  stageFailureStatus,
} from "@/lib/pipeline-run-status";
import {
  evaluateStageQuality,
  type QualityGateResult,
} from "@/lib/pipeline-quality-gates";
import { buildPersistedPipelineOutputs } from "@/lib/pipeline-persisted-outputs";
import { db } from "@/lib/db";

interface StageDef {
  stage: ContractStageId;
  block_id: number;
  endpoint: string;
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
    const blockIdsRaw = Array.isArray(requestBody?.block_ids) ? requestBody.block_ids : null;

    if (!blockIdsRaw || blockIdsRaw.length === 0) {
      return VALIDATION_ERROR("Поле block_ids обязательно и должно содержать хотя бы один ID блока");
    }

    const blockIds: number[] = [...new Set<number>(
      blockIdsRaw
        .map((value: unknown) => Number(value))
        .filter((value: number) => Number.isInteger(value) && value >= 1 && value <= 6),
    )].sort((left, right) => left - right);

    if (blockIds.length === 0) {
      return VALIDATION_ERROR("Все block_ids должны быть целыми числами в диапазоне 1..6");
    }

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

    const idea = resolvePipelineIdea(
      requestBody?.idea,
      project.description,
      project.name,
    );
    if (!idea) {
      return VALIDATION_ERROR(
        "Для запуска заполните описание проекта или передайте idea длиной не менее 10 символов",
      );
    }

    const input = resolvePipelineInput(requestBody, idea, project.genre);

    const lastSelectedIndex = STAGES.findLastIndex((stage) => blockIds.includes(stage.block_id));
    const context = createPipelineContext();

    const persistedOutputs = buildPersistedPipelineOutputs(project);

    const internalToken = signAccessToken(user.id, user.email);
    const authHeader = `Bearer ${internalToken}`;
    const baseUrl = internalBaseUrl(request);
    const stages: Array<{
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
    }> = [];
    let stoppedBy: ContractStageId | null = null;
    let resumeFrom: ContractStageId | null = null;

    for (let stageIndex = 0; stageIndex <= lastSelectedIndex; stageIndex += 1) {
      const stage = STAGES[stageIndex];
      if (!blockIds.includes(stage.block_id)) {
        seedStageOutput(context, stage.stage, persistedOutputs[stage.stage]);
        continue;
      }

      const stageStartedAt = Date.now();
      const url = `${baseUrl}${stage.endpoint}`;
      const stageBody = buildStageRequestBody(stage.stage, input, context);

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
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
              ? `Стадия «${stage.stage}» выполнена на реальных данных проекта.`
              : `Стадия «${stage.stage}» требует проверки: ${[...qualityGate.criticalIssues, ...qualityGate.reviewIssues].join("; ")}.`,
            http_status: response.status,
            latency_ms: latencyMs,
            artifact_id: artifact.artifactId,
            schema_version: artifact.schemaVersion,
            quality_gate: qualityGate,
          });
          if (qualityGate.shouldStop) {
            stoppedBy = stage.stage;
            resumeFrom = STAGES.slice(stageIndex + 1, lastSelectedIndex + 1)
              .find((candidate) => blockIds.includes(candidate.block_id))?.stage ?? null;
            for (const blockedStage of STAGES.slice(stageIndex + 1, lastSelectedIndex + 1)) {
              if (!blockIds.includes(blockedStage.block_id)) continue;
              stages.push({
                stage: blockedStage.stage,
                block_id: blockedStage.block_id,
                block_name: BLOCK_NAMES[blockedStage.block_id] || `Block ${blockedStage.block_id}`,
                status: "blocked",
                message: `Стадия «${blockedStage.stage}» заблокирована critical gate стадии «${stage.stage}».`,
              });
            }
            break;
          }
          continue;
        }

        let detail = `HTTP ${response.status}`;
        try {
          const errorBody = await response.json();
          detail = errorBody?.detail || errorBody?.message || JSON.stringify(errorBody).slice(0, 200);
        } catch {
          // Keep HTTP fallback.
        }
        stages.push({
          stage: stage.stage,
          block_id: stage.block_id,
          block_name: BLOCK_NAMES[stage.block_id] || `Block ${stage.block_id}`,
          status: stageFailureStatus(response.status),
          message: `Стадия «${stage.stage}» не завершена: ${detail}`,
          http_status: response.status,
          latency_ms: latencyMs,
        });
        stoppedBy = stage.stage;
        resumeFrom = stage.stage;
        for (const blockedStage of STAGES.slice(stageIndex + 1, lastSelectedIndex + 1)) {
          if (!blockIds.includes(blockedStage.block_id)) continue;
          stages.push({
            stage: blockedStage.stage,
            block_id: blockedStage.block_id,
            block_name: BLOCK_NAMES[blockedStage.block_id] || `Block ${blockedStage.block_id}`,
            status: "blocked",
            message: `Стадия «${blockedStage.stage}» заблокирована ошибкой стадии «${stage.stage}».`,
          });
        }
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        stages.push({
          stage: stage.stage,
          block_id: stage.block_id,
          block_name: BLOCK_NAMES[stage.block_id] || `Block ${stage.block_id}`,
          status: "failed",
          message: `Ошибка на стадии «${stage.stage}»: ${message}`,
          latency_ms: Date.now() - stageStartedAt,
        });
        stoppedBy = stage.stage;
        resumeFrom = stage.stage;
        for (const blockedStage of STAGES.slice(stageIndex + 1, lastSelectedIndex + 1)) {
          if (!blockIds.includes(blockedStage.block_id)) continue;
          stages.push({
            stage: blockedStage.stage,
            block_id: blockedStage.block_id,
            block_name: BLOCK_NAMES[blockedStage.block_id] || `Block ${blockedStage.block_id}`,
            status: "blocked",
            message: `Стадия «${blockedStage.stage}» заблокирована ошибкой стадии «${stage.stage}».`,
          });
        }
        break;
      }
    }

    const finalSnapshot = await loadProjectPipelineSnapshot(user.id, projectId);
    const completedCount = stages.filter((stage) => stage.artifact_id).length;
    const runStatus = derivePipelineRunStatus(stages.map((stage) => stage.status));

    return NextResponse.json({
      ok: isSuccessfulRun(runStatus),
      status: runStatus,
      project_id: projectId,
      concept_idea: idea,
      stages,
      stages_completed: completedCount,
      stages_total: stages.length,
      latency_ms: Date.now() - startedAt,
      completion_percent: finalSnapshot?.completionPercent ?? 0,
      version_committed: false,
      version_commit_reason: "partial_pipeline_run",
      project_version: project.version,
      artifact_versions: context.upstreamVersions,
      stopped_by: stoppedBy,
      resume: resumeFrom ? { from_stage: resumeFrom, blocked_by: stoppedBy } : null,
      note:
        runStatus === "success"
          ? "Все запрошенные стадии выполнены на реальных данных проекта."
          : `Запуск получил статус ${runStatus}; артефакты созданы для ${completedCount}/${stages.length} стадий.`,
    });
  } catch (error) {
    console.error("[pipeline/run-pipeline] error:", error);
    return SERVER_ERROR();
  }
}
