import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ROUTABLE_LLM_STAGES } from "@/lib/llm/routing";
import { getCurrentUser } from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const requestedLimit = Number(params.get("limit") || 30);
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(100, Math.trunc(requestedLimit)))
    : 30;
  const stage = params.get("stage")?.trim() || null;
  if (stage && !(ROUTABLE_LLM_STAGES as readonly string[]).includes(stage)) {
    return NextResponse.json({ detail: "Неизвестная стадия LLM" }, { status: 422 });
  }

  const calls = await db.llmCallTelemetry.findMany({
    where: { userId: user.id, ...(stage ? { stage } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  const successful = calls.filter((call) => call.status === "success");
  const knownTokenCalls = calls.filter((call) => call.totalTokens != null);

  return NextResponse.json({
    calls: calls.map((call) => ({
      id: call.id,
      stage: call.stage,
      provider: call.provider,
      model: call.model,
      status: call.status,
      stream: call.stream,
      latency_ms: call.latencyMs,
      input_tokens: call.inputTokens,
      output_tokens: call.outputTokens,
      total_tokens: call.totalTokens,
      usage_source: call.usageSource,
      error_class: call.errorClass,
      created_at: call.createdAt.toISOString(),
    })),
    summary: {
      window_size: calls.length,
      successful: successful.length,
      failed: calls.length - successful.length,
      average_latency_ms: calls.length === 0
        ? 0
        : Math.round(calls.reduce((sum, call) => sum + call.latencyMs, 0) / calls.length),
      known_token_calls: knownTokenCalls.length,
      total_tokens: knownTokenCalls.reduce((sum, call) => sum + (call.totalTokens || 0), 0),
    },
  });
}
