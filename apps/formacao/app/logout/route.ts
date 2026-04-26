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
  const response = NextResponse.redirect(resolveAuthLoginUrl(request));

  try {
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
  } catch {
    // Best-effort logout: always continue to centralized login.
  }

  const domain =
    process.env.KLASSE_COOKIE_DOMAIN?.trim() ||
    process.env.KLASSE_AUTH_COOKIE_DOMAIN?.trim() ||
    (process.env.NODE_ENV === "production" ? ".klasse.ao" : ".lvh.me");
  const sameSiteRaw = (process.env.KLASSE_AUTH_COOKIE_SAMESITE ?? "lax").toLowerCase();
  const sameSite: "lax" | "strict" | "none" =
    sameSiteRaw === "strict" || sameSiteRaw === "none" ? sameSiteRaw : "lax";

  response.cookies.set("klasse_ctx", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite,
    path: "/",
    ...(domain ? { domain } : {}),
    maxAge: 0,
  });

  return response;
}
