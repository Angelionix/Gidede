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
