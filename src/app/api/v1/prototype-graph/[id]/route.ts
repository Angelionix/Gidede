/**
 * GET /api/v1/prototype-graph/[id] — load graph
 * PUT /api/v1/prototype-graph/[id] — update graph
 * DELETE /api/v1/prototype-graph/[id] — delete graph
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { UNAUTH, SERVER_ERROR } from "@/lib/api-helpers";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();
  const { id } = await params;
  const graph = await db.prototypeGraph.findFirst({ where: { OR: [{ id, userId: user.id }, { id, isPublic: true }] } });
  if (!graph) return NextResponse.json({ detail: "Граф не найден" }, { status: 404 });
  return NextResponse.json({ id: graph.id, name: graph.name, graph: graph.graph, mode: graph.mode, isPublic: graph.isPublic, projectId: graph.projectId });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const existing = await db.prototypeGraph.findFirst({ where: { id, userId: user.id } });
    if (!existing) return NextResponse.json({ detail: "Граф не найден" }, { status: 404 });
    const data: Record<string, unknown> = {};
    if (body?.name) data.name = String(body.name);
    if (body?.graph) data.graph = typeof body.graph === "string" ? body.graph : JSON.stringify(body.graph);
    if (body?.mode) data.mode = String(body.mode);
    if (body?.isPublic !== undefined) data.isPublic = Boolean(body.isPublic);
    await db.prototypeGraph.update({ where: { id }, data });
    return NextResponse.json({ id, updated: true });
  } catch (error) {
    console.error("[prototype-graph PUT] error:", error);
    return SERVER_ERROR();
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();
  const { id } = await params;
  const existing = await db.prototypeGraph.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ detail: "Граф не найден" }, { status: 404 });
  await db.prototypeGraph.delete({ where: { id } });
  return NextResponse.json({ id, deleted: true });
}
