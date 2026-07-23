/**
 * GET /api/v1/mechanics/list
 * Список сохранённых механик пользователя + публичные.
 * Query: scope=mine|public|all (default: mine), coreLoopType?, limit?
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
    const scope = searchParams.get("scope") || "mine";
    const coreLoopType = searchParams.get("coreLoopType") || undefined;
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "50", 10)));

    const where = {
      ...(scope === "mine" ? { userId: user.id } : {}),
      ...(scope === "public" ? { isPublic: true } : {}),
      ...(scope === "all" ? { OR: [{ userId: user.id }, { isPublic: true }] } : {}),
      ...(coreLoopType ? { coreLoopType } : {}),
    };

    const results = await db.savedMechanic.findMany({
      where,
      orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
      take: limit,
    });

    return NextResponse.json({
      results: results.map((r) => ({
        id: r.id,
        mechanicName: r.mechanicName,
        description: r.description,
        codeSnippet: r.codeSnippet,
        engine: r.engine,
        coreLoopType: r.coreLoopType,
        tags: r.tags ? JSON.parse(r.tags) : [],
        isPublic: r.isPublic,
        rating: r.rating,
        created_at: r.createdAt.toISOString(),
        is_owner: r.userId === user.id,
      })),
      total: results.length,
    });
  } catch (error) {
    console.error("[mechanics/list] error:", error);
    return SERVER_ERROR();
  }
}
