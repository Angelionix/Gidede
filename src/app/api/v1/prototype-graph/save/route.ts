/**
 * POST /api/v1/prototype-graph/save
 * Body: { name, graph (JSON string), mode?, projectId?, isPublic? }
 * Response: { id, saved: true }
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
    const name = body?.name?.toString().trim();
    const graph = body?.graph;
    if (!name || !graph) return VALIDATION_ERROR("name и graph обязательны");

    const projectId = body?.projectId?.toString().trim() || null;
    if (projectId) {
      const p = await db.project.findFirst({ where: { id: projectId, userId: user.id }, select: { id: true } });
      if (!p) return NextResponse.json({ detail: "Проект не найден" }, { status: 404 });
    }

    const result = await db.prototypeGraph.create({
      data: {
        userId: user.id,
        projectId,
        name,
        graph: typeof graph === "string" ? graph : JSON.stringify(graph),
        mode: body?.mode?.toString().trim() || "2d",
        isPublic: body?.isPublic === true,
      },
    });
    return NextResponse.json({ id: result.id, saved: true });
  } catch (error) {
    console.error("[prototype-graph/save] error:", error);
    return SERVER_ERROR();
  }
}
