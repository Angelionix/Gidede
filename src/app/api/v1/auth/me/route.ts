/**
 * GET /api/v1/auth/me
 * Returns the current authenticated user.
 */

import { NextResponse } from "next/server";
import { getCurrentUser, serializeUser } from "@/lib/server-auth";

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
