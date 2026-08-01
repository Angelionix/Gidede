import { db } from "@/lib/db";
import type { LlmTelemetryObserver } from "@/lib/llm/types";

export function createLlmTelemetryStore(userId: string): LlmTelemetryObserver {
  return async (event) => {
    await db.llmCallTelemetry.create({
      data: {
        userId,
        stage: event.stage,
        provider: event.providerId,
        model: event.modelId,
        status: event.status,
        stream: event.stream,
        latencyMs: event.latencyMs,
        inputTokens: event.usage.inputTokens,
        outputTokens: event.usage.outputTokens,
        totalTokens: event.usage.totalTokens,
        usageSource: event.usageSource,
        errorClass: event.errorClass,
      },
    });
  };
}
