import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  let reach: boolean | null = null;
  let reachError: string | null = null;

  // Lightweight reachability probe (optional; ignores failures)
  if (url && anon) {
    try {
      const probe = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
        headers: { apikey: anon },
        // Keep this very short to avoid hanging during network issues
        cache: "no-store",
      });
      reach = probe.ok;
    } catch (e: any) {
      reach = false;
      reachError = e?.message || "fetch failed";
    }
  }

  return NextResponse.json({
    ok: true,
    env: {
      hasUrl: Boolean(url),
      hasAnonKey: Boolean(anon),
      hasServiceKey: Boolean(service),
      mode: process.env.NODE_ENV,
      reach,
      reachError,
    },
  });
}
