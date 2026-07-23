/**
 * POST /api/v1/playtests/import
 *
 * Импортирует плейтесты из JSON массива.
 * Body: { results: [{ prototype_type, mode, outcome, score?, duration_sec, ai_generated?, created_at? }] }
 * Response: { imported: N, skipped: M }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { UNAUTH, SERVER_ERROR, VALIDATION_ERROR } from "@/lib/api-helpers";

const VALID_TYPES = ["engine", "economy", "ecology", "tower_defense", "rhythm", "puzzle"];
const VALID_MODES = ["2d", "3d"];
const VALID_OUTCOMES = ["win", "lose", "timeout"];

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const body = await request.json().catch(() => ({}));
    const results = Array.isArray(body?.results) ? body.results : [];
    const projectId = body?.project_id?.toString().trim() || null;

    if (results.length === 0) {
      return VALIDATION_ERROR("Поле results обязательно и должно быть массивом");
    }

    // Verify project ownership if projectId provided
    if (projectId) {
      const proj = await db.project.findFirst({
        where: { id: projectId, userId: user.id },
        select: { id: true },
      });
      if (!proj) {
        return NextResponse.json({ detail: "Проект не найден" }, { status: 404 });
      }
    }

    let imported = 0;
    let skipped = 0;

    for (const item of results) {
      const type = item?.prototype_type?.toString().trim();
      const mode = item?.mode?.toString().trim();
      const outcome = item?.outcome?.toString().trim();
      const durationSec = Number(item?.duration_sec);

      if (!type || !VALID_TYPES.includes(type)) { skipped++; continue; }
      if (!mode || !VALID_MODES.includes(mode)) { skipped++; continue; }
      if (!outcome || !VALID_OUTCOMES.includes(outcome)) { skipped++; continue; }
      if (!durationSec || durationSec < 0 || durationSec > 600) { skipped++; continue; }

      await db.playtestResult.create({
        data: {
          userId: user.id,
          projectId: projectId || null,
          prototypeType: type,
          mode,
          outcome,
          score: item.score != null ? Number(item.score) : null,
          durationSec,
          aiGenerated: item.ai_generated === true,
        },
      });
      imported++;
    }

    return NextResponse.json({ imported, skipped, total: results.length });
  } catch (error) {
    console.error("[playtests/import] error:", error);
    return SERVER_ERROR();
  }
}
