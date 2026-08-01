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
  type PipelineInput,
} from "@/lib/pipeline-context";
import type { ContractStageId } from "@/lib/contracts/stage-contracts";
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
  status: "completed" | "skipped" | "error";
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
  status: number,
  detail: string,
  latencyMs: number,
): StageResult {
  const skipped = status === 422;
  return {
    stage: stage.stage,
    block_id: stage.block_id,
    block_name: BLOCK_NAMES[stage.block_id] || `Block ${stage.block_id}`,
    status: skipped ? "skipped" : "error",
    message: `Стадия «${stage.stage}» ${skipped ? "пропущена" : "завершилась с ошибкой"}: ${detail}`,
    http_status: status,
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
    const idea = requestBody?.idea?.toString().trim();

    if (!idea) {
      return VALIDATION_ERROR("Поле idea обязательно для запуска пайплайна");
    }

    const snapshot = await loadProjectPipelineSnapshot(user.id, projectId);
    if (!snapshot) return NOT_FOUND();

    const input: PipelineInput = {
      idea,
      genre: requestBody?.genre ?? null,
      useAi: requestBody?.use_ai === true || requestBody?.use_ai === "true",
      targetAesthetics: Array.isArray(requestBody?.target_aesthetics)
        ? requestBody.target_aesthetics.filter((aesthetic: unknown) => typeof aesthetic === "string")
        : [],
      totalLevels:
        typeof requestBody?.total_levels === "number" && requestBody.total_levels > 0
          ? requestBody.total_levels
          : 50,
      format:
        requestBody?.format === "ten_pager" || requestBody?.format === "full"
          ? requestBody.format
          : "one_sheet",
    };

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
            status: "completed",
            message: `Стадия «${stage.stage}» выполнена — output передан дальше и сохранён.`,
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
          return NextResponse.json(
            {
              ok: false,
              project_id: projectId,
              concept_idea: idea,
              stages,
              stages_completed: 0,
              stages_total: STAGES.length,
              latency_ms: Date.now() - startedAt,
              error: `Блок 1 (Концепция) не смог выполниться: ${detail}`,
            },
            { status: 500 },
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        stages.push({
          stage: stage.stage,
          block_id: stage.block_id,
          block_name: BLOCK_NAMES[stage.block_id] || `Block ${stage.block_id}`,
          status: "error",
          message: `Ошибка на стадии «${stage.stage}»: ${message}`,
          latency_ms: Date.now() - stageStartedAt,
        });

        if (stage.stage === "concept") {
          return NextResponse.json(
            {
              ok: false,
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
    const completedCount = stages.filter((stage) => stage.status === "completed").length;

    await db.project
      .update({
        where: { id: projectId },
        data: { version: { increment: 1 } },
      })
      .catch(() => {
        // Version consistency is handled by roadmap task R1-10.
      });

    return NextResponse.json({
      ok: true,
      project_id: projectId,
      concept_idea: idea,
      stages,
      stages_completed: completedCount,
      stages_total: STAGES.length,
      latency_ms: Date.now() - startedAt,
      completion_percent: finalSnapshot?.completionPercent ?? 0,
      artifact_versions: context.upstreamVersions,
      note:
        completedCount === STAGES.length
          ? "Все 8 стадий выполнены успешно с передачей output и artifact lineage."
          : `Пайплайн завершён с ${completedCount}/${STAGES.length} успешных стадий. См. stages[].status для деталей.`,
    });
  } catch (error) {
    console.error("[pipeline/run-full-pipeline] error:", error);
    return SERVER_ERROR();
  }
}
