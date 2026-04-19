import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

function resolveAuthLoginUrl(request: Request) {
  const local = process.env.KLASSE_AUTH_LOCAL_URL?.trim();
  const prod = process.env.KLASSE_AUTH_URL?.trim();
  const base =
    process.env.NODE_ENV !== "production"
      ? local || "http://auth.lvh.me:3000/login"
      : prod;

  if (!base) {
    throw new Error("Missing KLASSE_AUTH_URL in production");
  }
  return new URL(base, request.url);
}

export async function GET(request: Request) {
  try {
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
  } catch {
    // Best-effort logout: always continue to centralized login.
  }

  return NextResponse.redirect(resolveAuthLoginUrl(request));
}
