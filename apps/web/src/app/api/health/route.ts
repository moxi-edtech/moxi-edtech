import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const now = new Date();
  const uptime = typeof process?.uptime === "function" ? process.uptime() : null;
  return NextResponse.json({
    ok: true,
    status: "ready",
    now: now.toISOString(),
    uptime,
    env: {
      node: process.version,
      mode: process.env.NODE_ENV,
      hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      hasServiceKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
  });
}

