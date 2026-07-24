/**
 * GET /api/v1/prototype-graph/list
 * Query: scope=mine|public|all
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
    const where = scope === "public" ? { isPublic: true } : scope === "all" ? { OR: [{ userId: user.id }, { isPublic: true }] } : { userId: user.id };
    const results = await db.prototypeGraph.findMany({ where, orderBy: { updatedAt: "desc" }, take: 100 });
    return NextResponse.json({
      results: results.map((r) => ({
        id: r.id, name: r.name, mode: r.mode, isPublic: r.isPublic,
        projectId: r.projectId, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
        isOwner: r.userId === user.id,
      })),
      total: results.length,
    });
  } catch (error) {
    console.error("[prototype-graph/list] error:", error);
    return SERVER_ERROR();
  }
}
