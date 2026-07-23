/**
 * Gidede — Next.js Middleware
 *
 * Обработка маршрутов:
 * - Защита /blocks/* и /projects/* маршрутов (требуется авторизация)
 * - Публичные маршруты: /, /login, /register
 * - Редирект неавторизованных на /login
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Маршруты, доступные без авторизации */
const PUBLIC_ROUTES = ["/", "/login", "/register"];

/** Маршруты, требующие авторизации */
const PROTECTED_PREFIXES = ["/blocks", "/projects", "/prototypes", "/settings", "/knowledge"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Публичные маршруты — пропускаем
  if (PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return NextResponse.next();
  }

  // API-маршруты — пропускаем (у них своя авторизация)
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Статика — пропускаем
  if (pathname.startsWith("/_next/") || pathname.includes(".")) {
    return NextResponse.next();
  }

  // Проверяем наличие токена в cookies
  const accessToken = request.cookies.get("access_token")?.value;
  const refreshToken = request.cookies.get("refresh_token")?.value;

  // Защищённые маршруты — редиректим на логин если нет токена
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isProtected && !accessToken && !refreshToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Совпадает со всеми маршрутами кроме:
     * - _next/static (статика)
     * - _next/image (оптимизация изображений)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
