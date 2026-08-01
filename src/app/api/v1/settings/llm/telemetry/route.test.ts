import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/server-auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/db", () => ({
  db: { llmCallTelemetry: { findMany: mocks.findMany } },
}));

import { GET } from "./route";

function request(query = "") {
  return new NextRequest(`http://localhost/api/v1/settings/llm/telemetry${query}`);
}

describe("GET /settings/llm/telemetry — R3-10", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1" });
    mocks.findMany.mockResolvedValue([
      {
        id: "call-2",
        stage: "assistant",
        provider: "fallback-provider",
        model: "actual-model-v2",
        status: "success",
        stream: true,
        latencyMs: 120,
        inputTokens: 40,
        outputTokens: 20,
        totalTokens: 60,
        usageSource: "provider",
        errorClass: null,
        createdAt: new Date("2026-08-01T12:00:00.000Z"),
      },
      {
        id: "call-1",
        stage: "assistant",
        provider: "primary-provider",
        model: "primary-model",
        status: "error",
        stream: true,
        latencyMs: 80,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        usageSource: "unavailable",
        errorClass: "provider_transient",
        createdAt: new Date("2026-08-01T11:59:59.000Z"),
      },
    ]);
  });

  it("returns only the authenticated user's bounded metadata window", async () => {
    const response = await GET(request("?limit=500&stage=assistant"));

    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", stage: "assistant" },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    await expect(response.json()).resolves.toEqual({
      calls: [
        expect.objectContaining({
          provider: "fallback-provider",
          model: "actual-model-v2",
          total_tokens: 60,
          error_class: null,
        }),
        expect.objectContaining({
          provider: "primary-provider",
          status: "error",
          total_tokens: null,
          error_class: "provider_transient",
        }),
      ],
      summary: {
        window_size: 2,
        successful: 1,
        failed: 1,
        average_latency_ms: 100,
        known_token_calls: 1,
        total_tokens: 60,
      },
    });
  });

  it("requires auth and rejects an unknown stage before querying", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    await expect(GET(request())).resolves.toMatchObject({ status: 401 });

    mocks.getCurrentUser.mockResolvedValue({ id: "user-1" });
    await expect(GET(request("?stage=secret-stage"))).resolves.toMatchObject({ status: 422 });
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
