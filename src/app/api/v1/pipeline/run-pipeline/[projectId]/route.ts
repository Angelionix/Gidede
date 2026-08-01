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
  safeJsonParse,
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

    const conceptMetadata = safeJsonParse<Record<string, unknown>>(
      project.concept?.generationMetadata || "{}",
      {},
    );
    const persistedOutputs: Partial<Record<ContractStageId, Record<string, unknown>>> = {
      concept: project.concept
        ? {
            id: project.id,
            genre: project.concept.genre,
            primary_genre: safeJsonParse<Record<string, unknown>>(
              project.concept.inputData || "{}",
              {},
            ).primary_genre ?? project.concept.genre,
            aesthetic_profile: safeJsonParse(project.concept.aestheticProfile || "{}", {}),
            mechanic_set: safeJsonParse(project.concept.mechanicSet || "{}", {}),
            artifact: conceptMetadata.artifact,
          }
        : undefined,
      core_loop: project.coreLoop
        ? safeJsonParse(project.coreLoop.fullProfile || "{}", {})
        : undefined,
      mda: project.mdaProfile
        ? safeJsonParse(project.mdaProfile.fullProfile || "{}", {})
        : undefined,
      balance: project.balanceResult
        ? safeJsonParse(project.balanceResult.fullResult || "{}", {})
        : undefined,
      progression: project.progression
        ? safeJsonParse(project.progression.fullProfile || "{}", {})
        : undefined,
      economy: project.economy
        ? safeJsonParse(project.economy.fullProfile || "{}", {})
        : undefined,
      gdd: project.gdd
        ? safeJsonParse(project.gdd.fullProfile || "{}", {})
        : undefined,
      validation: project.checklist
        ? safeJsonParse(project.checklist.fullResults || "{}", {})
        : undefined,
    };

    const internalToken = signAccessToken(user.id, user.email);
    const authHeader = `Bearer ${internalToken}`;
    const baseUrl = internalBaseUrl(request);
    const stages: Array<{
      stage: ContractStageId;
      block_id: number;
      block_name: string;
      status: "completed" | "skipped" | "error";
      message: string;
      http_status?: number;
      latency_ms?: number;
      artifact_id?: string;
      schema_version?: string;
    }> = [];

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
          stages.push({
            stage: stage.stage,
            block_id: stage.block_id,
            block_name: BLOCK_NAMES[stage.block_id] || `Block ${stage.block_id}`,
            status: "completed",
            message: `Стадия «${stage.stage}» выполнена на реальных данных проекта.`,
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
          // Keep HTTP fallback.
        }
        stages.push({
          stage: stage.stage,
          block_id: stage.block_id,
          block_name: BLOCK_NAMES[stage.block_id] || `Block ${stage.block_id}`,
          status: response.status === 422 ? "skipped" : "error",
          message: `Стадия «${stage.stage}» завершилась с ошибкой: ${detail}`,
          http_status: response.status,
          latency_ms: latencyMs,
        });
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
      }
    }

    const finalSnapshot = await loadProjectPipelineSnapshot(user.id, projectId);
    const completedCount = stages.filter((stage) => stage.status === "completed").length;

    return NextResponse.json({
      ok: completedCount === stages.length,
      project_id: projectId,
      concept_idea: idea,
      stages,
      stages_completed: completedCount,
      stages_total: stages.length,
      latency_ms: Date.now() - startedAt,
      completion_percent: finalSnapshot?.completionPercent ?? 0,
      artifact_versions: context.upstreamVersions,
      note:
        completedCount === stages.length
          ? "Все запрошенные стадии выполнены на реальных данных проекта."
          : `Выполнено ${completedCount}/${stages.length} стадий. См. stages[].status.`,
    });
  } catch (error) {
    console.error("[pipeline/run-pipeline] error:", error);
    return SERVER_ERROR();
  }
}
