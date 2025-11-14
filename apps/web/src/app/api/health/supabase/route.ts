// apps/web/src/app/api/health/supabase/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

export async function GET() {
  try {
    const { url, anonKey } = getSupabaseEnv();
    if (!url || !anonKey) {
      return NextResponse.json(
        { ok: false, error: "Missing SUPABASE_URL/ANON_KEY envs" },
        { status: 500 }
      );
    }

    const keyInfo = parseAnonKeyInfo(anonKey);

    let healthStatus: number | null = null;
    let healthOk = false;
    try {
      // For the Auth health endpoint, don't send Authorization with the anon key.
      // Some GoTrue versions prioritize Authorization (user token) over apikey
      // and will 401 if it's not a valid user JWT.
      const res = await fetch(`${url}/auth/v1/health`, {
        headers: { apikey: anonKey },
      });
      healthStatus = res.status;
      healthOk = res.ok;
    } catch (e) {
      // network or fetch error
      healthStatus = null;
      healthOk = false;
    }

    const masked = `${anonKey.slice(0, 6)}...${anonKey.slice(-6)}`;
    const host = (() => {
      try { return new URL(url).host; } catch { return url; }
    })();

    return NextResponse.json({
      ok: true,
      env: {
        urlHost: host,
        anonKeyMasked: masked,
        anonKeyRef: keyInfo?.ref,
        anonKeyRole: keyInfo?.role,
      },
      authHealth: {
        ok: healthOk,
        status: healthStatus,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
