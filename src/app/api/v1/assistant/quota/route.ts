/**
 * GET /api/v1/assistant/quota
 *
 * Returns the current user's AI quota status (used / limit / remaining /
 * reset_at). Used by the frontend sidebar to display a live counter instead
 * of the stale 0/50 value that was shown before the rate-limit was wired up.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { checkAiQuota } from "@/lib/ai-quota";
import { UNAUTH } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  const quota = await checkAiQuota(user);

  return NextResponse.json({
    used: quota.used,
    limit: quota.limit,
    remaining: quota.remaining,
    reset_at: new Date(quota.resetAtMs).toISOString(),
    allowed: quota.allowed,
    plan: user.plan,
  });
}
