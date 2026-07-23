/**
 * GET /api/v1/assistant/suggestions
 *
 * Returns contextual suggestions for a given block. Suggestions are derived
 * from the project's pipeline snapshot (which blocks have data, etc.).
 *
 * Query:
 *   - block_id: number (required, 1-8)
 *   - project_id?: string
 *
 * Response: { block_id: number, suggestions: Suggestion[] }
 *   Suggestion = { title, description, action, priority, data? }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { getBlockSuggestions } from "@/lib/assistant-store";
import {
  UNAUTH,
  SERVER_ERROR,
  VALIDATION_ERROR,
} from "@/lib/api-helpers";
import {
  loadProjectPipelineSnapshot,
  type ProjectPipelineSnapshot,
} from "@/lib/pipeline-helpers";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const { searchParams } = new URL(request.url);
    const blockId = Number(searchParams.get("block_id"));
    const projectId = searchParams.get("project_id") || undefined;

    if (!Number.isInteger(blockId) || blockId < 1 || blockId > 8) {
      return VALIDATION_ERROR(
        "Параметр block_id обязателен и должен быть целым числом 1..8"
      );
    }

    // Snapshot is optional — if no project_id, use empty defaults.
    let snap: ProjectPipelineSnapshot | null = null;
    if (projectId) {
      snap = await loadProjectPipelineSnapshot(user.id, projectId);
      if (!snap) {
        return NextResponse.json(
          { detail: "Проект не найден" },
          { status: 404 }
        );
      }
    }

    const suggestions = getBlockSuggestions(blockId, {
      hasConcept: snap?.hasConcept,
      hasCoreLoop: snap?.hasCoreLoop,
      hasMda: snap?.hasMda,
      hasBalance: snap?.hasBalance,
      hasProgression: snap?.hasProgression,
      hasEconomy: snap?.hasEconomy,
      hasGdd: snap?.hasGdd,
      hasChecklist: snap?.hasChecklist,
      completionPercent: snap?.completionPercent ?? 0,
    });

    return NextResponse.json({ block_id: blockId, suggestions });
  } catch (error) {
    console.error("[assistant/suggestions] error:", error);
    return SERVER_ERROR();
  }
}
