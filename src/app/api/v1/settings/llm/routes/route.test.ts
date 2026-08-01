import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  findConfigs: vi.fn(),
  deleteRoutes: vi.fn(),
  upsertRoute: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/server-auth", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/db", () => ({
  db: {
    userLlmConfig: { findMany: mocks.findConfigs },
    userLlmRoute: { deleteMany: mocks.deleteRoutes, upsert: mocks.upsertRoute },
    $transaction: mocks.transaction,
  },
}));

import { PUT } from "./route";

function request(routes: unknown[]): NextRequest {
  return new NextRequest("http://localhost/api/v1/settings/llm/routes", {
    method: "PUT",
    body: JSON.stringify({ routes }),
    headers: { "Content-Type": "application/json" },
  });
}

describe("PUT /settings/llm/routes — R3-07", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1" });
    mocks.findConfigs.mockResolvedValue([{ id: "concept-provider" }, { id: "gdd-provider" }]);
    mocks.deleteRoutes.mockReturnValue(Promise.resolve({ count: 0 }));
    mocks.upsertRoute.mockImplementation(({ create }) => Promise.resolve(create));
    mocks.transaction.mockImplementation((operations) => Promise.all(operations));
  });

  it("persists independent Concept and GDD provider/model chains", async () => {
    const response = await PUT(request([
      {
        stage: "concept",
        chain: [
          { config_id: "concept-provider", model: "concept-model" },
          { config_id: "builtin" },
        ],
      },
      {
        stage: "gdd",
        chain: [
          { config_id: "gdd-provider", model: "gdd-model" },
          { config_id: "concept-provider", model: "cheap-fallback" },
        ],
      },
    ]));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      routes: [
        {
          stage: "concept",
          chain: [
            { config_id: "concept-provider", model: "concept-model" },
            { config_id: "builtin", model: null },
          ],
        },
        {
          stage: "gdd",
          chain: [
            { config_id: "gdd-provider", model: "gdd-model" },
            { config_id: "concept-provider", model: "cheap-fallback" },
          ],
        },
      ],
    });
    expect(mocks.upsertRoute).toHaveBeenCalledTimes(2);
    expect(mocks.upsertRoute.mock.calls[0][0].create.chainJson).toContain("concept-model");
    expect(mocks.upsertRoute.mock.calls[1][0].create.chainJson).toContain("gdd-model");
  });

  it("rejects a provider config owned by another user", async () => {
    const response = await PUT(request([{
      stage: "concept",
      chain: [{ config_id: "foreign-provider", model: "model" }],
    }]));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ detail: expect.stringContaining("unknown provider") });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
