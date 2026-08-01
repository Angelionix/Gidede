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

type ZaiInstance = Awaited<ReturnType<typeof ZAI.create>>;

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
  readonly providerId = "zai-sdk";
  readonly modelId = "glm-4.6";

  constructor(private readonly client: ZaiInstance) {}

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
    const result = await this.client.chat.completions.create(payload) as unknown as
      LlmCompletionResponse | AsyncIterable<LlmStreamChunk>;
    return request.stream
      ? normalizeStream(result as AsyncIterable<LlmStreamChunk>)
      : normalizeResponse(result as LlmCompletionResponse);
  }

  async isAvailable(): Promise<boolean> {
    return true;
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
    return {
      status: "healthy",
      latencyMs: 0,
      checkedAt: new Date().toISOString(),
      reason: "ok",
    };
  }

  async listModels(): Promise<LlmModelDescriptor[]> {
    return [];
  }
}

export async function createZaiLlmClient(): Promise<LlmClient> {
  return new ZaiLlmClient(await ZAI.create());
}
