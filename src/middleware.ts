/**
 * Gidede — Next.js Middleware (simplified)
 *
 * Previously this middleware redirected unauthenticated users from protected
 * routes (/blocks/*, /projects/*, etc.) to /login based on a server-side
 * httpOnly cookie check. However, the app's primary auth mechanism is
 * client-side: tokens are stored in localStorage and sent via the
 * `Authorization: Bearer` header. The httpOnly cookies are a secondary
 * sync mechanism that expires after 30 minutes (access token TTL).
 *
 * This created a "split-brain" bug:
 *   1. User logs in → cookies + localStorage both set → everything works
 *   2. 30 min later → access_token cookie expires → middleware redirects to /login
 *   3. Login page sees `isAuthenticated=true` (from localStorage) → redirects back to /
 *   4. User can never reach protected pages despite being authenticated client-side
 *
 * Fix: the middleware no longer redirects. Auth protection is handled
 * entirely client-side by the LayoutShell, which checks `useAuth()` and
 * redirects to /login if the user is unauthenticated on a protected route.
 *
 * The middleware is kept (rather than deleted) so that future server-side
 * concerns (e.g. locale routing, security headers) can be added here.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(_request: NextRequest) {
  // Pass through — auth protection is client-side (see LayoutShell).
  // Add any future server-side middleware concerns (security headers,
  // locale, etc.) here.
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - _next/static (static assets)
     * - _next/image (image optimization)
     * - favicon.ico
     * - API routes (they have their own auth via Bearer header)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
