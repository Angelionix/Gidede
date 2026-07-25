/**
 * DELETE /api/v1/pipeline/stale/[projectId]/[blockId]
 *
 * Clears the stale status for a block in the project. In our mock pipeline
 * (no persistent stale table), we just acknowledge the operation. The next
 * GET /pipeline/state/[projectId] will reflect the cleared state (stale
 * notifications are derived on-the-fly from the project's data).
 *
 * Response: { ok: true, project_id, block_id, cleared: true }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import {
  UNAUTH,
  SERVER_ERROR,
  NOT_FOUND,
  VALIDATION_ERROR,
} from "@/lib/api-helpers";

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ projectId: string; blockId: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const { projectId, blockId: blockIdStr } = await params;
    const blockId = Number(blockIdStr);
    if (!Number.isInteger(blockId) || blockId < 1 || blockId > 8) {
      return VALIDATION_ERROR(
        `Неверный block_id: ${blockIdStr}. Ожидается 1..8.`
      );
    }

    // Verify ownership
    const project = await db.project.findFirst({
      where: { id: projectId, userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!project) return NOT_FOUND();

    // Touch the project's updatedAt so the pipeline state shows fresh activity
    await db.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      ok: true,
      project_id: projectId,
      block_id: blockId,
      cleared: true,
    });
  } catch (error) {
    console.error("[pipeline/stale] error:", error);
    return SERVER_ERROR();
  }
}
