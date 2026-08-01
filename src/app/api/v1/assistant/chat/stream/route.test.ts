import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  appendMessage: vi.fn(),
  getHistory: vi.fn(),
  generateAssistantResponse: vi.fn(),
  streamAiResponseWithSources: vi.fn(),
  getDefaultLlmStatus: vi.fn(),
  loadProjectPipelineSnapshot: vi.fn(),
}));

vi.mock("@/lib/server-auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/assistant-store", () => ({
  appendMessage: mocks.appendMessage,
  getHistory: mocks.getHistory,
  generateAssistantResponse: mocks.generateAssistantResponse,
}));
vi.mock("@/lib/ai-service", () => ({
  streamAiResponseWithSources: mocks.streamAiResponseWithSources,
}));
vi.mock("@/lib/llm/default-client", () => ({
  getDefaultLlmStatus: mocks.getDefaultLlmStatus,
}));
vi.mock("@/lib/pipeline-helpers", () => ({
  loadProjectPipelineSnapshot: mocks.loadProjectPipelineSnapshot,
}));

import { POST } from "./route";

const source = {
  source_id: "bible:bible_2_3_mda_framework:chunk-1",
  title: "MDA Framework",
  section: "2.3 MDA Framework",
  source: "docs/bible/bible_2_3_mda_framework.md",
  score: 7.2,
};

describe("POST /assistant/chat/stream provenance and telemetry — R3-09/R3-10", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1" });
    mocks.getHistory.mockResolvedValue({ messages: [] });
    mocks.getDefaultLlmStatus.mockResolvedValue({
      modelId: "model-a",
      providerId: "provider-a",
    });
    mocks.streamAiResponseWithSources.mockImplementation(
      async (_context: unknown, onDelta: (chunk: string) => void) => {
        onDelta("MDA answer");
        return {
          text: "MDA answer",
          sources: [source],
          telemetry: {
            stage: "assistant",
            providerId: "fallback-provider",
            modelId: "actual-stream-model",
            status: "success",
            stream: true,
            latencyMs: 90,
            usage: { inputTokens: 35, outputTokens: 12, totalTokens: 47 },
            usageSource: "provider",
            errorClass: null,
          },
        };
      }
    );
  });

  it("includes exact source IDs in done event and stored metadata", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/v1/assistant/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Объясни MDA" }),
      })
    );
    const events = (await response.text())
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => JSON.parse(line.slice(6)));

    expect(events).toContainEqual(
      expect.objectContaining({
        type: "done",
        source_ids: [source.source_id],
        sources: [source],
        provider: "fallback-provider",
        model_used: "actual-stream-model",
        llm_call: expect.objectContaining({
          usage: { inputTokens: 35, outputTokens: 12, totalTokens: 47 },
        }),
      })
    );
    expect(mocks.appendMessage).toHaveBeenLastCalledWith(
      "user-1",
      null,
      expect.objectContaining({
        metadata: expect.objectContaining({
          source_ids: [source.source_id],
          llm_call: expect.objectContaining({
            providerId: "fallback-provider",
            modelId: "actual-stream-model",
          }),
        }),
      })
    );
  });
});
