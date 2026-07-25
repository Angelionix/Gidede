/**
 * POST /api/v1/pipeline/notify-updated
 *
 * Notifies the pipeline that a block was updated. The frontend's use-pipeline.ts
 * hook calls this after a block algorithm completes. In our mock implementation
 * we accept the notification and update the project's lastAlgorithmRun field
 * to reflect the activity (this is the same field updated by api-helpers'
 * updateProjectStage, but we don't change completionPercent here — that's
 * the responsibility of the per-block algorithm route).
 *
 * Body: { project_id: string, block_id: number, metadata?: Record<string, unknown> }
 *
 * Response: { ok: true, project_id, block_id, updated_at }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import {
  UNAUTH,
  SERVER_ERROR,
  VALIDATION_ERROR,
  NOT_FOUND,
} from "@/lib/api-helpers";

const BLOCK_ID_TO_STAGE: Record<number, string> = {
  1: "concept",
  2: "core_loop",
  3: "mda",
  4: "balance",
  5: "progression",
  6: "gdd",
  7: "assistant",
  8: "gbe",
};

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const body = await request.json().catch(() => ({}));
    const projectId = body?.project_id?.toString().trim();
    const blockId = Number(body?.block_id);
    const metadata = body?.metadata || {};

    if (!projectId) {
      return VALIDATION_ERROR("Поле project_id обязательно");
    }
    if (!Number.isInteger(blockId) || blockId < 1 || blockId > 8) {
      return VALIDATION_ERROR("Поле block_id должно быть целым 1..8");
    }

    // Verify ownership
    const project = await db.project.findFirst({
      where: { id: projectId, userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!project) return NOT_FOUND();

    // Update lastAlgorithmRun + bump version (no stage change here)
    const updated = await db.project.update({
      where: { id: projectId },
      data: {
        lastAlgorithmRun: BLOCK_ID_TO_STAGE[blockId] || "unknown",
        version: { increment: 1 },
      },
      select: { updatedAt: true },
    });

    return NextResponse.json({
      ok: true,
      project_id: projectId,
      block_id: blockId,
      updated_at: updated.updatedAt.toISOString(),
      metadata,
    });
  } catch (error) {
    console.error("[pipeline/notify-updated] error:", error);
    return SERVER_ERROR();
  }
}
