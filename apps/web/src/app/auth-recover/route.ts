import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function resolveAuthLoginUrl(request: Request) {
  if (process.env.NODE_ENV !== "production") {
    return (process.env.KLASSE_AUTH_LOCAL_URL ?? "http://auth.lvh.me:3000/login").trim();
  }

  return (process.env.KLASSE_AUTH_URL ?? "https://auth.klasse.ao/login").trim();
}

function resolveReturnTo(request: Request, next: string | null) {
  const requestUrl = new URL(request.url);
  if (next && next.startsWith("/")) {
    return `${requestUrl.origin}${next}`;
  }
  return `${requestUrl.origin}/redirect`;
}

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

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const next = requestUrl.searchParams.get("next");
  const loginUrl = new URL(resolveAuthLoginUrl(request));
  loginUrl.searchParams.set("redirect", resolveReturnTo(request, next));
  loginUrl.searchParams.set("error", "context");

  const response = NextResponse.redirect(loginUrl);
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

  return response;
}
