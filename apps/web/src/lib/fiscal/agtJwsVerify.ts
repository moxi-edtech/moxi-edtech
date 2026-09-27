import "server-only";

import { createPublicKey, verify } from "node:crypto";

export type AgtJwsKeyStatus = "active" | "pending" | "retired" | "revoked";

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4;
  return Buffer.from(normalized + (pad ? "=".repeat(4 - pad) : ""), "base64");
}

export function verifyAgtJwsRs256(
  compactJws: string,
  publicKeyPem: string,
  keyStatus: AgtJwsKeyStatus = "active"
) {
  if (keyStatus !== "active") {
    return { ok: false as const, reason: "AGT_JWS_KEY_NOT_ACTIVE" as const };
  }

  const parts = compactJws.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    return { ok: false as const, reason: "AGT_JWS_FORMAT_INVALID" as const };
  }

  let header: unknown;
  try {
    header = JSON.parse(decodeBase64Url(parts[0]).toString("utf8"));
  } catch {
    return { ok: false as const, reason: "AGT_JWS_HEADER_INVALID" as const };
  }

  if (
    !header ||
    typeof header !== "object" ||
    Array.isArray(header) ||
    (header as { alg?: unknown }).alg !== "RS256"
  ) {
    return { ok: false as const, reason: "AGT_JWS_ALGORITHM_INVALID" as const };
  }

  try {
    const publicKey = createPublicKey(publicKeyPem);
    const signingInput = Buffer.from(`${parts[0]}.${parts[1]}`, "utf8");
    const signature = decodeBase64Url(parts[2]);
    const ok = verify("RSA-SHA256", signingInput, publicKey, signature);
    return ok
      ? { ok: true as const, reason: null }
      : { ok: false as const, reason: "AGT_JWS_SIGNATURE_INVALID" as const };
  } catch {
    return { ok: false as const, reason: "AGT_JWS_PUBLIC_KEY_INVALID" as const };
  }
}
