import { resolveLlmSecretReference } from "@/lib/llm/secret-storage";

export interface OpenAiCompatibleConfigInput {
  label: unknown;
  baseUrl: unknown;
  model: unknown;
  secretRef?: unknown;
  enabled?: unknown;
}

export interface OpenAiCompatibleConfig {
  label: string;
  baseUrl: string;
  model: string;
  secretRef: string | null;
  enabled: boolean;
}

const ENV_SECRET_REF = /^env:([A-Z_][A-Z0-9_]*)$/;

function requiredString(value: unknown, field: string, maxLength: number): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) throw new Error(`${field} is required`);
  if (normalized.length > maxLength) throw new Error(`${field} is too long`);
  return normalized;
}

export function normalizeOpenAiBaseUrl(value: unknown): string {
  const raw = requiredString(value, "base_url", 2048);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("base_url must be a valid absolute URL");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("base_url must use http or https");
  }
  if (url.username || url.password) {
    throw new Error("base_url must not contain credentials");
  }
  if (url.search || url.hash) {
    throw new Error("base_url must not contain query parameters or a fragment");
  }

  return url.toString().replace(/\/$/, "");
}

export function normalizeSecretRef(value: unknown): string | null {
  if (value == null || value === "") return null;
  const secretRef = requiredString(value, "secret_ref", 128);
  if (!ENV_SECRET_REF.test(secretRef)) {
    throw new Error("secret_ref must use env:VARIABLE_NAME format");
  }
  return secretRef;
}

export function parseOpenAiCompatibleConfig(input: OpenAiCompatibleConfigInput): OpenAiCompatibleConfig {
  return {
    label: requiredString(input.label, "label", 80),
    baseUrl: normalizeOpenAiBaseUrl(input.baseUrl),
    model: requiredString(input.model, "model", 200),
    secretRef: normalizeSecretRef(input.secretRef),
    enabled: input.enabled !== false,
  };
}

export function resolveServerSecret(secretRef: string | null | undefined): string | null {
  return resolveLlmSecretReference(secretRef);
}
