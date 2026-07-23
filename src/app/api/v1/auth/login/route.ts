/**
 * POST /api/v1/auth/login
 * Body: { email, password }
 * Response: { access_token, refresh_token, token_type, expires_in, user }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  setAuthCookies,
  serializeUser,
  ACCESS_TOKEN_EXPIRES_IN,
} from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body?.email?.toString().trim().toLowerCase();
    const password = body?.password?.toString();

    if (!email || !password) {
      return NextResponse.json(
        { detail: "Email и пароль обязательны" },
        { status: 422 }
      );
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return NextResponse.json(
        { detail: "Неверный email или пароль" },
        { status: 401 }
      );
    }

    const valid = verifyPassword(password, user.hashedPassword);
    if (!valid) {
      return NextResponse.json(
        { detail: "Неверный email или пароль" },
        { status: 401 }
      );
    }

    const accessToken = signAccessToken(user.id, user.email);
    const refreshToken = signRefreshToken(user.id, user.email);

    // Persist refresh token
    await db.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Update last login
    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await setAuthCookies(accessToken, refreshToken);

    return NextResponse.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: "bearer",
      expires_in: ACCESS_TOKEN_EXPIRES_IN,
      user: serializeUser(user),
    });
  } catch (error) {
    console.error("[auth/login] error:", error);
    return NextResponse.json(
      { detail: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
