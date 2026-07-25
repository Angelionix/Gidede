/**
 * GET    /api/v1/projects/[id]   — get project detail
 * DELETE /api/v1/projects/[id]   — delete project
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";
import { UNAUTH, SERVER_ERROR } from "@/lib/api-helpers";
import { serializeProject } from "../route";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;

  const project = await db.project.findFirst({
    where: { id, userId: user.id },
    include: {
      concept: true,
      coreLoop: true,
      mdaProfile: true,
      balanceResult: true,
      progression: true,
      economy: true,
      gdd: true,
      checklist: true,
    },
  });

  if (!project) {
    return NextResponse.json(
      { detail: "Проект не найден" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ...serializeProject(project),
    project_stage: project.projectStage,
    version: project.version,
    last_algorithm_run: project.lastAlgorithmRun,
  });
}

/**
 * PUT /api/v1/projects/{id}
 * Обновляет проект (name, description, genre, status).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();
  const { id } = await params;

  const existing = await db.project.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ detail: "Проект не найден" }, { status: 404 });

  try {
    const body = await request.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (body?.name) data.name = String(body.name).trim();
    if (body?.description !== undefined) data.description = String(body.description).trim() || null;
    if (body?.genre !== undefined) data.genre = String(body.genre).trim() || null;
    if (body?.status) data.status = String(body.status).trim();
    if (body?.project_stage) data.projectStage = String(body.project_stage).trim();

    const project = await db.project.update({
      where: { id },
      data,
      include: {
        concept: { select: { id: true } },
        coreLoop: { select: { id: true } },
        mdaProfile: { select: { id: true } },
        balanceResult: { select: { id: true } },
        progression: { select: { id: true } },
        economy: { select: { id: true } },
        gdd: { select: { id: true } },
        checklist: { select: { id: true } },
      },
    });

    return NextResponse.json(serializeProject(project));
  } catch (error) {
    console.error("[projects/update] error:", error);
    return SERVER_ERROR();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;

  const project = await db.project.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });

  if (!project) {
    return NextResponse.json(
      { detail: "Проект не найден" },
      { status: 404 }
    );
  }

  await db.project.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
