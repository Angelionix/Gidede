/**
 * Gidede — Next.js Middleware
 *
 * Обработка маршрутов:
 * - Пропускает все запросы к API и статике
 * - Auth-проверка делегирована на client-side (useAuth hook) и API routes
 *   (Bearer token auth). Middleware redirect отключён, потому что preview-
 *   панель работает в iframe, где SameSite=lax cookies не отправляются
 *   браузером при cross-site навигации.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(_request: NextRequest) {
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
