/**
 * Gidede — Shared API helpers for block endpoints.
 *
 * Provides:
 *  - getOwnedProject: verifies that the current user owns the requested
 *    project_id (or auto-selects their most-recently-updated project when
 *    project_id is missing). Returns the project row or null.
 *  - safeJsonParse: defensive JSON parsing of stored Prisma JSON-string columns.
 *  - updateProjectStage: bumps projectStage + completionPercent + lastAlgorithmRun.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { artifactEnvelopeSchema } from "@/lib/contracts/artifact-envelope";
import {
  CONTRACT_STAGE_IDS,
  type ContractStageId,
} from "@/lib/contracts/stage-contracts";
import { buildPersistedPipelineOutputs } from "@/lib/pipeline-persisted-outputs";
import {
  acceptedFreshCompletion,
  parsePipelineFreshnessState,
  reconcilePipelineFreshness,
  recordFreshArtifact,
} from "@/lib/pipeline-stale";
import { evaluateStageQuality } from "@/lib/pipeline-quality-gates";

export interface AuthedUser {
  id: string;
  email: string;
  name: string | null;
}

export const UNAUTH = () =>
  NextResponse.json({ detail: "Не авторизован" }, { status: 401 });

export const NOT_FOUND = (msg = "Проект не найден") =>
  NextResponse.json({ detail: msg }, { status: 404 });

export const VALIDATION_ERROR = (msg: string) =>
  NextResponse.json({ detail: msg }, { status: 422 });

export const SERVER_ERROR = (msg = "Внутренняя ошибка сервера") =>
  NextResponse.json({ detail: msg }, { status: 500 });

/**
 * Verify that the user owns the project_id from the request body.
 * If project_id is missing, fall back to the user's most-recently-updated
 * project (so block pages without explicit project_id still work).
 *
 * Returns { user, project } on success or a NextResponse (error) on failure.
 */
export async function getOwnedProject(
  user: AuthedUser,
  projectId: string | undefined | null
): Promise<{ project: unknown; projectId: string } | NextResponse> {
  let project;
  if (projectId) {
    project = await db.project.findFirst({
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
  } else {
    // Auto-select most recently updated project owned by the user
    project = await db.project.findFirst({
      where: { userId: user.id, deletedAt: null },
      orderBy: { updatedAt: "desc" },
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
    if (!project) {
      return VALIDATION_ERROR(
        "У пользователя нет проектов. Создайте проект перед запуском алгоритма."
      );
    }
  }
  return { project, projectId: project.id };
}

/** Safe JSON.parse for stored Prisma string columns. Returns {} on failure. */
export function safeJsonParse<T = Record<string, unknown>>(
  raw: string | null | undefined,
  fallback?: T
): T {
  if (!raw) return (fallback ?? ({} as T));
  try {
    return JSON.parse(raw) as T;
  } catch {
    return (fallback ?? ({} as T));
  }
}

/**
 * Update project stage and artifact freshness. Completion is derived only
 * from accepted, non-stale, versioned artifacts.
 */
export async function updateProjectStage(
  projectId: string,
  stage: string,
): Promise<void> {
  const proj = await db.project.findUnique({
    where: { id: projectId },
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
  if (!proj) return;

  let freshness = parsePipelineFreshnessState(proj.pipelineState);
  if ((CONTRACT_STAGE_IDS as readonly string[]).includes(stage)) {
    const contractStage = stage as ContractStageId;
    const outputs = buildPersistedPipelineOutputs(proj);
    const output = outputs[contractStage];
    const artifact = artifactEnvelopeSchema.safeParse(output?.artifact);
    if (artifact.success && artifact.data.artifactType === contractStage) {
      const gate = evaluateStageQuality(contractStage, output);
      const nextState = recordFreshArtifact(
        freshness,
        contractStage,
        artifact.data,
        artifact.data.status === "success" && gate.severity === "pass",
      );
      freshness = reconcilePipelineFreshness(nextState, outputs);
    }
  }
  const completion = acceptedFreshCompletion(freshness);
  const pipelineState = JSON.stringify(freshness);

  await db.project.update({
    where: { id: projectId },
    data: {
      projectStage: stage,
      completionPercent: completion,
      lastAlgorithmRun: stage,
      pipelineState,
    },
  });
}
