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

The adapter discovers models through the corresponding `/models` endpoint. Streaming
is declared as supported; JSON mode and tool calls remain disabled until a specialized
adapter can guarantee their exact wire format.

## Generic HTTP mapping

Select **Generic HTTP mapping** when the API uses a different request or response
shape. For this adapter the Base URL is the complete generation endpoint.

The JSON configuration supports:

- `auth_header` and `auth_scheme` for the server-side referenced secret;
- `static_headers` and `static_body` for non-secret constant values;
- request dot paths for model, messages/prompt, stream flag, temperature and token limit;
- response dot paths for generated content and actual model;
- optional `sse` or `ndjson` streaming with a content dot path.
- explicit JSON-mode and tool-call capability declarations;
- optional health and model-catalog endpoints used by the settings diagnostics.

If `stream` is `null`, a non-streaming provider is adapted to `LlmClient` streaming
as one chunk. Numeric dot-path components can read array response values, for example
`candidates.0.content`.

Secret-bearing static headers (`Authorization`, `x-api-key`, `api-key`) are rejected.
Use an environment reference or the encrypted key field so a secret never enters
adapter JSON or a plaintext database column.

Example optional introspection fields:

```json
{
  "capabilities": { "json_mode": true, "tools": false },
  "health": { "url": "https://router.example/health", "method": "GET" },
  "models": {
    "url": "https://router.example/models",
    "list_path": "data",
    "id_path": "id",
    "label_path": "name",
    "owned_by_path": "owner"
  }
}
```

Omit `health` or `models` (or set them to `null`) when the provider does not expose
those endpoints. In that case health is reported as `unknown`, and the configured
model remains usable without claiming model discovery support.

## Capability and health diagnostics

After saving a router, use **Проверить сохранённый router** in `/settings`. The UI
shows normalized health, latency, streaming/JSON/tools/model-discovery capability
badges, and adds discovered model IDs to the model input suggestions. Provider error
bodies and credentials are never returned by the diagnostics endpoint.

## Per-stage routing and fallback

One user can store multiple provider connections. The routing table in `/settings`
selects an ordered provider/model chain independently for Assistant, Concept,
Core Loop, MDA, Balance, Progression, Economy, GDD, Validation and Prototype tasks.
The `default` route is inherited when a stage has no explicit policy.

Each chain entry can override the connection's default model. Route policy also
supports optional `temperature` and `max_output_tokens`; request-specific values take
precedence. The settings UI exposes a primary and one fallback, while the validated
server contract accepts up to five ordered entries.

Fallback is intentionally narrow:

- each provider first exhausts its own retry policy;
- only classified network/timeout, HTTP `408`, `425`, `429` and `5xx` failures advance the chain;
- permanent request/auth/model errors stop immediately;
- a stream may advance only before its first emitted chunk;
- after any chunk reaches the caller, an interruption is returned without replaying text.

Without a saved route, the first enabled user connection is primary and built-in ZAI
is the transient fallback. Deleting a connection also removes its references from
saved route chains. Route entries can only reference provider configs owned by the
authenticated user.

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
`GIDEDE_LLM_CIRCUIT_COOLDOWN_MS`, `GIDEDE_LLM_CLIENT_TTL_MS`,
`GIDEDE_LLM_HEALTH_TTL_MS` and `GIDEDE_LLM_MODELS_TTL_MS`.

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
to `ai-service` or pipeline stages are required. A custom client must also implement
`getCapabilities`, `healthCheck` and `listModels`; unsupported discovery should return
an empty list and declare `modelDiscovery: false`.
