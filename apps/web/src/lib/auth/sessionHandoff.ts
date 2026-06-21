import crypto from "node:crypto";

type SessionHandoffPayload = {
  access_token: string;
  refresh_token: string;
  destination: string;
  exp: number;
};

function getSessionHandoffSecret() {
  return (
    process.env.KLASSE_SESSION_HANDOFF_SECRET?.trim() ||
    process.env.KLASSE_CONTEXT_COOKIE_SECRET?.trim() ||
    process.env.AUTH_CONTEXT_COOKIE_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "dev-only-session-handoff-secret"
  );
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${pad}`, "base64");
}

export function decodeSessionHandoffPayload(raw: string): SessionHandoffPayload | null {
  const [ivEncoded, tagEncoded, encryptedEncoded] = raw.split(".");
  if (!ivEncoded || !tagEncoded || !encryptedEncoded) return null;

  try {
    const iv = fromBase64Url(ivEncoded);
    const tag = fromBase64Url(tagEncoded);
    const encrypted = fromBase64Url(encryptedEncoded);
    const key = crypto.createHash("sha256").update(getSessionHandoffSecret()).digest();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    const payload = JSON.parse(decrypted) as SessionHandoffPayload;
    if (!payload.access_token || !payload.refresh_token || !payload.destination || !payload.exp) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
