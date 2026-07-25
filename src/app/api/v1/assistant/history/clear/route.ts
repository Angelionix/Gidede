/**
 * POST /api/v1/assistant/history/clear
 *
 * Clears in-memory chat history for the current user (optionally scoped
 * to a project).
 *
 * Body: { project_id?: string }
 *
 * Response: { ok: true, cleared: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { clearHistory } from "@/lib/assistant-store";
import { UNAUTH, SERVER_ERROR } from "@/lib/api-helpers";
import { loadProjectPipelineSnapshot } from "@/lib/pipeline-helpers";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const body = await request.json().catch(() => ({}));
    const projectId = body?.project_id?.toString().trim() || undefined;

    if (projectId) {
      const snap = await loadProjectPipelineSnapshot(user.id, projectId);
      if (!snap) {
        return NextResponse.json(
          { detail: "Проект не найден" },
          { status: 404 }
        );
      }
    }

    const cleared = await clearHistory(user.id, projectId || null);
    return NextResponse.json({ ok: true, cleared });
  } catch (error) {
    console.error("[assistant/history/clear] error:", error);
    return SERVER_ERROR();
  }
}
