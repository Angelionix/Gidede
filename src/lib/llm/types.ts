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
}

export interface LlmCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  model?: string;
}

export interface LlmStreamChunk {
  choices?: Array<{ delta?: { content?: string | null } }>;
}

export interface LlmClient {
  readonly providerId: string;
  readonly modelId: string | null;
  createCompletion(request: LlmCompletionRequest & { stream: false }): Promise<LlmCompletionResponse>;
  createCompletion(request: LlmCompletionRequest & { stream: true }): Promise<AsyncIterable<LlmStreamChunk>>;
  isAvailable(): Promise<boolean>;
}

export type LlmClientFactory = () => Promise<LlmClient>;
