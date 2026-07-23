/**
 * POST /api/v1/auth/change-password
 * Смена пароля пользователя.
 * Body: { current_password, new_password }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, verifyPassword, hashPassword } from "@/lib/server-auth";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const currentPassword = body?.current_password?.toString();
    const newPassword = body?.new_password?.toString();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { detail: "current_password и new_password обязательны" },
        { status: 422 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { detail: "Новый пароль должен быть не короче 6 символов" },
        { status: 422 }
      );
    }

    const valid = verifyPassword(currentPassword, user.hashedPassword);
    if (!valid) {
      return NextResponse.json(
        { detail: "Неверный текущий пароль" },
        { status: 401 }
      );
    }

    const newHash = hashPassword(newPassword);
    await db.user.update({
      where: { id: user.id },
      data: { hashedPassword: newHash },
    });

    return NextResponse.json({ ok: true, message: "Пароль изменён" });
  } catch (error) {
    console.error("[auth/change-password] error:", error);
    return NextResponse.json(
      { detail: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
