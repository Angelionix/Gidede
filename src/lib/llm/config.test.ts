import { afterEach, describe, expect, it } from "vitest";
import {
  normalizeOpenAiBaseUrl,
  parseOpenAiCompatibleConfig,
  resolveServerSecret,
} from "./config";

const SECRET_ENV = "GIDEDE_TEST_CONFIG_KEY";

afterEach(() => {
  delete process.env[SECRET_ENV];
});

describe("OpenAI-compatible config — R3-02", () => {
  it("normalizes a router config while storing only an environment reference", () => {
    expect(parseOpenAiCompatibleConfig({
      label: " OpenRouter ",
      baseUrl: "https://openrouter.ai/api/v1/",
      model: " openai/gpt-4.1-mini ",
      secretRef: `env:${SECRET_ENV}`,
      enabled: true,
    })).toEqual({
      label: "OpenRouter",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "openai/gpt-4.1-mini",
      secretRef: `env:${SECRET_ENV}`,
      enabled: true,
    });
  });

  it("rejects credentials in URLs and plaintext-looking secret values", () => {
    expect(() => normalizeOpenAiBaseUrl("https://user:pass@router.example/v1"))
      .toThrow(/credentials/);
    expect(() => parseOpenAiCompatibleConfig({
      label: "Router",
      baseUrl: "https://router.example/v1",
      model: "model",
      secretRef: "sk-plaintext",
    })).toThrow(/env:VARIABLE_NAME/);
  });

  it("resolves environment secrets only on the server", () => {
    process.env[SECRET_ENV] = "  server-value  ";
    expect(resolveServerSecret(`env:${SECRET_ENV}`)).toBe("server-value");
    expect(resolveServerSecret("env:NOT_CONFIGURED_FOR_GIDEDE_TEST")).toBeNull();
  });
});
