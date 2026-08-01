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

type ZaiInstance = Awaited<ReturnType<typeof ZAI.create>>;

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
    return this.client.chat.completions.create(payload) as unknown as Promise<LlmCompletionResponse | AsyncIterable<LlmStreamChunk>>;
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
