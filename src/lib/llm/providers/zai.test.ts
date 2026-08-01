import { describe, expect, it, vi } from "vitest";
import { ZaiLlmClient, type ZaiSdkLike } from "@/lib/llm/providers/zai";

function sdk(complete: (payload: Record<string, unknown>) => Promise<unknown>): ZaiSdkLike {
  return { chat: { completions: { create: complete } } };
}

describe("ZaiLlmClient adapter — R3-11", () => {
  it("lazily initializes once and maps normalized non-streaming requests", async () => {
    const complete = vi.fn(async () => ({
      model: "glm-actual",
      choices: [{ message: { content: "answer" } }],
      usage: { prompt_tokens: 6, completion_tokens: 2, total_tokens: 8 },
    }));
    const createSdk = vi.fn(async () => sdk(complete));
    const client = new ZaiLlmClient({ createSdk });

    expect(createSdk).not.toHaveBeenCalled();
    const response = await client.createCompletion({
      messages: [{ role: "user", content: "hello" }],
      stream: false,
      model: "glm-route-override",
      temperature: 0.2,
      maxTokens: 300,
      reasoning: "disabled",
    });

    expect(createSdk).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledWith({
      messages: [{ role: "user", content: "hello" }],
      stream: false,
      thinking: { type: "disabled" },
      temperature: 0.2,
      max_tokens: 300,
      model: "glm-route-override",
    });
    expect(response).toMatchObject({
      model: "glm-actual",
      usage: { inputTokens: 6, outputTokens: 2, totalTokens: 8 },
    });
    await expect(client.isAvailable()).resolves.toBe(true);
    expect(createSdk).toHaveBeenCalledOnce();
  });

  it("normalizes streaming chunks through the common contract", async () => {
    async function* stream() {
      yield { choices: [{ delta: { content: "A" } }] };
      yield {
        model: "glm-stream-actual",
        choices: [],
        usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
      };
    }
    const client = new ZaiLlmClient({
      createSdk: async () => sdk(async () => stream()),
    });

    const chunks = await client.createCompletion({ messages: [], stream: true });
    const received: unknown[] = [];
    for await (const chunk of chunks) received.push(chunk);

    expect(received).toEqual([
      { choices: [{ delta: { content: "A" } }] },
      {
        model: "glm-stream-actual",
        choices: [],
        usage: { inputTokens: 3, outputTokens: 1, totalTokens: 4 },
      },
    ]);
  });

  it("recovers from a transient SDK initialization failure without process restart", async () => {
    const createSdk = vi.fn()
      .mockRejectedValueOnce(new Error("temporary init failure"))
      .mockResolvedValue(sdk(async () => ({
        choices: [{ message: { content: "recovered" } }],
      })));
    const client = new ZaiLlmClient({ createSdk });

    await expect(client.createCompletion({ messages: [], stream: false }))
      .rejects.toThrow("temporary init failure");
    await expect(client.createCompletion({ messages: [], stream: false }))
      .resolves.toMatchObject({ choices: [{ message: { content: "recovered" } }] });
    expect(createSdk).toHaveBeenCalledTimes(2);
  });
});
