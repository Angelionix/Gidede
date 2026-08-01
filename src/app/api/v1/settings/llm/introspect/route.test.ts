import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { LlmClient } from "@/lib/llm/types";

const { getCurrentUserMock, getDefaultLlmClientMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  getDefaultLlmClientMock: vi.fn(),
}));

vi.mock("@/lib/server-auth", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/lib/llm/default-client", () => ({ getDefaultLlmClient: getDefaultLlmClientMock }));

import { POST } from "./route";

function request(): NextRequest {
  return new NextRequest("http://localhost/api/v1/settings/llm/introspect", { method: "POST" });
}

function client(overrides: Partial<LlmClient> = {}): LlmClient {
  return {
    providerId: "openai-compatible:test",
    modelId: "model-a",
    getCapabilities: () => ({ streaming: true, jsonMode: false, tools: false, modelDiscovery: true }),
    healthCheck: vi.fn(async () => ({
      status: "healthy",
      latencyMs: 12,
      checkedAt: "2026-08-01T00:00:00.000Z",
      reason: "ok",
    })),
    listModels: vi.fn(async () => [{ id: "model-a", label: "Model A" }]),
    ...overrides,
  } as unknown as LlmClient;
}

describe("POST /settings/llm/introspect — R3-06", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserMock.mockResolvedValue({ id: "user-1" });
  });

  it("requires authentication", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(getDefaultLlmClientMock).not.toHaveBeenCalled();
  });

  it("returns normalized health, capabilities and discovered models", async () => {
    getDefaultLlmClientMock.mockResolvedValue(client());

    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      provider: "openai-compatible:test",
      configured_model: "model-a",
      capabilities: { streaming: true, jsonMode: false, tools: false, modelDiscovery: true },
      health: { status: "healthy", latencyMs: 12, reason: "ok" },
      models: [{ id: "model-a", label: "Model A" }],
      models_error: null,
    });
  });

  it("does not call model discovery when the adapter does not declare it", async () => {
    const listModels = vi.fn();
    getDefaultLlmClientMock.mockResolvedValue(client({
      getCapabilities: () => ({ streaming: true, jsonMode: false, tools: false, modelDiscovery: false }),
      listModels,
    }));

    const response = await POST(request());

    await expect(response.json()).resolves.toMatchObject({ models: [], models_error: null });
    expect(listModels).not.toHaveBeenCalled();
  });
});
