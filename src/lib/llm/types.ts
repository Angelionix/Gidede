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
  onTelemetry?: LlmTelemetryObserver;
}

export interface LlmTokenUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export type LlmCallStatus = "success" | "error";
export type LlmUsageSource = "provider" | "unavailable";
export type LlmTelemetryErrorClass =
  | "timeout"
  | "circuit_open"
  | "aborted"
  | "network"
  | "rate_limit"
  | "authentication"
  | "invalid_request"
  | "provider_transient"
  | "provider_error"
  | "unknown";

export interface LlmCallTelemetry {
  stage: string;
  providerId: string;
  modelId: string | null;
  status: LlmCallStatus;
  stream: boolean;
  latencyMs: number;
  usage: LlmTokenUsage;
  usageSource: LlmUsageSource;
  errorClass: LlmTelemetryErrorClass | null;
}

export type LlmTelemetryObserver = (
  event: LlmCallTelemetry
) => void | Promise<void>;

export interface LlmCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  model?: string;
  usage?: LlmTokenUsage;
}

export interface LlmStreamChunk {
  choices?: Array<{ delta?: { content?: string | null } }>;
  model?: string;
  usage?: LlmTokenUsage;
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
