import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const MASTER_KEY_ENV = "GIDEDE_LLM_SECRETS_KEY";
const ENCRYPTED_PREFIX = "enc:v1:";
const ENVELOPE_AAD = Buffer.from("gidede:llm-secret:v1", "utf8");
const MAX_SECRET_LENGTH = 8192;

function masterKey(): Buffer {
  const encoded = process.env[MASTER_KEY_ENV]?.trim();
  if (!encoded) {
    throw new Error(`${MASTER_KEY_ENV} is required to store encrypted LLM secrets`);
  }
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new Error(`${MASTER_KEY_ENV} must be a base64-encoded 32-byte key`);
  }
  return key;
}

function encode(value: Buffer): string {
  return value.toString("base64url");
}

function decode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export type LlmSecretSource = "none" | "environment" | "encrypted";

export function getLlmSecretSource(secretRef: string | null | undefined): LlmSecretSource {
  if (!secretRef) return "none";
  if (secretRef.startsWith("env:")) return "environment";
  if (secretRef.startsWith(ENCRYPTED_PREFIX)) return "encrypted";
  return "none";
}

export function isLlmSecretEncryptionAvailable(): boolean {
  try {
    masterKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptLlmSecret(value: string): string {
  const plaintext = value.trim();
  if (!plaintext) throw new Error("api_key must not be empty");
  if (plaintext.length > MAX_SECRET_LENGTH) throw new Error("api_key is too long");

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  cipher.setAAD(ENVELOPE_AAD);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}${encode(iv)}:${encode(authTag)}:${encode(ciphertext)}`;
}

export function decryptLlmSecret(secretRef: string): string {
  if (!secretRef.startsWith(ENCRYPTED_PREFIX)) {
    throw new Error("Unsupported encrypted LLM secret format");
  }
  try {
    const parts = secretRef.slice(ENCRYPTED_PREFIX.length).split(":");
    if (parts.length !== 3) throw new Error("invalid envelope");
    const [ivPart, tagPart, ciphertextPart] = parts;
    const iv = decode(ivPart);
    const authTag = decode(tagPart);
    const ciphertext = decode(ciphertextPart);
    if (iv.length !== 12 || authTag.length !== 16 || ciphertext.length === 0) {
      throw new Error("invalid envelope");
    }

    const decipher = createDecipheriv("aes-256-gcm", masterKey(), iv);
    decipher.setAAD(ENVELOPE_AAD);
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Unable to decrypt stored LLM secret");
  }
}

export function resolveLlmSecretReference(secretRef: string | null | undefined): string | null {
  if (!secretRef) return null;
  if (secretRef.startsWith("env:")) {
    const variable = secretRef.slice(4);
    const value = process.env[variable]?.trim();
    return value || null;
  }
  if (secretRef.startsWith(ENCRYPTED_PREFIX)) return decryptLlmSecret(secretRef);
  throw new Error("Unsupported LLM secret reference");
}

export function isLlmSecretAvailable(secretRef: string | null | undefined): boolean {
  if (!secretRef) return false;
  try {
    return resolveLlmSecretReference(secretRef) !== null;
  } catch {
    return false;
  }
}

export function clientSafeLlmSecretStatus(secretRef: string | null | undefined): {
  secret_ref: string | null;
  secret_source: LlmSecretSource;
  secret_available: boolean;
} {
  const secretSource = getLlmSecretSource(secretRef);
  return {
    secret_ref: secretSource === "environment" ? secretRef! : null,
    secret_source: secretSource,
    secret_available: isLlmSecretAvailable(secretRef),
  };
}

export function selectPersistedLlmSecret(options: {
  existingSecretRef: string | null;
  environmentSecretRef: string | null;
  plaintextSecret?: unknown;
  clearSecret?: boolean;
}): string | null {
  const plaintext = typeof options.plaintextSecret === "string"
    ? options.plaintextSecret.trim()
    : "";
  if (options.plaintextSecret != null && typeof options.plaintextSecret !== "string") {
    throw new Error("api_key must be a string");
  }
  const hasReplacement = Boolean(plaintext || options.environmentSecretRef);
  if (options.clearSecret && hasReplacement) {
    throw new Error("clear_secret cannot be combined with a replacement secret");
  }
  if (plaintext && options.environmentSecretRef) {
    throw new Error("Use either api_key or secret_ref, not both");
  }
  if (plaintext) return encryptLlmSecret(plaintext);
  if (options.environmentSecretRef) return options.environmentSecretRef;
  if (options.clearSecret) return null;
  return options.existingSecretRef;
}
