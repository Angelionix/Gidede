/**
 * POST /api/v1/auth/refresh
 * Body: { refresh_token }
 * Response: { access_token, refresh_token, token_type, expires_in, user? }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  verifyRefreshToken,
  signAccessToken,
  signRefreshToken,
  setAuthCookies,
  serializeUser,
  ACCESS_TOKEN_EXPIRES_IN,
} from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const refreshToken =
      body?.refresh_token?.toString() ||
      (await import("next/headers").then((m) =>
        m.cookies().then((c) => c.get("refresh_token")?.value)
      ));

    if (!refreshToken) {
      return NextResponse.json(
        { detail: "Refresh token не предоставлен" },
        { status: 422 }
      );
    }

    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      return NextResponse.json(
        { detail: "Недействительный или истёкший refresh token" },
        { status: 401 }
      );
    }

    // Check token exists in DB and isn't revoked
    const stored = await db.refreshToken.findUnique({
      where: { token: refreshToken },
    });
    if (!stored || stored.isRevoked) {
      return NextResponse.json(
        { detail: "Refresh token отозван" },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      return NextResponse.json(
        { detail: "Пользователь не найден" },
        { status: 401 }
      );
    }

    // Revoke old refresh token (rotation)
    await db.refreshToken.update({
      where: { id: stored.id },
      data: { isRevoked: true },
    });

    const newAccessToken = signAccessToken(user.id, user.email);
    const newRefreshToken = signRefreshToken(user.id, user.email);

    await db.refreshToken.create({
      data: {
        userId: user.id,
        token: newRefreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await setAuthCookies(newAccessToken, newRefreshToken);

    return NextResponse.json({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      token_type: "bearer",
      expires_in: ACCESS_TOKEN_EXPIRES_IN,
      user: serializeUser(user),
    });
  } catch (error) {
    console.error("[auth/refresh] error:", error);
    return NextResponse.json(
      { detail: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
