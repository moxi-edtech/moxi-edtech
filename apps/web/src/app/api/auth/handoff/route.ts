import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { decodeSessionHandoffPayload } from "@/lib/auth/sessionHandoff";

export const dynamic = "force-dynamic";

function expireCookie(response: NextResponse, name: string, domain?: string) {
  response.cookies.set(name, "", {
    path: "/",
    maxAge: 0,
    httpOnly: false,
    secure: true,
    sameSite: "lax",
    ...(domain ? { domain } : {}),
  });
}

function clearExistingAuthCookies(request: Request, response: NextResponse) {
  const requestUrl = new URL(request.url);
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieNames = Array.from(
    new Set(
      cookieHeader
        .split(";")
        .map((part) => part.trim().split("=")[0]?.trim())
        .filter(Boolean) as string[]
    )
  );

  const domainCandidates = Array.from(
    new Set(
      [
        process.env.KLASSE_COOKIE_DOMAIN?.trim(),
        process.env.KLASSE_AUTH_COOKIE_DOMAIN?.trim(),
        requestUrl.hostname.endsWith(".klasse.ao") ? ".klasse.ao" : null,
      ].filter(Boolean) as string[]
    )
  );

  for (const name of cookieNames) {
    if (name !== "klasse_ctx" && !name.startsWith("sb-")) continue;
    expireCookie(response, name);
    for (const domain of domainCandidates) {
      expireCookie(response, name, domain);
    }
  }
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const payload = decodeSessionHandoffPayload(String(formData.get("payload") ?? ""));
  const fallback = new URL("/auth-recover?next=/redirect", request.url);

  if (!payload) {
    return NextResponse.redirect(fallback);
  }

  let destination: URL;
  try {
    destination = new URL(payload.destination);
  } catch {
    return NextResponse.redirect(fallback);
  }

  const requestUrl = new URL(request.url);
  if (destination.origin !== requestUrl.origin) {
    return NextResponse.redirect(fallback);
  }

  const supabase = await supabaseRouteClient();
  const baseResponse = NextResponse.next();
  clearExistingAuthCookies(request, baseResponse);

  const { error } = await supabase.auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  });

  if (error) {
    const failed = NextResponse.redirect(fallback);
    clearExistingAuthCookies(request, failed);
    return failed;
  }

  const redirectResponse = NextResponse.redirect(destination);
  baseResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
    redirectResponse.cookies.set(name, value, options);
  });
  return redirectResponse;
}
