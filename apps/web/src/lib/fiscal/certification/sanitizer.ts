import { createHash } from "node:crypto";

const REDACT_KEYS = new Set([
  "authorization",
  "password",
  "token",
  "access_token",
  "refresh_token",
  "cookie",
  "set-cookie",
  "secret",
  "client_secret",
  "aws_access_key_id",
  "aws_secret_access_key",
  "aws_session_token",
  "private_key",
  "privatekey",
  "private_key_ref",
  "softwareprivatekeyref",
  "taxpayerprivatekeyref",
]);

const HASH_KEYS = new Set([
  "jwssignature",
  "jwssoftwaresignature",
  "jwsdocumentsignature",
  "assinatura_base64",
  "signature",
]);

function normalizedKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

function hashValue(value: unknown) {
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  return {
    redacted: true,
    sha256: createHash("sha256").update(raw ?? "").digest("hex"),
  };
}

export function sanitizeAgtEvidence<T = unknown>(value: T): T {
  const seen = new WeakSet<object>();

  const visit = (input: unknown, key = ""): unknown => {
    const normalized = normalizedKey(key);
    if (
      REDACT_KEYS.has(normalized) ||
      (normalized.includes("private") && normalized.includes("key")) ||
      normalized.includes("kmskeyref") ||
      normalized.includes("kms_ref")
    ) {
      return "[REDACTED]";
    }
    if (HASH_KEYS.has(normalized)) return hashValue(input);

    if (Array.isArray(input)) return input.map((item) => visit(item));

    if (input && typeof input === "object") {
      if (seen.has(input as object)) return "[CIRCULAR]";
      seen.add(input as object);
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>).map(([childKey, child]) => [
          childKey,
          visit(child, childKey),
        ])
      );
    }

    if (typeof input === "string") {
      if (/-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(input)) return "[REDACTED]";
      if (/^Basic\s+[A-Za-z0-9+/=]+$/i.test(input)) return "[REDACTED]";
      if (/^Bearer\s+\S+$/i.test(input)) return "[REDACTED]";
    }

    return input;
  };

  return visit(value) as T;
}
