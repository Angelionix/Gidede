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
      where: { id: projectId, userId: user.id },
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
      where: { userId: user.id },
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
  fallback: T
): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Stage completion weights (out of 100). Each block contributes a portion. */
const STAGE_WEIGHTS: Record<string, number> = {
  concept: 12,
  core_loop: 12,
  mda: 18,
  balance: 18,
  progression: 10,
  economy: 10,
  gdd: 10,
  validation: 10,
};

/**
 * Update project stage / completion. Computes completionPercent from which
 * child records exist.
 */
export async function updateProjectStage(
  projectId: string,
  stage: string,
  options: { completionBoost?: number } = {}
): Promise<void> {
  const proj = await db.project.findUnique({
    where: { id: projectId },
    include: {
      concept: { select: { id: true } },
      coreLoop: { select: { id: true } },
      mdaProfile: { select: { id: true } },
      balanceResult: { select: { id: true } },
      progression: { select: { id: true } },
      economy: { select: { id: true } },
      gdd: { select: { id: true } },
      checklist: { select: { id: true } },
    },
  });
  if (!proj) return;

  let completion = 0;
  if (proj.concept) completion += STAGE_WEIGHTS.concept;
  if (proj.coreLoop) completion += STAGE_WEIGHTS.core_loop;
  if (proj.mdaProfile) completion += STAGE_WEIGHTS.mda;
  if (proj.balanceResult) completion += STAGE_WEIGHTS.balance;
  if (proj.progression) completion += STAGE_WEIGHTS.progression;
  if (proj.economy) completion += STAGE_WEIGHTS.economy;
  if (proj.gdd) completion += STAGE_WEIGHTS.gdd;
  if (proj.checklist) completion += STAGE_WEIGHTS.validation;

  completion = Math.min(100, completion + (options.completionBoost || 0));

  await db.project.update({
    where: { id: projectId },
    data: {
      projectStage: stage,
      completionPercent: completion,
      lastAlgorithmRun: stage,
    },
  });
}
