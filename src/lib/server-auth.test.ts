/**
 * Unit tests for src/lib/server-auth.ts — pure crypto functions only.
 *
 * We deliberately set JWT_SECRET_KEY before importing the module so the
 * `resolveJwtSecret()` call at module-load time picks up a known constant
 * rather than the dev fallback. This makes the HMAC signature deterministic
 * for tamper tests.
 *
 * We do NOT exercise setAuthCookies / clearAuthCookies / getAuthUserId /
 * getCurrentUser — those touch `next/headers` cookies() and Prisma and need
 * integration test infrastructure we don't have.
 */
process.env.JWT_SECRET_KEY = "test-secret-for-vitest-at-least-32-characters-long";
// Cast to Record<string, string> to bypass the readonly NODE_ENV type in
// @types/node / bun-types. NODE_ENV stays "test" for the duration of the suite.
(process.env as Record<string, string>).NODE_ENV = "test";

import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  serializeUser,
} from "@/lib/server-auth";

// ============================================================
// Password hashing (scrypt)
// ============================================================

describe("hashPassword", () => {
  it("produces a string in scrypt$salt$hash format", () => {
    const hash = hashPassword("hunter2");
    expect(hash).to.match(/^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);
    // Salt should be 16 random bytes → 32 hex chars.
    const parts = hash.split("$");
    expect(parts).toHaveLength(3);
    expect(parts[1]).toHaveLength(32);
    // 64-byte scrypt hash → 128 hex chars.
    expect(parts[2]).toHaveLength(128);
  });

  it("produces a different hash for the same password (random salt)", () => {
    const a = hashPassword("same-pass");
    const b = hashPassword("same-pass");
    expect(a).not.to.equal(b);
  });
});

describe("verifyPassword", () => {
  it("returns true for the correct password against hashPassword() output", () => {
    const hash = hashPassword("correct horse battery staple");
    expect(verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("returns false for a wrong password", () => {
    const hash = hashPassword("right-password");
    expect(verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("returns false for non-scrypt format (e.g. plaintext 'password')", () => {
    expect(verifyPassword("password", "password")).toBe(false);
    expect(verifyPassword("password", "bcrypt$abc$def")).toBe(false);
  });

  it("returns false for a malformed scrypt string (missing $)", () => {
    // scrypt prefix but no $ separators
    expect(verifyPassword("password", "scryptABCDEF")).toBe(false);
    // scrypt prefix but only one $ — splits into 2 parts, not 3
    expect(verifyPassword("password", "scrypt$onlyonepart")).toBe(false);
    // four parts (extra $)
    expect(verifyPassword("password", "scrypt$salt$hash$extra")).toBe(false);
  });
});

// ============================================================
// Token signing / verification (HMAC-SHA256 JWT-like)
// ============================================================

describe("signAccessToken", () => {
  it("produces a 3-part dot-separated token", () => {
    const token = signAccessToken("user-123", "user@example.com");
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
    for (const part of parts) {
      // base64url: A–Z, a–z, 0–9, -, _ (no padding)
      expect(part).to.match(/^[A-Za-z0-9_-]+$/);
    }
  });
});

describe("verifyAccessToken", () => {
  it("round-trips the payload with correct sub, email, type:'access'", () => {
    const token = signAccessToken("user-abc", "test@gidede.local");
    const payload = verifyAccessToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe("user-abc");
    expect(payload!.email).toBe("test@gidede.local");
    expect(payload!.type).toBe("access");
    expect(payload!.exp).toBeGreaterThan(payload!.iat);
    expect(typeof payload!.jti).toBe("string");
    expect(payload!.jti.length).toBeGreaterThan(0);
  });

  it("returns null for a tampered token (flip one char in signature)", () => {
    const token = signAccessToken("user-abc", "test@gidede.local");
    const parts = token.split(".");
    const sig = parts[2];
    // Flip first character of the signature to a different base64url char.
    const firstChar = sig[0];
    const flippedChar =
      firstChar === "A" ? "B" : "A";
    const tamperedSig = flippedChar + sig.slice(1);
    const tamperedToken = `${parts[0]}.${parts[1]}.${tamperedSig}`;
    expect(verifyAccessToken(tamperedToken)).toBeNull();
  });

  it("returns null for a refresh token (type mismatch)", () => {
    const refresh = signRefreshToken("user-abc", "test@gidede.local");
    expect(verifyAccessToken(refresh)).toBeNull();
  });
});

describe("signRefreshToken + verifyRefreshToken", () => {
  it("round-trips with type:'refresh'", () => {
    const refresh = signRefreshToken("user-xyz", "refresh@gidede.local");
    const payload = verifyRefreshToken(refresh);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe("user-xyz");
    expect(payload!.email).toBe("refresh@gidede.local");
    expect(payload!.type).toBe("refresh");
  });

  it("verifyRefreshToken returns null for an access token (type mismatch)", () => {
    const access = signAccessToken("user-xyz", "refresh@gidede.local");
    expect(verifyRefreshToken(access)).toBeNull();
  });
});

// ============================================================
// serializeUser — snake_case mapping
// ============================================================

describe("serializeUser", () => {
  it("maps camelCase DB fields to snake_case API fields", () => {
    const user = {
      id: "u-1",
      email: "u@example.com",
      name: "Alice",
      plan: "pro",
      aiCallsCount: 3,
      aiCallsLimit: 50,
      isActive: true,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-06-01T00:00:00Z"),
      lastLoginAt: new Date("2024-06-02T12:00:00Z"),
    };
    const out = serializeUser(user);
    expect(out.id).toBe("u-1");
    expect(out.email).toBe("u@example.com");
    expect(out.name).toBe("Alice");
    expect(out.plan).toBe("pro");
    expect(out.ai_calls_count).toBe(3);
    expect(out.ai_calls_limit).toBe(50);
    expect(out.is_active).toBe(true);
    expect(out.created_at).toBe("2024-01-01T00:00:00.000Z");
    expect(out.last_login_at).toBe("2024-06-02T12:00:00.000Z");
  });

  it("handles null lastLoginAt and null name", () => {
    const user = {
      id: "u-2",
      email: "u2@example.com",
      name: null,
      plan: "free",
      aiCallsCount: 0,
      aiCallsLimit: 10,
      isActive: false,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-02T00:00:00Z"),
      lastLoginAt: null,
    };
    const out = serializeUser(user);
    expect(out.name).toBeNull();
    expect(out.last_login_at).toBeNull();
  });
});
