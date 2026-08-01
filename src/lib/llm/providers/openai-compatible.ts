import { normalizeOpenAiBaseUrl, resolveServerSecret } from "@/lib/llm/config";
import { LlmProviderError, isRetryableHttpStatus } from "@/lib/llm/errors";
import { normalizeLlmTokenUsage } from "@/lib/llm/telemetry";
import type {
  LlmClient,
  LlmCapabilities,
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmIntrospectionOptions,
  LlmModelDescriptor,
  LlmProviderHealth,
  LlmStreamChunk,
} from "@/lib/llm/types";

export interface OpenAiCompatibleClientOptions {
  providerId: string;
  baseUrl: string;
  model: string;
  secretRef?: string | null;
  fetch?: typeof fetch;
}

function completionEndpoint(baseUrl: string): string {
  return baseUrl.endsWith("/chat/completions")
    ? baseUrl
    : `${baseUrl}/chat/completions`;
}

function modelsEndpoint(baseUrl: string): string {
  const root = baseUrl.endsWith("/chat/completions")
    ? baseUrl.slice(0, -"/chat/completions".length)
    : baseUrl;
  return `${root}/models`;
}

async function parseError(response: Response): Promise<Error> {
  return new LlmProviderError(
    `OpenAI-compatible router returned ${response.status}`,
    { status: response.status, retryable: isRetryableHttpStatus(response.status) },
  );
}

async function* parseSseStream(body: ReadableStream<Uint8Array>): AsyncIterable<LlmStreamChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = done ? "" : (lines.pop() ?? "");

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        const parsed = JSON.parse(data) as Record<string, unknown>;
        const model = typeof parsed.model === "string" ? parsed.model : undefined;
        const usage = normalizeLlmTokenUsage(parsed.usage);
        yield {
          choices: parsed.choices as LlmStreamChunk["choices"],
          ...(model ? { model } : {}),
          ...(usage ? { usage } : {}),
        };
      }

      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
}

export class OpenAiCompatibleLlmClient implements LlmClient {
  readonly providerId: string;
  readonly modelId: string;
  private readonly endpoint: string;
  private readonly modelsEndpoint: string;
  private readonly secretRef: string | null;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAiCompatibleClientOptions) {
    this.providerId = options.providerId.trim();
    this.modelId = options.model.trim();
    if (!this.providerId) throw new Error("providerId is required");
    if (!this.modelId) throw new Error("model is required");
    const baseUrl = normalizeOpenAiBaseUrl(options.baseUrl);
    this.endpoint = completionEndpoint(baseUrl);
    this.modelsEndpoint = modelsEndpoint(baseUrl);
    this.secretRef = options.secretRef ?? null;
    this.fetchImpl = options.fetch ?? fetch;
  }

  createCompletion(request: LlmCompletionRequest & { stream: false }): Promise<LlmCompletionResponse>;
  createCompletion(request: LlmCompletionRequest & { stream: true }): Promise<AsyncIterable<LlmStreamChunk>>;
  async createCompletion(request: LlmCompletionRequest): Promise<LlmCompletionResponse | AsyncIterable<LlmStreamChunk>> {
    const secret = resolveServerSecret(this.secretRef);
    if (this.secretRef && !secret) {
      throw new Error(`LLM secret reference is not configured: ${this.secretRef}`);
    }

    const headers = new Headers({ "Content-Type": "application/json" });
    if (secret) headers.set("Authorization", `Bearer ${secret}`);

    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers,
      signal: request.signal,
      body: JSON.stringify({
        model: request.model || this.modelId,
        messages: request.messages,
        stream: request.stream,
        ...(request.stream ? { stream_options: { include_usage: true } } : {}),
        ...(request.temperature != null ? { temperature: request.temperature } : {}),
        ...(request.maxTokens != null ? { max_tokens: request.maxTokens } : {}),
      }),
    });

    if (!response.ok) throw await parseError(response);

    if (request.stream) {
      if (!response.body) throw new Error("OpenAI-compatible router returned an empty stream");
      return parseSseStream(response.body);
    }

    const payload = await response.json() as Record<string, unknown>;
    const usage = normalizeLlmTokenUsage(payload.usage);
    return {
      choices: payload.choices as LlmCompletionResponse["choices"],
      model: typeof payload.model === "string" ? payload.model : this.modelId,
      ...(usage ? { usage } : {}),
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      return !this.secretRef || resolveServerSecret(this.secretRef) !== null;
    } catch {
      return false;
    }
  }

  getCapabilities(): LlmCapabilities {
    return {
      streaming: true,
      jsonMode: false,
      tools: false,
      modelDiscovery: true,
    };
  }

  async healthCheck(options: LlmIntrospectionOptions = {}): Promise<LlmProviderHealth> {
    const startedAt = Date.now();
    if (!(await this.isAvailable())) {
      return {
        status: "unavailable",
        latencyMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
        reason: "secret_unavailable",
      };
    }
    try {
      await this.listModels(options);
      return {
        status: "healthy",
        latencyMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
        reason: "ok",
      };
    } catch {
      return {
        // `/models` is the only side-effect-free standard probe. A router may omit it
        // while chat completions still work, so discovery failure is not proof of outage.
        status: "unknown",
        latencyMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
        reason: "request_failed",
      };
    }
  }

  async listModels(options: LlmIntrospectionOptions = {}): Promise<LlmModelDescriptor[]> {
    const secret = resolveServerSecret(this.secretRef);
    if (this.secretRef && !secret) {
      throw new LlmProviderError("LLM secret reference is not configured");
    }
    const headers = new Headers({ Accept: "application/json" });
    if (secret) headers.set("Authorization", `Bearer ${secret}`);
    const response = await this.fetchImpl(this.modelsEndpoint, {
      method: "GET",
      headers,
      signal: options.signal,
    });
    if (!response.ok) throw await parseError(response);
    const payload = await response.json() as { data?: unknown };
    if (!Array.isArray(payload.data)) {
      throw new LlmProviderError("OpenAI-compatible models response is invalid");
    }
    return payload.data
      .flatMap((item): LlmModelDescriptor[] => {
        if (!item || typeof item !== "object") return [];
        const id = (item as { id?: unknown }).id;
        if (typeof id !== "string" || !id.trim()) return [];
        const ownedBy = (item as { owned_by?: unknown }).owned_by;
        return [{
          id: id.trim(),
          label: id.trim(),
          ownedBy: typeof ownedBy === "string" ? ownedBy : null,
        }];
      })
      .slice(0, 1_000);
  }
}

export function createOpenAiCompatibleLlmClient(options: OpenAiCompatibleClientOptions): LlmClient {
  return new OpenAiCompatibleLlmClient(options);
}
