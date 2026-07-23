/**
 * GET    /api/v1/projects/[id]   — get project detail
 * DELETE /api/v1/projects/[id]   — delete project
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";
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
