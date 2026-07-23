/**
 * POST /api/v1/playtests/save
 *
 * Сохраняет результат плейтеста прототипа кор-лупа.
 * Body: { project_id?, prototype_type, mode, outcome, score?, duration_sec, notes?, ai_generated? }
 * Response: { id, saved: true }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { UNAUTH, SERVER_ERROR, VALIDATION_ERROR } from "@/lib/api-helpers";

const VALID_TYPES = ["engine", "economy", "ecology"];
const VALID_MODES = ["2d", "3d"];
const VALID_OUTCOMES = ["win", "lose", "timeout"];

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const body = await request.json().catch(() => ({}));
    const projectId = body?.project_id?.toString().trim() || null;
    const prototypeType = body?.prototype_type?.toString().trim();
    const mode = body?.mode?.toString().trim();
    const outcome = body?.outcome?.toString().trim();
    const score = body?.score != null ? Number(body.score) : null;
    const durationSec = Number(body?.duration_sec);
    const notes = body?.notes?.toString().trim() || null;
    const aiGenerated = body?.ai_generated === true;

    if (!prototypeType || !VALID_TYPES.includes(prototypeType)) {
      return VALIDATION_ERROR(`prototype_type обязателен (${VALID_TYPES.join("|")})`);
    }
    if (!mode || !VALID_MODES.includes(mode)) {
      return VALIDATION_ERROR(`mode обязателен (${VALID_MODES.join("|")})`);
    }
    if (!outcome || !VALID_OUTCOMES.includes(outcome)) {
      return VALIDATION_ERROR(`outcome обязателен (${VALID_OUTCOMES.join("|")})`);
    }
    if (!durationSec || durationSec < 0 || durationSec > 600) {
      return VALIDATION_ERROR("duration_sec обязателен (0–600 сек)");
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

    const result = await db.playtestResult.create({
      data: {
        userId: user.id,
        projectId,
        prototypeType,
        mode,
        outcome,
        score: score != null && !isNaN(score) ? score : null,
        durationSec,
        notes,
        aiGenerated,
      },
    });

    return NextResponse.json({ id: result.id, saved: true });
  } catch (error) {
    console.error("[playtests/save] error:", error);
    return SERVER_ERROR();
  }
}
