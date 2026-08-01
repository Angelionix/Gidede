import { normalizeOpenAiBaseUrl, resolveServerSecret } from "@/lib/llm/config";
import { LlmProviderError, isRetryableHttpStatus } from "@/lib/llm/errors";
import type {
  LlmClient,
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmMessage,
  LlmStreamChunk,
} from "@/lib/llm/types";

type StreamProtocol = "sse" | "ndjson";
type MessagesFormat = "messages" | "prompt";

export interface GenericHttpMapping {
  authHeader: string;
  authScheme: string;
  staticHeaders: Record<string, string>;
  staticBody: Record<string, unknown>;
  request: {
    modelPath: string | null;
    messagesPath: string;
    messagesFormat: MessagesFormat;
    streamPath: string | null;
    temperaturePath: string | null;
    maxTokensPath: string | null;
  };
  response: {
    contentPath: string;
    modelPath: string | null;
  };
  stream: null | {
    protocol: StreamProtocol;
    contentPath: string;
    dataPrefix: string;
    doneSentinel: string;
  };
}

export interface GenericHttpClientOptions {
  providerId: string;
  endpoint: string;
  model: string;
  secretRef?: string | null;
  mapping: unknown;
  fetch?: typeof fetch;
}

const FORBIDDEN_PATH_PARTS = new Set(["__proto__", "prototype", "constructor"]);
const SECRET_HEADER = /^(authorization|proxy-authorization|x-api-key|api-key)$/i;
const SECRET_FIELDS = new Set([
  "apikey",
  "authorization",
  "password",
  "secret",
  "accesstoken",
  "refreshtoken",
  "bearertoken",
]);

function objectValue(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function optionalPath(value: unknown, field: string): string | null {
  if (value == null || value === "") return null;
  return requiredPath(value, field);
}

function requiredPath(value: unknown, field: string): string {
  const path = typeof value === "string" ? value.trim() : "";
  const parts = path.split(".");
  if (!path || parts.some((part) => !part || FORBIDDEN_PATH_PARTS.has(part))) {
    throw new Error(`${field} must be a safe dot path`);
  }
  return path;
}

function shortString(value: unknown, fallback: string, field: string, max = 200): string {
  if (value == null) return fallback;
  if (typeof value !== "string" || value.length > max || /[\r\n]/.test(value)) {
    throw new Error(`${field} must be a single-line string`);
  }
  return value;
}

function stringRecord(value: unknown, field: string): Record<string, string> {
  if (value == null) return {};
  const record = objectValue(value, field);
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(record)) {
    if (!key || /[\r\n]/.test(key) || typeof item !== "string" || /[\r\n]/.test(item)) {
      throw new Error(`${field} must contain valid single-line header strings`);
    }
    if (SECRET_HEADER.test(key)) {
      throw new Error(`${field}.${key} must use secret_ref and auth_header instead`);
    }
    try {
      new Headers().set(key, item);
    } catch {
      throw new Error(`${field}.${key} is not a valid HTTP header`);
    }
    result[key] = item;
  }
  return result;
}

function assertSafeStaticValue(value: unknown, field: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeStaticValue(item, `${field}.${index}`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_PATH_PARTS.has(key)) throw new Error(`${field}.${key} is not safe`);
    if (SECRET_FIELDS.has(key.replace(/[^a-z0-9]/gi, "").toLowerCase())) {
      throw new Error(`${field}.${key} must use secret_ref instead`);
    }
    assertSafeStaticValue(item, `${field}.${key}`);
  }
}

export function parseGenericHttpMapping(value: unknown): GenericHttpMapping {
  const root = objectValue(value, "config_json");
  const request = objectValue(root.request, "request");
  const response = objectValue(root.response, "response");
  const streamInput = root.stream == null ? null : objectValue(root.stream, "stream");
  const messagesFormat = request.messages_format ?? request.messagesFormat ?? "messages";
  if (messagesFormat !== "messages" && messagesFormat !== "prompt") {
    throw new Error("request.messages_format must be messages or prompt");
  }

  const streamProtocol = streamInput?.protocol ?? "sse";
  if (streamProtocol !== "sse" && streamProtocol !== "ndjson") {
    throw new Error("stream.protocol must be sse or ndjson");
  }

  const authHeader = shortString(root.auth_header ?? root.authHeader, "Authorization", "auth_header", 100);
  try {
    new Headers().set(authHeader, "secret");
  } catch {
    throw new Error("auth_header is not a valid HTTP header name");
  }

  const staticBody = (root.static_body ?? root.staticBody) == null
    ? {}
    : objectValue(root.static_body ?? root.staticBody, "static_body");
  assertSafeStaticValue(staticBody, "static_body");

  return {
    authHeader,
    authScheme: shortString(root.auth_scheme ?? root.authScheme, "Bearer", "auth_scheme", 50),
    staticHeaders: stringRecord(root.static_headers ?? root.staticHeaders, "static_headers"),
    staticBody,
    request: {
      modelPath: optionalPath(request.model_path ?? request.modelPath, "request.model_path"),
      messagesPath: requiredPath(request.messages_path ?? request.messagesPath, "request.messages_path"),
      messagesFormat,
      streamPath: optionalPath(request.stream_path ?? request.streamPath, "request.stream_path"),
      temperaturePath: optionalPath(request.temperature_path ?? request.temperaturePath, "request.temperature_path"),
      maxTokensPath: optionalPath(request.max_tokens_path ?? request.maxTokensPath, "request.max_tokens_path"),
    },
    response: {
      contentPath: requiredPath(response.content_path ?? response.contentPath, "response.content_path"),
      modelPath: optionalPath(response.model_path ?? response.modelPath, "response.model_path"),
    },
    stream: streamInput ? {
      protocol: streamProtocol,
      contentPath: requiredPath(streamInput.content_path ?? streamInput.contentPath, "stream.content_path"),
      dataPrefix: shortString(streamInput.data_prefix ?? streamInput.dataPrefix, "data:", "stream.data_prefix", 50),
      doneSentinel: shortString(streamInput.done_sentinel ?? streamInput.doneSentinel, "[DONE]", "stream.done_sentinel", 100),
    } : null,
  };
}

