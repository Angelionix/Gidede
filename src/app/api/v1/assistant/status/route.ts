/**
 * GET /api/v1/assistant/status
 * Возвращает статус AI-ассистента (доступность, модель, счётчики).
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { getDefaultLlmStatus } from "@/lib/llm/default-client";
import { UNAUTH } from "@/lib/api-helpers";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  const status = await getDefaultLlmStatus();

  return NextResponse.json({
    ai_available: status.available,
    provider: status.available ? status.providerId : "unavailable (fallback to rules-engine)",
    model: status.available ? status.modelId : "gidede-rules-v1",
    capabilities: status.capabilities,
    health: status.health,
    ai_calls_count: user.aiCallsCount,
    ai_calls_limit: user.aiCallsLimit,
    ai_calls_remaining: user.aiCallsLimit - user.aiCallsCount,
    plan: user.plan,
  });
}
