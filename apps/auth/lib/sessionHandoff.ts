import crypto from "node:crypto";
import { readEnv } from "@/lib/env";

type SessionHandoffPayload = {
  access_token: string;
  refresh_token: string;
  destination: string;
  exp: number;
};

function getSessionHandoffSecret() {
  return readEnv(
    process.env.KLASSE_SESSION_HANDOFF_SECRET,
    process.env.KLASSE_CONTEXT_COOKIE_SECRET,
    process.env.AUTH_CONTEXT_COOKIE_SECRET,
    process.env.CRON_SECRET,
    "dev-only-session-handoff-secret"
  );
}

function toBase64Url(value: Buffer) {
  return value
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function createSessionHandoffPayload(input: {
  accessToken: string;
  refreshToken: string;
  destination: string;
  ttlSeconds?: number;
}) {
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash("sha256").update(getSessionHandoffSecret()).digest();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const payload: SessionHandoffPayload = {
    access_token: input.accessToken,
    refresh_token: input.refreshToken,
    destination: input.destination,
    exp: Math.floor(Date.now() / 1000) + (input.ttlSeconds ?? 60),
  };

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [toBase64Url(iv), toBase64Url(tag), toBase64Url(encrypted)].join(".");
}

export function shouldUseSessionHandoff(destination: string, expectedBase: string) {
  try {
    const destinationUrl = new URL(destination);
    const expectedUrl = new URL(expectedBase);
    return destinationUrl.origin === expectedUrl.origin;
  } catch {
    return false;
  }
}
