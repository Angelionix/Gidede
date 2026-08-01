/**
 * Gidede — Server-side auth utilities.
 *
 * Replaces the Python FastAPI JWT + bcrypt auth with a Node.js implementation
 * using the built-in `crypto` module (scrypt for passwords, HMAC-SHA256 for tokens).
 *
 * Tokens are JWT-like: base64url(header).base64url(payload).base64url(signature)
 */

import { scryptSync, randomBytes, createHmac, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";

// ============================================================
// Config
// ============================================================

/**
 * Resolve the JWT signing secret.
 *
 * In production the app REFUSES TO START without an explicit
 * JWT_SECRET_KEY (or legacy NEXTAUTH_SECRET). This prevents accidental
 * deployment with a public/well-known signing key.
 *
 * In development (NODE_ENV !== "production") a deterministic fallback is
 * allowed for convenience, but it is intentionally distinct from any key
 * that could ever be used in production.
 */
function resolveJwtSecret(): string {
  const explicit = process.env.JWT_SECRET_KEY || process.env.NEXTAUTH_SECRET;
  if (explicit) {
    if (explicit.length < 32) {
      throw new Error(
        "JWT_SECRET_KEY must be at least 32 characters long for HMAC-SHA256 security."
      );
    }
    return explicit;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET_KEY environment variable is required in production. " +
        "Generate one with `openssl rand -hex 32` and set it in your environment."
    );
  }
  // Development-only fallback. NOT secure — never use in production.
  console.warn(
    "[server-auth] WARNING: JWT_SECRET_KEY not set. Using insecure development-only fallback. " +
      "Set JWT_SECRET_KEY in .env for local testing that mirrors production."
  );
  return "gidede-dev-only-insecure-fallback-do-not-use-in-production-32chars";
}

const JWT_SECRET = resolveJwtSecret();

const ACCESS_TOKEN_TTL_SEC = 30 * 60; // 30 minutes
const REFRESH_TOKEN_TTL_SEC = 30 * 24 * 60 * 60; // 30 days

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

// ============================================================
// Password hashing (scrypt)
// ============================================================

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    // Only scrypt-hashed passwords are accepted. Plaintext fallback was
    // removed for security (timing-unsafe comparison + plaintext-at-rest
    // risk). Seeded/migrated users must have scrypt hashes.
    if (!stored.startsWith("scrypt$")) {
      console.error(
        "[server-auth] Rejecting password: stored hash is not in scrypt$ format. " +
          "Legacy plaintext hashes are no longer supported — re-hash via password reset."
      );
      return false;
    }
    const parts = stored.split("$");
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const expectedHash = parts[2];
    const hash = scryptSync(password, salt, 64).toString("hex");
    const a = Buffer.from(hash, "hex");
    const b = Buffer.from(expectedHash, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ============================================================
// Token signing / verification (JWT-like with HMAC-SHA256)
// ============================================================

interface TokenPayload {
  sub: string; // user id
  email: string;
  type: "access" | "refresh";
  iat: number;
  exp: number;
  jti: string; // unique token id (prevents collisions when issued in same second)
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64");
}

function sign(payload: TokenPayload): string {
  const header = base64url(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  );
  const body = base64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const signature = createHmac("sha256", JWT_SECRET).update(data).digest();
  return `${data}.${base64url(signature)}`;
}

function verify(token: string): TokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const data = `${header}.${body}`;
    const expectedSig = createHmac("sha256", JWT_SECRET)
      .update(data)
      .digest();
    const actualSig = base64urlDecode(signature);
    if (expectedSig.length !== actualSig.length) return null;
    if (!timingSafeEqual(expectedSig, actualSig)) return null;

    const payload = JSON.parse(
      base64urlDecode(body).toString("utf8")
    ) as TokenPayload;

    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function signAccessToken(userId: string, email: string): string {
  const now = Math.floor(Date.now() / 1000);
  return sign({
    sub: userId,
    email,
    type: "access",
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_SEC,
    jti: randomBytes(12).toString("hex"),
  });
}

export function signRefreshToken(userId: string, email: string): string {
  const now = Math.floor(Date.now() / 1000);
  return sign({
    sub: userId,
    email,
    type: "refresh",
    iat: now,
    exp: now + REFRESH_TOKEN_TTL_SEC,
    jti: randomBytes(12).toString("hex"),
  });
}

export function verifyAccessToken(token: string): TokenPayload | null {
  const payload = verify(token);
  if (!payload || payload.type !== "access") return null;
  return payload;
}

export function verifyRefreshToken(token: string): TokenPayload | null {
  const payload = verify(token);
  if (!payload || payload.type !== "refresh") return null;
  return payload;
}

export const ACCESS_TOKEN_EXPIRES_IN = ACCESS_TOKEN_TTL_SEC;

// ============================================================
// Cookie helpers
// ============================================================

export async function setAuthCookies(
  accessToken: string,
  refreshToken: string
) {
  const store = await cookies();
  store.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACCESS_TOKEN_TTL_SEC,
  });
  store.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_SEC,
  });
}

export async function clearAuthCookies() {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

// ============================================================
// Request auth — resolve current user from header OR cookie
// ============================================================

export async function getAuthUserId(
  request?: Request
): Promise<string | null> {
  // 1. Authorization: Bearer <token>
  if (request) {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const payload = verifyAccessToken(token);
      if (payload) return payload.sub;
    }
  }

  // 2. Authorization header from the active Next.js request context. This
  // keeps server-only services user-aware without threading Request through
  // every domain service, and also covers internal pipeline stage requests.
  if (!request) {
    try {
      const authHeader = (await headers()).get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const payload = verifyAccessToken(authHeader.slice(7));
        if (payload) return payload.sub;
      }
    } catch {
      // No active request context (tests/background work): continue to cookie lookup.
    }
  }

  // 3. Cookie (set by login/register/refresh routes)
  try {
    const store = await cookies();
    const cookieToken = store.get(ACCESS_COOKIE)?.value;
    if (cookieToken) {
      const payload = verifyAccessToken(cookieToken);
      if (payload) return payload.sub;
    }
  } catch {
    // No active request context.
  }

  return null;
}

export async function getCurrentUser(request?: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) return null;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) return null;

  return user;
}

// ============================================================
// User serializer (snake_case for API compatibility with frontend)
// ============================================================

export function serializeUser(user: {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  aiCallsCount: number;
  aiCallsLimit: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    ai_calls_count: user.aiCallsCount,
    ai_calls_limit: user.aiCallsLimit,
    is_active: user.isActive,
    created_at: user.createdAt.toISOString(),
    last_login_at: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
  };
}
