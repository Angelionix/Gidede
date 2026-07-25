/**
 * GET /api/v1/playtests/export
 *
 * Экспортирует историю плейтестов в CSV или JSON формате.
 * Query: format=csv | json (default: json)
 * Response: text/csv или application/json
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
    const format = searchParams.get("format") === "csv" ? "csv" : "json";

    const results = await db.playtestResult.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });

    if (format === "csv") {
      const header = "id,project_id,prototype_type,mode,outcome,score,duration_sec,ai_generated,created_at\n";
      const rows = results.map((r) =>
        [
          r.id,
          r.projectId || "",
          r.prototypeType,
          r.mode,
          r.outcome,
          r.score ?? "",
          r.durationSec,
          r.aiGenerated,
          r.createdAt.toISOString(),
        ].join(",")
      ).join("\n");
      const csv = header + rows;
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="playtest-history.csv"',
        },
      });
    }

    // JSON
    return NextResponse.json({
      exported_at: new Date().toISOString(),
      count: results.length,
      results: results.map((r) => ({
        id: r.id,
        project_id: r.projectId,
        prototype_type: r.prototypeType,
        mode: r.mode,
        outcome: r.outcome,
        score: r.score,
        duration_sec: r.durationSec,
        ai_generated: r.aiGenerated,
        created_at: r.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[playtests/export] error:", error);
    return SERVER_ERROR();
  }
}
