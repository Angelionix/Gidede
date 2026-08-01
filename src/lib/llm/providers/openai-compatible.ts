import { normalizeOpenAiBaseUrl, resolveServerSecret } from "@/lib/llm/config";
import type {
  LlmClient,
  LlmCompletionRequest,
  LlmCompletionResponse,
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

function errorDetail(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const error = (payload as { error?: unknown }).error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return null;
}

async function parseError(response: Response): Promise<Error> {
  const payload = await response.json().catch(() => null);
  const detail = errorDetail(payload);
  return new Error(
    `OpenAI-compatible router returned ${response.status}${detail ? `: ${detail}` : ""}`,
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
        const parsed = JSON.parse(data) as LlmStreamChunk;
        yield { choices: parsed.choices };
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
  private readonly secretRef: string | null;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAiCompatibleClientOptions) {
    this.providerId = options.providerId.trim();
    this.modelId = options.model.trim();
    if (!this.providerId) throw new Error("providerId is required");
    if (!this.modelId) throw new Error("model is required");
    this.endpoint = completionEndpoint(normalizeOpenAiBaseUrl(options.baseUrl));
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
      body: JSON.stringify({
        model: request.model || this.modelId,
        messages: request.messages,
        stream: request.stream,
        ...(request.temperature != null ? { temperature: request.temperature } : {}),
        ...(request.maxTokens != null ? { max_tokens: request.maxTokens } : {}),
      }),
    });

    if (!response.ok) throw await parseError(response);

    if (request.stream) {
      if (!response.body) throw new Error("OpenAI-compatible router returned an empty stream");
      return parseSseStream(response.body);
    }

    const payload = await response.json() as LlmCompletionResponse;
    return { choices: payload.choices, model: payload.model || this.modelId };
  }

  async isAvailable(): Promise<boolean> {
    return !this.secretRef || resolveServerSecret(this.secretRef) !== null;
  }
}

export function createOpenAiCompatibleLlmClient(options: OpenAiCompatibleClientOptions): LlmClient {
  return new OpenAiCompatibleLlmClient(options);
}
