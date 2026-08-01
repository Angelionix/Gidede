import { afterEach, describe, expect, it, vi } from "vitest";
import { GenericHttpLlmClient, parseGenericHttpMapping } from "./generic-http";

const SECRET_ENV = "GIDEDE_GENERIC_ROUTER_KEY";

afterEach(() => {
  delete process.env[SECRET_ENV];
});

const mapping = {
  auth_header: "x-api-key",
  auth_scheme: "",
  static_headers: { "x-client": "gidede" },
  static_body: { safety: { enabled: true } },
  request: {
    model_path: "generation.model",
    messages_path: "generation.prompt",
    messages_format: "prompt",
    stream_path: "generation.streaming",
    temperature_path: "generation.options.temperature",
    max_tokens_path: "generation.options.limit",
  },
  response: {
    content_path: "candidates.0.text",
    model_path: "meta.model",
  },
  stream: null,
};

describe("GenericHttpLlmClient — R3-03", () => {
  it("maps nested request and response paths for a non-standard JSON API", async () => {
    process.env[SECRET_ENV] = "generic-secret";
    const fetchMock = vi.fn(async () => Response.json({
      candidates: [{ text: "Mapped response" }],
      meta: { model: "actual-model" },
    }));
    const client = new GenericHttpLlmClient({
      providerId: "generic-http:vendor",
      endpoint: "https://vendor.example/generate/",
      model: "configured-model",
      secretRef: `env:${SECRET_ENV}`,
      mapping,
      fetch: fetchMock as typeof fetch,
    });

    const response = await client.createCompletion({
      messages: [
        { role: "system", content: "Be concise" },
        { role: "user", content: "Hello" },
      ],
      stream: false,
      temperature: 0.25,
      maxTokens: 80,
    });

    expect(response).toEqual({
      choices: [{ message: { content: "Mapped response" } }],
      model: "actual-model",
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit];
    expect(url).toBe("https://vendor.example/generate");
    expect(new Headers(init.headers).get("x-api-key")).toBe("generic-secret");
    expect(new Headers(init.headers).get("x-client")).toBe("gidede");
    expect(JSON.parse(String(init.body))).toEqual({
      safety: { enabled: true },
      generation: {
        model: "configured-model",
        prompt: "system: Be concise\n\nuser: Hello",
        streaming: false,
        options: { temperature: 0.25, limit: 80 },
      },
    });
  });

  it("maps fragmented NDJSON stream chunks", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"event":{"token":"A'));
        controller.enqueue(encoder.encode('"}}\n{"event":{"token":"B"}}\n'));
        controller.close();
      },
    });
    const client = new GenericHttpLlmClient({
      providerId: "generic-http:ndjson",
      endpoint: "http://localhost:9000/generate",
      model: "local",
      mapping: {
        ...mapping,
        stream: {
          protocol: "ndjson",
          content_path: "event.token",
          done_sentinel: "done",
        },
      },
      fetch: vi.fn(async () => new Response(body)) as typeof fetch,
    });

    const chunks = await client.createCompletion({ messages: [], stream: true });
    const content: string[] = [];
    for await (const chunk of chunks) content.push(chunk.choices?.[0]?.delta?.content || "");
    expect(content).toEqual(["A", "B"]);
  });

  it("adapts a non-streaming API to the streaming contract with one chunk", async () => {
    const client = new GenericHttpLlmClient({
      providerId: "generic-http:single",
      endpoint: "https://vendor.example/generate",
      model: "model",
      mapping,
      fetch: vi.fn(async () => Response.json({
        candidates: [{ text: "One chunk" }],
        meta: { model: "model" },
      })) as typeof fetch,
    });

    const chunks = await client.createCompletion({ messages: [], stream: true });
    const content: string[] = [];
    for await (const chunk of chunks) content.push(chunk.choices?.[0]?.delta?.content || "");
    expect(content).toEqual(["One chunk"]);
  });

  it("maps provider token usage for completion and usage-only stream events", async () => {
    const usageMapping = {
      ...mapping,
      response: {
        ...mapping.response,
        usage: {
          input_tokens_path: "meta.usage.in",
          output_tokens_path: "meta.usage.out",
          total_tokens_path: "meta.usage.total",
        },
      },
    };
    const completionClient = new GenericHttpLlmClient({
      providerId: "generic-http:usage",
      endpoint: "https://vendor.example/generate",
      model: "configured",
      mapping: usageMapping,
      fetch: vi.fn(async () => Response.json({
        candidates: [{ text: "Measured" }],
        meta: { model: "actual", usage: { in: 8, out: 3, total: 11 } },
      })) as typeof fetch,
    });

    await expect(completionClient.createCompletion({ messages: [], stream: false })).resolves.toMatchObject({
      model: "actual",
      usage: { inputTokens: 8, outputTokens: 3, totalTokens: 11 },
    });

    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(
          '{"event":{"token":"A"}}\n{"meta":{"model":"stream-actual","usage":{"in":4,"out":1,"total":5}}}\n'
        ));
        controller.close();
      },
    });
    const streamClient = new GenericHttpLlmClient({
      providerId: "generic-http:stream-usage",
      endpoint: "https://vendor.example/generate",
      model: "configured",
      mapping: {
        ...usageMapping,
        stream: {
          protocol: "ndjson",
          content_path: "event.token",
          model_path: "meta.model",
          usage: {
            input_tokens_path: "meta.usage.in",
            output_tokens_path: "meta.usage.out",
            total_tokens_path: "meta.usage.total",
          },
        },
      },
      fetch: vi.fn(async () => new Response(body)) as typeof fetch,
    });

    const chunks = await streamClient.createCompletion({ messages: [], stream: true });
    const received: unknown[] = [];
    for await (const chunk of chunks) received.push(chunk);
    expect(received).toEqual([
      { choices: [{ delta: { content: "A" } }] },
      {
        model: "stream-actual",
        usage: { inputTokens: 4, outputTokens: 1, totalTokens: 5 },
      },
    ]);
  });

  it("rejects unsafe paths and secret-bearing static headers", () => {
    expect(() => parseGenericHttpMapping({
      ...mapping,
      request: { ...mapping.request, messages_path: "__proto__.polluted" },
    })).toThrow(/safe dot path/);
    expect(() => parseGenericHttpMapping({
      ...mapping,
      static_headers: { Authorization: "plaintext-secret" },
    })).toThrow(/secret_ref/);
    expect(() => parseGenericHttpMapping({
      ...mapping,
      static_body: { credentials: { api_key: "plaintext-secret" } },
    })).toThrow(/secret_ref/);
  });

  it("round-trips normalized mapping options stored by the adapter registry", () => {
    const normalized = parseGenericHttpMapping(mapping);
    expect(parseGenericHttpMapping(normalized)).toEqual(normalized);
  });

  it("uses declared capabilities and mapped health/model discovery endpoints", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).endsWith("/health")) return new Response(null, { status: 204 });
      return Response.json({ catalog: [{ slug: "m-1", title: "Model One", vendor: "acme" }] });
    });
    const client = new GenericHttpLlmClient({
      providerId: "generic-http:introspection",
      endpoint: "https://vendor.example/generate",
      model: "m-1",
      mapping: {
        ...mapping,
        capabilities: { json_mode: true, tools: true },
        health: { url: "https://vendor.example/health", method: "HEAD" },
        models: {
          url: "https://vendor.example/models",
          list_path: "catalog",
          id_path: "slug",
          label_path: "title",
          owned_by_path: "vendor",
        },
      },
      fetch: fetchMock as typeof fetch,
    });

    expect(client.getCapabilities()).toEqual({
      streaming: false,
      jsonMode: true,
      tools: true,
      modelDiscovery: true,
    });
    await expect(client.healthCheck()).resolves.toMatchObject({ status: "healthy", reason: "ok" });
    await expect(client.listModels()).resolves.toEqual([
      { id: "m-1", label: "Model One", ownedBy: "acme" },
    ]);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "https://vendor.example/health",
      "https://vendor.example/models",
    ]);
  });
});
