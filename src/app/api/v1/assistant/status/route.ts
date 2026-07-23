/**
 * GET /api/v1/assistant/status
 * Возвращает статус AI-ассистента (доступность, модель, счётчики).
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { isAiAvailable } from "@/lib/ai-service";
import { UNAUTH } from "@/lib/api-helpers";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  const available = await isAiAvailable();

  return NextResponse.json({
    ai_available: available,
    provider: available ? "z-ai-web-dev-sdk" : "unavailable (fallback to rules-engine)",
    model: available ? "glm-4.6" : "gidede-rules-v1",
    ai_calls_count: user.aiCallsCount,
    ai_calls_limit: user.aiCallsLimit,
    ai_calls_remaining: user.aiCallsLimit - user.aiCallsCount,
    plan: user.plan,
  });
}
