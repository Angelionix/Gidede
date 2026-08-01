import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LlmClient, LlmCompletionRequest } from "@/lib/llm/types";

const mocks = vi.hoisted(() => ({
  getLlmClientForStage: vi.fn(),
  buildBiblePromptContext: vi.fn(),
  createCompletion: vi.fn(),
}));

vi.mock("@/lib/llm/default-client", () => ({
  getLlmClientForStage: mocks.getLlmClientForStage,
}));
vi.mock("@/lib/llm/bible-context", () => ({
  buildBiblePromptContext: mocks.buildBiblePromptContext,
}));

import {
  generateAiResponseWithSources,
  streamAiResponseWithSources,
} from "@/lib/ai-service";

const source = {
  source_id: "bible:bible_2_3_mda_framework:chunk-1",
  title: "MDA Framework",
  section: "2.3 MDA Framework",
  source: "docs/bible/bible_2_3_mda_framework.md",
  score: 7.2,
};

describe("ai-service Bible RAG integration — R3-09", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildBiblePromptContext.mockResolvedValue({
      promptContext: "BIBLE CONTEXT WITH source_id",
      sources: [source],
    });
    mocks.getLlmClientForStage.mockResolvedValue({
      createCompletion: mocks.createCompletion,
    } as unknown as LlmClient);
  });

  it("injects Bible context and returns server-owned source provenance", async () => {
    mocks.createCompletion.mockResolvedValue({
      choices: [{ message: { content: "Ответ [bible:bible_2_3_mda_framework:chunk-1]" } }],
    });

    const response = await generateAiResponseWithSources({ message: "Объясни MDA" });

    expect(mocks.buildBiblePromptContext).toHaveBeenCalledWith("Объясни MDA");
    const request = mocks.createCompletion.mock.calls[0][0] as LlmCompletionRequest;
    expect(request.messages).toContainEqual({
      role: "system",
      content: "BIBLE CONTEXT WITH source_id",
    });
    expect(response).toEqual({
      text: "Ответ [bible:bible_2_3_mda_framework:chunk-1]",
      sources: [source],
    });
  });

  it("returns the same provenance after streaming completes", async () => {
    async function* chunks() {
      yield { choices: [{ delta: { content: "MDA " } }] };
      yield { choices: [{ delta: { content: "answer" } }] };
    }
    mocks.createCompletion.mockResolvedValue(chunks());
    const onDelta = vi.fn();

    const response = await streamAiResponseWithSources(
      { message: "Объясни MDA" },
      onDelta
    );

    expect(onDelta.mock.calls.flat()).toEqual(["MDA ", "answer"]);
    expect(response).toEqual({ text: "MDA answer", sources: [source] });
  });

  it("returns factual routed-call telemetry to the assistant API boundary", async () => {
    const telemetry = {
      stage: "assistant",
      providerId: "fallback-provider",
      modelId: "actual-model",
      status: "success" as const,
      stream: false,
      latencyMs: 55,
      usage: { inputTokens: 9, outputTokens: 3, totalTokens: 12 },
      usageSource: "provider" as const,
      errorClass: null,
    };
    mocks.createCompletion.mockImplementation(async (request: LlmCompletionRequest) => {
      await request.onTelemetry?.(telemetry);
      return { choices: [{ message: { content: "Measured answer" } }] };
    });

    await expect(
      generateAiResponseWithSources({ message: "Объясни баланс" })
    ).resolves.toMatchObject({
      text: "Measured answer",
      telemetry,
    });
  });
});
