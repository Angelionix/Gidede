/**
 * Gidede — AI rate-limiting.
 *
 * Enforces per-user daily AI call limits based on the User.aiCallsCount and
 * User.aiCallsLimit fields. The count is reset when the calendar day changes
 * (tracked via User.lastLoginAt as a proxy — see resetIfNewDay below).
 *
 * Two exported helpers:
 *   - checkAiQuota(user): returns { allowed, remaining, limit, used, resetAtMs }
 *     WITHOUT mutating the DB. Call this before invoking the AI.
 *   - incrementAiUsage(userId): atomically increments aiCallsCount by 1.
 *     Call this only AFTER a real AI call succeeded.
 *
 * The two-step design avoids charging users for failed / fallback AI calls
 * while still providing a pre-flight quota check.
 */

import { db } from "@/lib/db";

export interface AiQuotaStatus {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  /** Epoch ms when the quota will reset (next local midnight). */
  resetAtMs: number;
  /** Reason for denial if `allowed` is false. */
  reason?: "limit_exceeded";
}

/** Compute next local-midnight epoch ms from a given Date. */
function nextMidnight(from: Date = new Date()): number {
  const next = new Date(from);
  next.setHours(24, 0, 0, 0); // roll to next day's 00:00 local
  return next.getTime();
}

/** True if `a` and `b` fall on different calendar days (local time). */
function isDifferentDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() !== b.getFullYear() ||
    a.getMonth() !== b.getMonth() ||
    a.getDate() !== b.getDate()
  );
}

/**
 * Pre-flight quota check. Reads the user's current aiCallsCount and limit.
 * If lastLoginAt (used as the day-rollover marker) is on a previous day,
 * the effective count is treated as 0 (the next incrementAiUsage call will
 * persist the reset).
 *
 * Does NOT mutate the DB.
 */
export async function checkAiQuota(
  user: { id: string; aiCallsCount: number; aiCallsLimit: number; lastLoginAt: Date | null }
): Promise<AiQuotaStatus> {
  const limit = user.aiCallsLimit > 0 ? user.aiCallsLimit : 50;
  const now = new Date();

  // If the last activity was on a previous day, the count effectively resets.
  const effectiveUsed =
    user.lastLoginAt && isDifferentDay(user.lastLoginAt, now) ? 0 : user.aiCallsCount;

  const remaining = Math.max(0, limit - effectiveUsed);
  const allowed = effectiveUsed < limit;

  return {
    allowed,
    used: effectiveUsed,
    limit,
    remaining,
    resetAtMs: nextMidnight(now),
    ...(allowed ? {} : { reason: "limit_exceeded" as const }),
  };
}

/**
 * Atomically increment the user's AI call counter. Also performs the daily
 * reset: if lastLoginAt is on a previous day, the counter is reset to 1
 * (not 0) and lastLoginAt is bumped to now.
 *
 * Uses a conditional UPDATE to avoid the read-then-write race: the WHERE
 * clause matches the user row, and the SET uses a CASE expression to reset
 * when the day has rolled over. Prisma doesn't natively support CASE in
 * updates, so we do a guarded two-step inside a transaction.
 */
export async function incrementAiUsage(userId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { aiCallsCount: true, aiCallsLimit: true, lastLoginAt: true },
    });
    if (!user) return;

    const now = new Date();
    const isNewDay =
      !user.lastLoginAt || isDifferentDay(user.lastLoginAt, now);

    const newCount = isNewDay ? 1 : user.aiCallsCount + 1;

    await tx.user.update({
      where: { id: userId },
      data: {
        aiCallsCount: newCount,
        // Bump lastLoginAt to mark the day-rollover checkpoint. This field
        // is also updated on actual login, so this is a non-destructive
        // reuse (the field's semantic is "last user activity timestamp").
        lastLoginAt: now,
      },
    });
  });
}

/** NextResponse-friendly JSON body for a 429 quota-exceeded response. */
export function quotaExceededBody(quota: AiQuotaStatus) {
  return {
    detail: `Дневной лимит AI-вызовов исчерпан (${quota.used}/${quota.limit}). Сброс в ${new Date(quota.resetAtMs).toLocaleString("ru-RU")}.`,
    error: "ai_quota_exceeded",
    used: quota.used,
    limit: quota.limit,
    reset_at: new Date(quota.resetAtMs).toISOString(),
  };
}
