import { describe, expect, it } from "vitest";
import {
  LlmCircuitOpenError,
  LlmProviderError,
  LlmTimeoutError,
} from "@/lib/llm/errors";
import {
  classifyLlmTelemetryError,
  normalizeLlmTokenUsage,
} from "@/lib/llm/telemetry";

describe("LLM telemetry normalization — R3-10", () => {
  it("normalizes OpenAI and common router usage without coercion", () => {
    expect(normalizeLlmTokenUsage({
      prompt_tokens: 10,
      completion_tokens: 4,
      total_tokens: 14,
    })).toEqual({ inputTokens: 10, outputTokens: 4, totalTokens: 14 });
    expect(normalizeLlmTokenUsage({ input_tokens: "10" })).toBeUndefined();
    expect(normalizeLlmTokenUsage({ total_tokens: -1 })).toBeUndefined();
  });

  it("classifies errors without exposing provider messages", () => {
    expect(classifyLlmTelemetryError(new LlmTimeoutError(100))).toBe("timeout");
    expect(classifyLlmTelemetryError(new LlmCircuitOpenError(100))).toBe("circuit_open");
    expect(classifyLlmTelemetryError(
      new LlmProviderError("secret provider body", { status: 429, retryable: true })
    )).toBe("rate_limit");
    expect(classifyLlmTelemetryError(
      new LlmProviderError("bad key", { status: 401 })
    )).toBe("authentication");
    expect(classifyLlmTelemetryError(new TypeError("offline"))).toBe("network");
  });
});
