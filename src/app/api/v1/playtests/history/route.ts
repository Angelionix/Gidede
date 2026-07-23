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

    const [results, total] = await Promise.all([
      db.playtestResult.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.playtestResult.count({ where }),
    ]);

    return NextResponse.json({
      results: results.map((r) => ({
        id: r.id,
        project_id: r.projectId,
        prototype_type: r.prototypeType,
        mode: r.mode,
        outcome: r.outcome,
        score: r.score,
        duration_sec: r.durationSec,
        notes: r.notes,
        ai_generated: r.aiGenerated,
        created_at: r.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error("[playtests/history] error:", error);
    return SERVER_ERROR();
  }
}