function pathParts(path: string): string[] {
  return path.split(".");
}

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = pathParts(path);
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    const next = cursor[part];
    if (!next || typeof next !== "object" || Array.isArray(next)) cursor[part] = {};
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts.at(-1)!] = value;
}

function getPath(target: unknown, path: string): unknown {
  let cursor = target;
  for (const part of pathParts(path)) {
    if (Array.isArray(cursor) && /^\d+$/.test(part)) {
      cursor = cursor[Number(part)];
    } else if (cursor && typeof cursor === "object") {
      cursor = (cursor as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return cursor;
}

function promptFromMessages(messages: LlmMessage[]): string {
  return messages.map(({ role, content }) => `${role}: ${content}`).join("\n\n");
}

function stringAtPath(payload: unknown, path: string, field: string): string {
  const value = getPath(payload, path);
  if (typeof value !== "string") throw new Error(`${field} did not resolve to a string`);
  return value;
}

async function* singleChunk(content: string): AsyncIterable<LlmStreamChunk> {
  yield { choices: [{ delta: { content } }] };
}

async function* parseLineStream(
  body: ReadableStream<Uint8Array>,
  mapping: NonNullable<GenericHttpMapping["stream"]>,
): AsyncIterable<LlmStreamChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = done ? "" : (lines.pop() ?? "");
      for (const rawLine of lines) {
        let data = rawLine.trim();
        if (!data) continue;
        if (mapping.protocol === "sse") {
          if (!data.startsWith(mapping.dataPrefix)) continue;
          data = data.slice(mapping.dataPrefix.length).trim();
        }
        if (!data || data === mapping.doneSentinel) continue;
        const payload = JSON.parse(data) as unknown;
        yield { choices: [{ delta: { content: stringAtPath(payload, mapping.contentPath, "stream.content_path") } }] };
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
}

export class GenericHttpLlmClient implements LlmClient {
  readonly providerId: string;
  readonly modelId: string;
  private readonly endpoint: string;
  private readonly secretRef: string | null;
  private readonly mapping: GenericHttpMapping;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GenericHttpClientOptions) {
    this.providerId = options.providerId.trim();
    this.modelId = options.model.trim();
    if (!this.providerId) throw new Error("providerId is required");
    if (!this.modelId) throw new Error("model is required");
    this.endpoint = normalizeOpenAiBaseUrl(options.endpoint);
    this.secretRef = options.secretRef ?? null;
    this.mapping = parseGenericHttpMapping(options.mapping);
    this.fetchImpl = options.fetch ?? fetch;
  }

  createCompletion(request: LlmCompletionRequest & { stream: false }): Promise<LlmCompletionResponse>;
  createCompletion(request: LlmCompletionRequest & { stream: true }): Promise<AsyncIterable<LlmStreamChunk>>;
  async createCompletion(request: LlmCompletionRequest): Promise<LlmCompletionResponse | AsyncIterable<LlmStreamChunk>> {
    const secret = resolveServerSecret(this.secretRef);
    if (this.secretRef && !secret) throw new Error(`LLM secret reference is not configured: ${this.secretRef}`);

    const wireStream = request.stream && this.mapping.stream !== null;
    const body: Record<string, unknown> = structuredClone(this.mapping.staticBody);
    const requestMap = this.mapping.request;
    if (requestMap.modelPath) setPath(body, requestMap.modelPath, request.model || this.modelId);
    setPath(
      body,
      requestMap.messagesPath,
      requestMap.messagesFormat === "prompt" ? promptFromMessages(request.messages) : request.messages,
    );
    if (requestMap.streamPath) setPath(body, requestMap.streamPath, wireStream);
    if (requestMap.temperaturePath && request.temperature != null) setPath(body, requestMap.temperaturePath, request.temperature);
    if (requestMap.maxTokensPath && request.maxTokens != null) setPath(body, requestMap.maxTokensPath, request.maxTokens);

    const headers = new Headers({ "Content-Type": "application/json", ...this.mapping.staticHeaders });
    if (secret) {
      headers.set(this.mapping.authHeader, this.mapping.authScheme ? `${this.mapping.authScheme} ${secret}` : secret);
    }
    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers,
      signal: request.signal,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new LlmProviderError(`Generic LLM router returned ${response.status}`, {
        status: response.status,
        retryable: isRetryableHttpStatus(response.status),
      });
    }

    if (wireStream) {
      if (!response.body) throw new Error("Generic LLM router returned an empty stream");
      return parseLineStream(response.body, this.mapping.stream!);
    }

    const payload = await response.json() as unknown;
    const content = stringAtPath(payload, this.mapping.response.contentPath, "response.content_path");
    if (request.stream) return singleChunk(content);
    const model = this.mapping.response.modelPath
      ? stringAtPath(payload, this.mapping.response.modelPath, "response.model_path")
      : this.modelId;
    return { choices: [{ message: { content } }], model };
  }

  async isAvailable(): Promise<boolean> {
    try {
      return !this.secretRef || resolveServerSecret(this.secretRef) !== null;
    } catch {
      return false;
    }
  }
}
