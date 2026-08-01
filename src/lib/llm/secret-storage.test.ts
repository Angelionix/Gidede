import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clientSafeLlmSecretStatus,
  decryptLlmSecret,
  encryptLlmSecret,
  getLlmSecretSource,
  isLlmSecretAvailable,
  isLlmSecretEncryptionAvailable,
  selectPersistedLlmSecret,
} from "./secret-storage";

const MASTER_KEY_ENV = "GIDEDE_LLM_SECRETS_KEY";
let originalMasterKey: string | undefined;

beforeEach(() => {
  originalMasterKey = process.env[MASTER_KEY_ENV];
  process.env[MASTER_KEY_ENV] = Buffer.alloc(32, 7).toString("base64");
});

afterEach(() => {
  if (originalMasterKey === undefined) delete process.env[MASTER_KEY_ENV];
  else process.env[MASTER_KEY_ENV] = originalMasterKey;
});

describe("encrypted LLM secret storage — R3-04", () => {
  it("round-trips AES-256-GCM ciphertext without embedding plaintext", () => {
    const encrypted = encryptLlmSecret("sk-private-value");
    expect(encrypted).toMatch(/^enc:v1:/);
    expect(encrypted).not.toContain("sk-private-value");
    expect(decryptLlmSecret(encrypted)).toBe("sk-private-value");
    expect(getLlmSecretSource(encrypted)).toBe("encrypted");
    expect(isLlmSecretAvailable(encrypted)).toBe(true);
    const clientStatus = clientSafeLlmSecretStatus(encrypted);
    expect(clientStatus).toEqual({
      secret_ref: null,
      secret_source: "encrypted",
      secret_available: true,
    });
    expect(JSON.stringify(clientStatus)).not.toContain(encrypted);
  });

  it("rejects tampered ciphertext with a generic error", () => {
    const encrypted = encryptLlmSecret("never-leak-this");
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith("A") ? "B" : "A"}`;
    expect(() => decryptLlmSecret(tampered)).toThrow("Unable to decrypt stored LLM secret");
    expect(() => decryptLlmSecret(tampered)).not.toThrow(/never-leak-this/);
    expect(isLlmSecretAvailable(tampered)).toBe(false);
  });

  it("requires an explicit valid server master key", () => {
    delete process.env[MASTER_KEY_ENV];
    expect(isLlmSecretEncryptionAvailable()).toBe(false);
    expect(() => encryptLlmSecret("secret")).toThrow(MASTER_KEY_ENV);

    process.env[MASTER_KEY_ENV] = Buffer.alloc(16, 1).toString("base64");
    expect(() => encryptLlmSecret("secret")).toThrow(/32-byte key/);
  });

  it("preserves, replaces and explicitly clears persisted secret references", () => {
    const existing = encryptLlmSecret("old-secret");
    expect(selectPersistedLlmSecret({
      existingSecretRef: existing,
      environmentSecretRef: null,
    })).toBe(existing);

    const replacement = selectPersistedLlmSecret({
      existingSecretRef: existing,
      environmentSecretRef: null,
      plaintextSecret: "new-secret",
    });
    expect(replacement).not.toBe(existing);
    expect(decryptLlmSecret(replacement!)).toBe("new-secret");

    expect(selectPersistedLlmSecret({
      existingSecretRef: replacement,
      environmentSecretRef: null,
      clearSecret: true,
    })).toBeNull();
    expect(() => selectPersistedLlmSecret({
      existingSecretRef: null,
      environmentSecretRef: "env:ROUTER_KEY",
      plaintextSecret: "conflict",
    })).toThrow(/either api_key or secret_ref/);
  });
});
