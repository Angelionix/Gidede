import { describe, expect, it, vi } from "vitest";

const create = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: { llmCallTelemetry: { create } } }));

import { createLlmTelemetryStore } from "@/lib/llm/telemetry-store";

describe("LLM telemetry persistence — R3-10", () => {
  it("persists metadata only and never accepts prompt or response content", async () => {
    create.mockResolvedValue({ id: "call-1" });
    const store = createLlmTelemetryStore("user-1");

    await store({
      stage: "gdd",
      providerId: "provider-a",
      modelId: "actual-model",
      status: "success",
      stream: false,
      latencyMs: 42,
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      usageSource: "provider",
      errorClass: null,
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        stage: "gdd",
        provider: "provider-a",
        model: "actual-model",
        status: "success",
        stream: false,
        latencyMs: 42,
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        usageSource: "provider",
        errorClass: null,
      },
    });
    expect(JSON.stringify(create.mock.calls)).not.toContain("prompt");
    expect(JSON.stringify(create.mock.calls)).not.toContain("response");
  });
});
