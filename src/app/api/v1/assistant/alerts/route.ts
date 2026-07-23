/**
 * GET /api/v1/assistant/alerts
 *
 * Returns proactive alerts derived from the project's pipeline state.
 * Alerts warn about missing stages, gaps in the pipeline, or milestones.
 *
 * Query:
 *   - project_id?: string
 *
 * Response: { alerts: Alert[], total: number }
 *   Alert = { id, alert_type, severity, block_id, title, description, suggestion, timestamp }
 *
 * If no project_id is given, we try the user's most-recent project.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { deriveAlerts } from "@/lib/assistant-store";
import { UNAUTH, SERVER_ERROR, NOT_FOUND } from "@/lib/api-helpers";
import {
  loadProjectPipelineSnapshot,
  type ProjectPipelineSnapshot,
} from "@/lib/pipeline-helpers";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("project_id") || undefined;

    let snap: ProjectPipelineSnapshot | null = null;
    if (projectId) {
      snap = await loadProjectPipelineSnapshot(user.id, projectId);
      if (!snap) return NOT_FOUND();
    } else {
      // Auto-select user's most-recent project
      const recent = await db.project.findFirst({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });
      if (!recent) {
        return NextResponse.json({ alerts: [], total: 0 });
      }
      snap = await loadProjectPipelineSnapshot(user.id, recent.id);
      if (!snap) return NOT_FOUND();
    }

    const alerts = deriveAlerts({
      hasConcept: snap.hasConcept,
      hasCoreLoop: snap.hasCoreLoop,
      hasMda: snap.hasMda,
      hasBalance: snap.hasBalance,
      hasProgression: snap.hasProgression,
      hasEconomy: snap.hasEconomy,
      hasGdd: snap.hasGdd,
      hasChecklist: snap.hasChecklist,
      completionPercent: snap.completionPercent,
    });

    return NextResponse.json({ alerts, total: alerts.length });
  } catch (error) {
    console.error("[assistant/alerts] error:", error);
    return SERVER_ERROR();
  }
}
