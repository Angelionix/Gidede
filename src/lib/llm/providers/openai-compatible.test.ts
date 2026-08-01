import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAiCompatibleLlmClient } from "./openai-compatible";

const SECRET_ENV = "GIDEDE_TEST_ROUTER_KEY";

afterEach(() => {
  delete process.env[SECRET_ENV];
});

describe("OpenAiCompatibleLlmClient — R3-02", () => {
  it("maps a normalized request to chat/completions without exposing provider details upstream", async () => {
    process.env[SECRET_ENV] = "test-secret";
    const fetchMock = vi.fn(async () => Response.json({
      model: "router-model-v2",
      choices: [{ message: { content: "Hello" } }],
      usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
    }));
    const client = new OpenAiCompatibleLlmClient({
      providerId: "openai-compatible:test",
      baseUrl: "https://router.example/api/v1/",
      model: "router-model",
      secretRef: `env:${SECRET_ENV}`,
      fetch: fetchMock as typeof fetch,
    });

    const response = await client.createCompletion({
      messages: [{ role: "user", content: "Hi" }],
      stream: false,
      temperature: 0.4,
      maxTokens: 123,
    });

    expect(response.choices?.[0]?.message?.content).toBe("Hello");
    expect(response.model).toBe("router-model-v2");
    expect(response.usage).toEqual({ inputTokens: 11, outputTokens: 7, totalTokens: 18 });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit?];
    expect(url).toBe("https://router.example/api/v1/chat/completions");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer test-secret");
    expect(JSON.parse(String(init?.body))).toEqual({
      model: "router-model",
      messages: [{ role: "user", content: "Hi" }],
      stream: false,
      temperature: 0.4,
      max_tokens: 123,
    });
  });

  it("parses fragmented OpenAI SSE chunks and ignores the done sentinel", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hel'));
        controller.enqueue(encoder.encode('lo"}}]}\n\ndata: {"choices":[{"delta":{"content":"!"}}]}\n'));
        controller.enqueue(encoder.encode('\ndata: {"model":"actual-stream-model","choices":[],"usage":{"prompt_tokens":5,"completion_tokens":2,"total_tokens":7}}\n'));
        controller.enqueue(encoder.encode("\ndata: [DONE]\n\n"));
        controller.close();
      },
    });
    const client = new OpenAiCompatibleLlmClient({
      providerId: "openai-compatible:local",
      baseUrl: "http://localhost:11434/v1",
      model: "local-model",
      fetch: vi.fn(async () => new Response(stream)) as typeof fetch,
    });

    const chunks = await client.createCompletion({
      messages: [{ role: "user", content: "Hi" }],
      stream: true,
    });
    const content: string[] = [];
    let usage;
    let model;
    for await (const chunk of chunks) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) content.push(delta);
      if (chunk.usage) usage = chunk.usage;
      if (chunk.model) model = chunk.model;
    }

    expect(content).toEqual(["Hello", "!"]);
    expect(model).toBe("actual-stream-model");
    expect(usage).toEqual({ inputTokens: 5, outputTokens: 2, totalTokens: 7 });
  });

  it("fails closed when a referenced server secret is unavailable", async () => {
    const fetchMock = vi.fn();
    const client = new OpenAiCompatibleLlmClient({
      providerId: "openai-compatible:test",
      baseUrl: "https://router.example/v1",
      model: "model",
      secretRef: `env:${SECRET_ENV}`,
      fetch: fetchMock as typeof fetch,
    });

    await expect(client.isAvailable()).resolves.toBe(false);
    await expect(client.createCompletion({
      messages: [],
      stream: false,
    })).rejects.toThrow(`env:${SECRET_ENV}`);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports router errors without including the configured secret", async () => {
    process.env[SECRET_ENV] = "never-log-this";
    const client = new OpenAiCompatibleLlmClient({
      providerId: "openai-compatible:test",
      baseUrl: "https://router.example/v1/chat/completions",
      model: "missing",
      secretRef: `env:${SECRET_ENV}`,
      fetch: vi.fn(async () => Response.json(
        { error: { message: "model not found" } },
        { status: 404 },
      )) as typeof fetch,
    });

    const error = await client.createCompletion({ messages: [], stream: false }).catch((value) => value);
    expect(error.message).toContain("404");
    expect(error.message).not.toContain("model not found");
    expect(error.message).not.toContain("never-log-this");
  });

  it("declares conservative capabilities and discovers models through the standard endpoint", async () => {
    process.env[SECRET_ENV] = "discovery-secret";
    const fetchMock = vi.fn(async () => Response.json({
      data: [
        { id: "vendor/model-a", owned_by: "vendor" },
        { id: "vendor/model-b" },
        { invalid: true },
      ],
    }));
    const client = new OpenAiCompatibleLlmClient({
      providerId: "openai-compatible:discovery",
      baseUrl: "https://router.example/api/v1/chat/completions",
      model: "vendor/model-a",
      secretRef: `env:${SECRET_ENV}`,
      fetch: fetchMock as typeof fetch,
    });

    expect(client.getCapabilities()).toEqual({
      streaming: true,
      jsonMode: false,
      tools: false,
      modelDiscovery: true,
    });
    await expect(client.listModels()).resolves.toEqual([
      { id: "vendor/model-a", label: "vendor/model-a", ownedBy: "vendor" },
      { id: "vendor/model-b", label: "vendor/model-b", ownedBy: null },
    ]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://router.example/api/v1/models");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer discovery-secret");
  });
});
