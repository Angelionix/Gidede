import ZAI from "z-ai-web-dev-sdk";
import type {
  LlmClient,
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmCapabilities,
  LlmModelDescriptor,
  LlmProviderHealth,
  LlmStreamChunk,
} from "@/lib/llm/types";
import { normalizeLlmTokenUsage } from "@/lib/llm/telemetry";

export interface ZaiSdkLike {
  chat: {
    completions: {
      create(payload: Record<string, unknown>): Promise<unknown>;
    };
  };
}

export type ZaiFactory = () => Promise<ZaiSdkLike>;

export interface ZaiLlmClientOptions {
  providerId?: string;
  model?: string;
  createSdk?: ZaiFactory;
}

function normalizeResponse(response: LlmCompletionResponse): LlmCompletionResponse {
  const usage = normalizeLlmTokenUsage(response.usage);
  return { ...response, ...(usage ? { usage } : {}) };
}

async function* normalizeStream(
  stream: AsyncIterable<LlmStreamChunk>
): AsyncIterable<LlmStreamChunk> {
  for await (const chunk of stream) {
    const usage = normalizeLlmTokenUsage(chunk.usage);
    yield { ...chunk, ...(usage ? { usage } : {}) };
  }
}

export class ZaiLlmClient implements LlmClient {
  readonly providerId: string;
  readonly modelId: string;
  private readonly createSdk: ZaiFactory;
  private sdkPromise: Promise<ZaiSdkLike> | null = null;

  constructor(options: ZaiLlmClientOptions = {}) {
    this.providerId = options.providerId?.trim() || "zai-sdk";
    this.modelId = options.model?.trim() || "glm-4.6";
    this.createSdk = options.createSdk ?? (async () => await ZAI.create() as unknown as ZaiSdkLike);
  }

  private getSdk(): Promise<ZaiSdkLike> {
    if (this.sdkPromise) return this.sdkPromise;
    const created = Promise.resolve().then(this.createSdk);
    const recoverable = created.catch((error) => {
      if (this.sdkPromise === recoverable) this.sdkPromise = null;
      throw error;
    });
    this.sdkPromise = recoverable;
    return recoverable;
  }

  createCompletion(request: LlmCompletionRequest & { stream: false }): Promise<LlmCompletionResponse>;
  createCompletion(request: LlmCompletionRequest & { stream: true }): Promise<AsyncIterable<LlmStreamChunk>>;
  async createCompletion(request: LlmCompletionRequest): Promise<LlmCompletionResponse | AsyncIterable<LlmStreamChunk>> {
    const payload = {
      messages: request.messages,
      stream: request.stream,
      ...(request.reasoning ? { thinking: { type: request.reasoning } } : {}),
      ...(request.temperature != null ? { temperature: request.temperature } : {}),
      ...(request.maxTokens != null ? { max_tokens: request.maxTokens } : {}),
      ...(request.model ? { model: request.model } : {}),
    };
    const client = await this.getSdk();
    const result = await client.chat.completions.create(payload) as
      LlmCompletionResponse | AsyncIterable<LlmStreamChunk>;
    return request.stream
      ? normalizeStream(result as AsyncIterable<LlmStreamChunk>)
      : normalizeResponse(result as LlmCompletionResponse);
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.getSdk();
      return true;
    } catch {
      return false;
    }
  }

  getCapabilities(): LlmCapabilities {
    return {
      streaming: true,
      jsonMode: false,
      tools: false,
      modelDiscovery: false,
    };
  }

  async healthCheck(): Promise<LlmProviderHealth> {
    const startedAt = Date.now();
    const available = await this.isAvailable();
    return {
      status: available ? "healthy" : "unavailable",
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
      reason: available ? "ok" : "request_failed",
    };
  }

  async listModels(): Promise<LlmModelDescriptor[]> {
    return [];
  }
}

export function createZaiLlmClient(options: ZaiLlmClientOptions = {}): LlmClient {
  return new ZaiLlmClient(options);
}
