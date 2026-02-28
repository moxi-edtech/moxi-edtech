// apps/web/src/instrumentation.ts
// Runs once on server start. Verifies Supabase auth health and logs a concise status.

import * as Sentry from "@sentry/nextjs";

function getSupabaseEnv() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const anonKey = (
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  ).trim();
  return { url, anonKey } as const;
}

function parseAnonKeyInfo(key: string | undefined) {
  try {
    if (!key) return null;
    const parts = key.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const json = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    return { ref: json?.ref as string | undefined, role: json?.role as string | undefined };
  } catch {
    return null;
  }
}

async function checkPoolingHealth() {
  const dbUrl = process.env.DB_URL || "";
  const isProd = process.env.NODE_ENV === "production";
  
  if (isProd && dbUrl && !dbUrl.includes(":6543")) {
    console.warn(
      "[startup] DB_URL WARNING: Transaction Pooler (port 6543) not detected. Using port 5432 in production can lead to connection exhaustion under load (100+ schools)."
    );
  }
}

async function checkSupabaseAuthHealth() {
  const { url, anonKey } = getSupabaseEnv();
  const host = (() => { try { return new URL(url).host; } catch { return url; } })();

  if (!url || !anonKey) {
    console.warn("[startup] Supabase env missing: SUPABASE_URL/ANON_KEY");
    return;
  }

  const info = parseAnonKeyInfo(anonKey);
  const masked = `${anonKey.slice(0, 6)}...${anonKey.slice(-6)}`;

  try {
    // Avoid sending Authorization with anon key to Auth health endpoint
    // to prevent 401s from GoTrue treating it as a user token.
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anonKey },
    });
    const ok = res.ok;
    console.log(
      `[startup] Supabase auth health: ${ok ? "ok" : "fail"} status=${res.status} host=${host} ref=${info?.ref ?? "?"} role=${info?.role ?? "?"} key=${masked}`
    );
  } catch (e) {
    console.error(
      `[startup] Supabase auth health: error host=${host} ref=${info?.ref ?? "?"} role=${info?.role ?? "?"} key=${masked}`,
      e
    );
  }
}

export function register() {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (dsn) {
    Sentry.init({
      dsn,
      tracesSampleRate: 1.0,
      debug: false,
    });
  }

  // Disable by setting AUTH_HEALTH_ON_START=0
  if (process.env.AUTH_HEALTH_ON_START === "0") return;

  // Defer so we don't block server boot
  setTimeout(() => {
    void checkSupabaseAuthHealth();
    void checkPoolingHealth();
  }, 0);
}
