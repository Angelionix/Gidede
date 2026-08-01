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
Use `secret_ref` so the value remains outside the browser, database and adapter JSON.

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
