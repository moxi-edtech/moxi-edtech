// @kf2 allow-scan
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseAnonKeyInfo(key: string | undefined) {
  try {
    if (!key) return null;
    const parts = key.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    return { ref: json?.ref as string | undefined, role: json?.role as string | undefined };
  } catch {
    return null;
  }
}

function getEnv() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const anonKey = (
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  ).trim();
  const hasUrl = Boolean(url);
  const hasAnonKey = !!anonKey && anonKey.length > 10 && !/YOUR-?anon-?key/i.test(anonKey);

  const mode = process.env.VERCEL
    ? "vercel"
    : process.env.NODE_ENV === "production"
      ? "production"
      : "development";

  return { url, anonKey, hasUrl, hasAnonKey, mode } as const;
}

async function checkSupabaseAuthHealth(url: string, anonKey: string) {
  let status: number | null = null;
  let ok = false;
  try {
    const res = await fetch(`${url}/auth/v1/health`, { headers: { apikey: anonKey } });
    status = res.status;
    ok = res.ok;
  } catch (e) {
    status = null;
    ok = false;
  }
  return { ok, status };
}

export async function GET() {
  const env = getEnv();

  const supabaseDetails = (() => {
    if (!env.hasUrl || !env.hasAnonKey) return null;
    const host = (() => {
      try {
        return new URL(env.url).host;
      } catch {
        return env.url;
      }
    })();
    const info = parseAnonKeyInfo(env.anonKey);
    return { host, anonKeyRef: info?.ref ?? null, anonKeyRole: info?.role ?? null };
  })();

  const authHealth =
    env.hasUrl && env.hasAnonKey ? await checkSupabaseAuthHealth(env.url, env.anonKey) : null;

  const ok = env.hasUrl && env.hasAnonKey;

  return NextResponse.json(
    {
      ok,
      env: {
        hasUrl: env.hasUrl,
        hasAnonKey: env.hasAnonKey,
        mode: env.mode,
      },
      supabase: supabaseDetails,
      auth: authHealth,
    },
    { status: ok ? 200 : 500 }
  );
}
