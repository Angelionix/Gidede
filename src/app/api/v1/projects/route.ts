/**
 * GET  /api/v1/projects/    — list projects (paginated, searchable)
 * POST /api/v1/projects/    — create a new project
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  genre: string | null;
  status: string;
  completionPercent: number;
  createdAt: Date;
  updatedAt: Date;
}

function serializeProject(p: ProjectRow & {
  concept?: { id: string } | null;
  coreLoop?: { id: string } | null;
  mdaProfile?: { id: string } | null;
  balanceResult?: { id: string } | null;
  progression?: { id: string } | null;
  economy?: { id: string } | null;
  gdd?: { id: string } | null;
  checklist?: { id: string } | null;
}) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    genre: p.genre,
    status: p.status,
    completion_percent: p.completionPercent,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
    has_concept: !!p.concept,
    has_core_loop: !!p.coreLoop,
    has_mda: !!p.mdaProfile,
    has_balance: !!p.balanceResult,
    has_progression: !!p.progression,
    has_economy: !!p.economy,
    has_gdd: !!p.gdd,
    has_checklist: !!p.checklist,
  };
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json(
      { detail: "Не авторизован" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const perPage = Math.max(
    1,
    Math.min(100, parseInt(searchParams.get("per_page") || "20", 10))
  );
  const search = searchParams.get("search")?.trim() || "";

  const where = {
    userId: user.id,
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { description: { contains: search } },
          ],
        }
      : {}),
  };

  const [projects, total] = await Promise.all([
    db.project.findMany({
      where,
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
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.project.count({ where }),
  ]);

  return NextResponse.json({
    projects: projects.map(serializeProject),
    total,
    page,
    per_page: perPage,
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json(
      { detail: "Не авторизован" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const name = body?.name?.toString().trim();
    const description = body?.description?.toString().trim() || null;
    const genre = body?.genre?.toString().trim() || null;

    if (!name) {
      return NextResponse.json(
        { detail: "Название проекта обязательно" },
        { status: 422 }
      );
    }

    const project = await db.project.create({
      data: {
        userId: user.id,
        name,
        description,
        genre,
        status: "draft",
        projectStage: null,
        completionPercent: 0,
        version: 1,
      },
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

    return NextResponse.json(serializeProject(project), { status: 201 });
  } catch (error) {
    console.error("[projects/create] error:", error);
    return NextResponse.json(
      { detail: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}

export { serializeProject };
