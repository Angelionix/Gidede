/**
 * POST /api/v1/pipeline/run-full-pipeline/[projectId]
 *
 * Runs all eight design stages server-side. Each successful response is
 * recorded in PipelineContext before the next request is built, so downstream
 * stages receive the actual selected genre, mechanics, aesthetics and artifact
 * lineage instead of independent defaults.
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
} from "@/lib/pipeline-context";
import type { ContractStageId } from "@/lib/contracts/stage-contracts";
import type { ArtifactStatus } from "@/lib/contracts/artifact-envelope";
import {
  derivePipelineRunStatus,
  isSuccessfulRun,
  stageFailureStatus,
} from "@/lib/pipeline-run-status";
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

function stageFailure(
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
    message: `Стадия «${stage.stage}» получила статус ${status}: ${detail}`,
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
    const snapshot = await loadProjectPipelineSnapshot(user.id, projectId);
    if (!snapshot) return NOT_FOUND();
    const idea = resolvePipelineIdea(
      requestBody?.idea,
      snapshot.projectDescription,
      snapshot.projectName,
    );

    if (!idea) {
      return VALIDATION_ERROR(
        "Для запуска заполните описание проекта или передайте idea длиной не менее 10 символов",
      );
    }

    const input = resolvePipelineInput(requestBody, idea, snapshot.projectGenre);

    const internalToken = signAccessToken(user.id, user.email);
    const authHeader = `Bearer ${internalToken}`;
    const baseUrl = internalBaseUrl(request);
    const context = createPipelineContext();
    const stages: StageResult[] = [];

    for (const stage of STAGES) {
      const stageStartedAt = Date.now();
      const stageBody = buildStageRequestBody(stage.stage, input, context);
      const url = `${baseUrl}${stage.endpoint}`;

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
          stages.push({
            stage: stage.stage,
            block_id: stage.block_id,
            block_name: BLOCK_NAMES[stage.block_id] || `Block ${stage.block_id}`,
            status: artifact.status,
            message: artifact.status === "success"
              ? `Стадия «${stage.stage}» выполнена — output передан дальше и сохранён.`
              : `Стадия «${stage.stage}» создала артефакт со статусом ${artifact.status}.`,
            http_status: response.status,
            latency_ms: latencyMs,
            artifact_id: artifact.artifactId,
            schema_version: artifact.schemaVersion,
          });
          continue;
        }

        let detail = `HTTP ${response.status}`;
        try {
          const errorBody = await response.json();
          detail = errorBody?.detail || errorBody?.message || JSON.stringify(errorBody).slice(0, 200);
        } catch {
          // Keep the HTTP fallback when the endpoint did not return JSON.
        }
        stages.push(stageFailure(stage, response.status, detail, latencyMs));

        if (stage.stage === "concept") {
          stages.push(...STAGES.slice(1).map((blockedStage) => ({
            stage: blockedStage.stage,
            block_id: blockedStage.block_id,
            block_name: BLOCK_NAMES[blockedStage.block_id] || `Block ${blockedStage.block_id}`,
            status: "blocked" as const,
            message: `Стадия «${blockedStage.stage}» заблокирована ошибкой Concept.`,
          })));
          const runStatus = derivePipelineRunStatus(stages.map((result) => result.status));
          return NextResponse.json(
            {
              ok: isSuccessfulRun(runStatus),
              status: runStatus,
              project_id: projectId,
              concept_idea: idea,
              stages,
              stages_completed: 0,
              stages_total: STAGES.length,
              latency_ms: Date.now() - startedAt,
              error: `Блок 1 (Концепция) не смог выполниться: ${detail}`,
            },
            { status: response.status === 422 ? 422 : 500 },
          );
        }
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

        if (stage.stage === "concept") {
          stages.push(...STAGES.slice(1).map((blockedStage) => ({
            stage: blockedStage.stage,
            block_id: blockedStage.block_id,
            block_name: BLOCK_NAMES[blockedStage.block_id] || `Block ${blockedStage.block_id}`,
            status: "blocked" as const,
            message: `Стадия «${blockedStage.stage}» заблокирована ошибкой Concept.`,
          })));
          const runStatus = derivePipelineRunStatus(stages.map((result) => result.status));
          return NextResponse.json(
            {
              ok: isSuccessfulRun(runStatus),
              status: runStatus,
              project_id: projectId,
              concept_idea: idea,
              stages,
              stages_completed: 0,
              stages_total: STAGES.length,
              latency_ms: Date.now() - startedAt,
              error: `Блок 1 (Концепция) недоступен: ${message}`,
            },
            { status: 500 },
          );
        }
      }
    }

    const finalSnapshot = await loadProjectPipelineSnapshot(user.id, projectId);
    const completedCount = stages.filter((stage) => stage.artifact_id).length;
    const runStatus = derivePipelineRunStatus(stages.map((stage) => stage.status));

    await db.project
      .update({
        where: { id: projectId },
        data: { version: { increment: 1 } },
      })
      .catch(() => {
        // Version consistency is handled by roadmap task R1-10.
      });

    return NextResponse.json({
      ok: isSuccessfulRun(runStatus),
      status: runStatus,
      project_id: projectId,
      concept_idea: idea,
      stages,
      stages_completed: completedCount,
      stages_total: STAGES.length,
      latency_ms: Date.now() - startedAt,
      completion_percent: finalSnapshot?.completionPercent ?? 0,
      artifact_versions: context.upstreamVersions,
      note:
        runStatus === "success"
          ? "Все 8 стадий выполнены успешно с передачей output и artifact lineage."
          : `Пайплайн получил статус ${runStatus}; артефакты созданы для ${completedCount}/${STAGES.length} стадий. См. stages[].status.`,
    });
  } catch (error) {
    console.error("[pipeline/run-full-pipeline] error:", error);
    return SERVER_ERROR();
  }
}
