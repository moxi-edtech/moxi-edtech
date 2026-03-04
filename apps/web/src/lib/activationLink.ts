import crypto from "crypto";

export type ActivationTokenPayload = {
  escola_id: string;
  escola_nome: string;
  exp: number;
  v?: string;
};

const TOKEN_VERSION = "v1";

function base64UrlEncode(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64").toString("utf-8");
}

function resolveActivationSecret() {
  return (
    process.env.ACTIVATION_LINK_SECRET ||
    process.env.AUTH_ADMIN_JOB_TOKEN ||
    process.env.OUTBOX_JOB_TOKEN ||
    process.env.CRON_SECRET ||
    ""
  ).trim();
}

export function createActivationToken(payload: ActivationTokenPayload) {
  const secret = resolveActivationSecret();
  if (!secret) return null;
  const body = { ...payload, v: TOKEN_VERSION };
  const encoded = base64UrlEncode(JSON.stringify(body));
  const signature = base64UrlEncode(crypto.createHmac("sha256", secret).update(encoded).digest());
  return `${encoded}.${signature}`;
}

export function verifyActivationToken(token: string): ActivationTokenPayload | null {
  const secret = resolveActivationSecret();
  if (!secret) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = base64UrlEncode(crypto.createHmac("sha256", secret).update(encoded).digest());
  if (expected !== signature) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as ActivationTokenPayload;
    if (payload.v && payload.v !== TOKEN_VERSION) return null;
    if (!payload.escola_nome || !payload.escola_id || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
