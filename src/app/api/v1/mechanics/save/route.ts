/**
 * POST /api/v1/mechanics/save
 * Сохраняет механику в библиотеку для переиспользования.
 * Body: { mechanicName, description, codeSnippet, engine, coreLoopType?, projectId?, isPublic?, tags? }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { UNAUTH, SERVER_ERROR, VALIDATION_ERROR } from "@/lib/api-helpers";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const body = await request.json().catch(() => ({}));
    const mechanicName = body?.mechanicName?.toString().trim();
    const description = body?.description?.toString().trim();
    const codeSnippet = body?.codeSnippet?.toString().trim();
    const engine = body?.engine?.toString().trim() || "littlejs";
    const coreLoopType = body?.coreLoopType?.toString().trim() || null;
    const projectId = body?.projectId?.toString().trim() || null;
    const isPublic = body?.isPublic === true;
    const tags = Array.isArray(body?.tags) ? JSON.stringify(body.tags) : null;

    if (!mechanicName || !description || !codeSnippet) {
      return VALIDATION_ERROR("mechanicName, description, codeSnippet обязательны");
    }

    const saved = await db.savedMechanic.create({
      data: {
        userId: user.id,
        projectId,
        mechanicName,
        description,
        codeSnippet,
        engine,
        coreLoopType,
        tags,
        isPublic,
      },
    });

    return NextResponse.json({ id: saved.id, saved: true });
  } catch (error) {
    console.error("[mechanics/save] error:", error);
    return SERVER_ERROR();
  }
}
