/**
 * POST /api/v1/pipeline/notify-updated
 *
 * Notifies the pipeline that a block was updated. The frontend's use-pipeline.ts
 * hook calls this after a block algorithm completes. The notification records
 * activity only; it must not create a new coherent project version. Version
 * commits belong to a fully accepted and persisted pipeline run.
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

    // Record activity without claiming that a coherent pipeline run committed.
    const updated = await db.project.update({
      where: { id: projectId },
      data: {
        lastAlgorithmRun: BLOCK_ID_TO_STAGE[blockId] || "unknown",
      },
      select: { updatedAt: true, version: true },
    });

    return NextResponse.json({
      ok: true,
      project_id: projectId,
      block_id: blockId,
      updated_at: updated.updatedAt.toISOString(),
      version_committed: false,
      project_version: updated.version,
      metadata,
    });
  } catch (error) {
    console.error("[pipeline/notify-updated] error:", error);
    return SERVER_ERROR();
  }
}
