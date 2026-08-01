# LLM adapters

Gidede routes all model calls through `LlmClient`. Stage algorithms and `ai-service`
must not import provider SDKs or know provider-specific payloads.

## OpenAI-compatible API

Select **OpenAI-compatible** in `/settings` and provide:

- API base URL, such as `https://openrouter.ai/api/v1`;
- model ID;
- an optional server secret reference such as `env:OPENROUTER_API_KEY`.

The adapter calls `{base URL}/chat/completions`. If the configured URL already ends
in `/chat/completions`, it is used unchanged.

## Generic HTTP mapping

Select **Generic HTTP mapping** when the API uses a different request or response
shape. For this adapter the Base URL is the complete generation endpoint.

The JSON configuration supports:

- `auth_header` and `auth_scheme` for the server-side referenced secret;
- `static_headers` and `static_body` for non-secret constant values;
- request dot paths for model, messages/prompt, stream flag, temperature and token limit;
- response dot paths for generated content and actual model;
- optional `sse` or `ndjson` streaming with a content dot path.

If `stream` is `null`, a non-streaming provider is adapted to `LlmClient` streaming
as one chunk. Numeric dot-path components can read array response values, for example
`candidates.0.content`.

Secret-bearing static headers (`Authorization`, `x-api-key`, `api-key`) are rejected.
Use an environment reference or the encrypted key field so a secret never enters
adapter JSON or a plaintext database column.

## Secrets

Two server-side secret sources are supported:

- `env:VARIABLE_NAME` keeps the key entirely in deployment configuration;
- the API-key field encrypts the value with AES-256-GCM before persistence.

Encrypted storage requires `GIDEDE_LLM_SECRETS_KEY`, a base64-encoded 32-byte master
key. The browser receives only `secret_source`, availability status and an environment
reference when applicable. Stored ciphertext and plaintext keys are never returned.

Generate the master key once, store it in the deployment secret manager and back it up:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Changing or losing the master key makes existing encrypted provider keys unreadable.
Replace each provider key before rotating the master key.

## Resilience policy

Every configured and built-in client is wrapped by the same resilience policy:

- 30-second request and stream-chunk timeout;
- two retries with exponential backoff and bounded jitter;
- retries only for network/timeout and HTTP `408`, `425`, `429`, `5xx` errors;
- circuit opens after three failed logical requests and permits a half-open probe after 30 seconds;
- configured client instances expire after a five-minute TTL;
- a failed provider factory is evicted immediately and retried on the next request.

A stream is retried only before its first emitted chunk. Once content reached the
caller, an interruption is returned as an error instead of repeating already emitted text.

The server defaults can be adjusted with `GIDEDE_LLM_TIMEOUT_MS`,
`GIDEDE_LLM_MAX_RETRIES`, `GIDEDE_LLM_BACKOFF_BASE_MS`,
`GIDEDE_LLM_BACKOFF_MAX_MS`, `GIDEDE_LLM_CIRCUIT_FAILURE_THRESHOLD`,
`GIDEDE_LLM_CIRCUIT_COOLDOWN_MS` and `GIDEDE_LLM_CLIENT_TTL_MS`.

## Custom adapter SPI

For protocols that cannot be represented by dot paths, implement `LlmClient` and
register one descriptor during server bootstrap:

```ts
import { registerConfiguredLlmAdapter } from "@/lib/llm/configured-adapters";

registerConfiguredLlmAdapter({
  id: "vendor-plugin",
  label: "Vendor plugin",
  normalizeOptions: validateVendorOptions,
  create: (config) => new VendorLlmClient(config),
});
```

The adapter then appears in the settings API/UI. Its validated options are stored in
`configJson`; secret values must still come only from `config.secretRef`. No changes
to `ai-service` or pipeline stages are required.
