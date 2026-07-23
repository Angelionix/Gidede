/**
 * POST /api/v1/auth/logout
 * Body: { refresh_token }
 * Revokes the refresh token and clears cookies.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clearAuthCookies } from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const refreshToken = body?.refresh_token?.toString();

    if (refreshToken) {
      // Revoke the refresh token in DB
      await db.refreshToken
        .update({
          where: { token: refreshToken },
          data: { isRevoked: true },
        })
        .catch(() => {
          // Token may not exist — ignore
        });
    }

    await clearAuthCookies();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth/logout] error:", error);
    return NextResponse.json(
      { detail: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
