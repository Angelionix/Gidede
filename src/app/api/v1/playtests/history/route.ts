/**
 * GET /api/v1/playtests/history
 *
 * Возвращает историю плейтестов пользователя (с пагинацией).
 * Query: project_id?, limit?, page?
 * Response: { results: [...], total, page, limit }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { UNAUTH, SERVER_ERROR } from "@/lib/api-helpers";
import { aggregatePlaytestEvidence } from "@/lib/playtest-evidence";

function parseStoredJson(value: string | null): unknown {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("project_id") || undefined;
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "20", 10)));
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

    const where = projectId
      ? { userId: user.id, projectId }
      : { userId: user.id };

    const [results, total, evidenceRows] = await Promise.all([
      db.playtestResult.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.playtestResult.count({ where }),
      db.playtestResult.findMany({
        where,
        select: {
          prototypeId: true,
          hypothesisId: true,
          cohortId: true,
          participantId: true,
          completion: true,
          confusionEvents: true,
          retryCount: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10_000,
      }),
    ]);

    return NextResponse.json({
      results: results.map((r) => ({
        id: r.id,
        project_id: r.projectId,
        prototype_id: r.prototypeId,
        prototype_schema_version: r.prototypeSchemaVersion,
        prototype_input_hash: r.prototypeInputHash,
        prototype_generated_at: r.prototypeGeneratedAt?.toISOString() ?? null,
        source_artifact_versions: parseStoredJson(r.sourceArtifactVersions),
        hypothesis_id: r.hypothesisId,
        hypothesis: parseStoredJson(r.hypothesisSnapshot),
        cohort_id: r.cohortId,
        participant_id: r.participantId,
        prototype_type: r.prototypeType,
        mode: r.mode,
        outcome: r.outcome,
        score: r.score,
        duration_sec: r.durationSec,
        completion: r.completion,
        confusion_events: r.confusionEvents,
        retry_count: r.retryCount,
        notes: r.notes,
        ai_generated: r.aiGenerated,
        created_at: r.createdAt.toISOString(),
      })),
      aggregates_by_prototype: aggregatePlaytestEvidence(evidenceRows),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[playtests/history] error:", error);
    return SERVER_ERROR();
  }
}
