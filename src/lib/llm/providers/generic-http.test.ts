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
});
