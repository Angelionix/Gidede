import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  appendMessage: vi.fn(),
  getHistory: vi.fn(),
  generateAssistantResponse: vi.fn(),
  generateAiResponseWithSources: vi.fn(),
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
  generateAiResponseWithSources: mocks.generateAiResponseWithSources,
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

describe("POST /assistant/chat Bible provenance — R3-09", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1" });
    mocks.getHistory.mockResolvedValue({ messages: [] });
    mocks.getDefaultLlmStatus.mockResolvedValue({
      modelId: "model-a",
      providerId: "provider-a",
    });
    mocks.generateAiResponseWithSources.mockResolvedValue({
      text: "MDA answer",
      sources: [source],
    });
  });

  it("returns and persists exact source IDs supplied by the retriever", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/v1/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Объясни MDA" }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      response: "MDA answer",
      source_ids: [source.source_id],
      sources: [source],
    });
    expect(mocks.appendMessage).toHaveBeenLastCalledWith(
      "user-1",
      null,
      expect.objectContaining({
        role: "assistant",
        metadata: expect.objectContaining({
          source_ids: [source.source_id],
          sources: [source],
        }),
      })
    );
  });
});
