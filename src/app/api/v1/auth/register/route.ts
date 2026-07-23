/**
 * POST /api/v1/auth/register
 * Body: { email, password, name? }
 * Response: { access_token, refresh_token, token_type, expires_in, user }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  hashPassword,
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
    const name = body?.name?.toString().trim() || null;

    if (!email || !password) {
      return NextResponse.json(
        { detail: "Email и пароль обязательны" },
        { status: 422 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { detail: "Пароль должен быть не короче 6 символов" },
        { status: 422 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { detail: "Некорректный email" },
        { status: 422 }
      );
    }

    // Check if user already exists
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { detail: "Пользователь с таким email уже существует" },
        { status: 409 }
      );
    }

    const hashedPassword = hashPassword(password);

    const user = await db.user.create({
      data: {
        email,
        name,
        hashedPassword,
        plan: "free",
        aiCallsCount: 0,
        aiCallsLimit: 50,
        isActive: true,
      },
    });

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
    console.error("[auth/register] error:", error);
    return NextResponse.json(
      { detail: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
