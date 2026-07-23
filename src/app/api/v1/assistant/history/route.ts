/**
 * GET /api/v1/assistant/history
 *
 * Returns chat history for the current user (optionally scoped to a project).
 * Query:
 *   - project_id?: string  scope to a project (history key = userId:projectId)
 *   - limit?: number       default 50
 *
 * Response: { messages: ChatMsg[], total: number }
 *   ChatMsg = { id, role, content, timestamp, metadata? }
 *
 * Storage: in-memory Map (assistant-store.ts) — resets on server restart.
 * See worklog for rationale.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { getHistory } from "@/lib/assistant-store";
import { UNAUTH, SERVER_ERROR } from "@/lib/api-helpers";
import { loadProjectPipelineSnapshot } from "@/lib/pipeline-helpers";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("project_id") || undefined;
    const limitParam = searchParams.get("limit");
    const limit = Math.max(1, Math.min(500, Number(limitParam) || 50));

    // If project_id is provided, validate ownership (so users can't read
    // other users' project-scoped chats). Project-scoped history is keyed
    // by userId:projectId anyway, but a 404 is friendlier than a silent empty list.
    if (projectId) {
      const snap = await loadProjectPipelineSnapshot(user.id, projectId);
      if (!snap) {
        return NextResponse.json(
          { detail: "Проект не найден" },
          { status: 404 }
        );
      }
    }

    const { messages, total } = await getHistory(user.id, projectId || null, limit);
    return NextResponse.json({ messages, total });
  } catch (error) {
    console.error("[assistant/history] error:", error);
    return SERVER_ERROR();
  }
}
