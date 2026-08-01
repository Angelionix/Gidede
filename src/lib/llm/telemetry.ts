import {
  LlmCircuitOpenError,
  LlmProviderError,
  LlmTimeoutError,
} from "@/lib/llm/errors";
import type {
  LlmCallTelemetry,
  LlmTelemetryErrorClass,
  LlmTelemetryObserver,
  LlmTokenUsage,
} from "@/lib/llm/types";

export const EMPTY_LLM_USAGE: LlmTokenUsage = {
  inputTokens: null,
  outputTokens: null,
  totalTokens: null,
};

function tokenCount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

export function normalizeLlmTokenUsage(value: unknown): LlmTokenUsage | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const usage = value as Record<string, unknown>;
  const inputTokens = tokenCount(usage.inputTokens ?? usage.input_tokens ?? usage.prompt_tokens);
  const outputTokens = tokenCount(
    usage.outputTokens ?? usage.output_tokens ?? usage.completion_tokens
  );
  const totalTokens = tokenCount(usage.totalTokens ?? usage.total_tokens);
  if (inputTokens == null && outputTokens == null && totalTokens == null) return undefined;
  return { inputTokens, outputTokens, totalTokens };
}

export function classifyLlmTelemetryError(error: unknown): LlmTelemetryErrorClass {
  if (error instanceof LlmTimeoutError) return "timeout";
  if (error instanceof LlmCircuitOpenError) return "circuit_open";
  if (error instanceof DOMException && error.name === "AbortError") return "aborted";
  if (error instanceof TypeError) return "network";
  if (error instanceof LlmProviderError) {
    if (error.status === 429) return "rate_limit";
    if (error.status === 401 || error.status === 403) return "authentication";
    if (error.status != null && [400, 404, 409, 422].includes(error.status)) {
      return "invalid_request";
    }
    return error.retryable ? "provider_transient" : "provider_error";
  }
  return "unknown";
}

export async function emitLlmTelemetry(
  event: LlmCallTelemetry,
  ...observers: Array<LlmTelemetryObserver | undefined>
): Promise<void> {
  await Promise.allSettled(
    observers.filter((observer): observer is LlmTelemetryObserver => Boolean(observer))
      .map((observer) => Promise.resolve().then(() => observer(event)))
  );
}
