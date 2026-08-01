export type LlmRole = "system" | "user" | "assistant";

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

export interface LlmCompletionRequest {
  messages: LlmMessage[];
  stream: boolean;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  reasoning?: "enabled" | "disabled";
  signal?: AbortSignal;
}

export interface LlmCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  model?: string;
}

export interface LlmStreamChunk {
  choices?: Array<{ delta?: { content?: string | null } }>;
}

export interface LlmCapabilities {
  streaming: boolean;
  jsonMode: boolean;
  tools: boolean;
  modelDiscovery: boolean;
}

export interface LlmModelDescriptor {
  id: string;
  label: string;
  ownedBy?: string | null;
}

export interface LlmProviderHealth {
  status: "healthy" | "unavailable" | "unknown";
  latencyMs: number;
  checkedAt: string;
  reason?: "ok" | "secret_unavailable" | "circuit_open" | "request_failed" | "not_configured";
}

export interface LlmIntrospectionOptions {
  signal?: AbortSignal;
}

export interface LlmClient {
  readonly providerId: string;
  readonly modelId: string | null;
  createCompletion(request: LlmCompletionRequest & { stream: false }): Promise<LlmCompletionResponse>;
  createCompletion(request: LlmCompletionRequest & { stream: true }): Promise<AsyncIterable<LlmStreamChunk>>;
  isAvailable(): Promise<boolean>;
  getCapabilities(): LlmCapabilities;
  healthCheck(options?: LlmIntrospectionOptions): Promise<LlmProviderHealth>;
  listModels(options?: LlmIntrospectionOptions): Promise<LlmModelDescriptor[]>;
}

export type LlmClientFactory = () => Promise<LlmClient>;
