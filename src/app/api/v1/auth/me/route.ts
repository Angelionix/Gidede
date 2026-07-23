/**
 * GET /api/v1/auth/me
 * Returns the current authenticated user.
 */

import { NextResponse, NextRequest } from "next/server";
import { getCurrentUser, serializeUser } from "@/lib/server-auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json(
      { detail: "Не авторизован" },
      { status: 401 }
    );
  }
  return NextResponse.json(serializeUser(user));
}

/**
 * PUT /api/v1/auth/me
 * Обновляет профиль пользователя (name, plan).
 */
export async function PUT(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (body?.name !== undefined) data.name = String(body.name).trim() || null;
    if (body?.plan) {
      const validPlans = ["free", "pro"];
      if (validPlans.includes(body.plan)) {
        data.plan = String(body.plan);
        data.aiCallsLimit = body.plan === "pro" ? 500 : 50;
      }
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data,
    });

    return NextResponse.json(serializeUser(updated));
  } catch (error) {
    console.error("[auth/me PUT] error:", error);
    return NextResponse.json(
      { detail: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
