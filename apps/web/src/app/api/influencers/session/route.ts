import { NextResponse } from "next/server";
import { z } from "zod";
import {
  appendExpireResponseCookie,
  appendResponseCookie,
  resolveSharedCookieOptions,
} from "@moxi/auth-middleware";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { INFLUENCER_SESSION_COOKIE } from "@/lib/influencerSession";

export const dynamic = "force-dynamic";

const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

const BodySchema = z.object({
  codigo: z.string().trim().min(1),
  memberId: z.string().uuid(),
  pin: z.string().trim().min(1),
});

function buildCookieOptions(request: Request) {
  const requestUrl = new URL(request.url);
  return {
    ...resolveSharedCookieOptions({
      nodeEnv: process.env.NODE_ENV,
      domainEnv: process.env.KLASSE_COOKIE_DOMAIN || process.env.KLASSE_AUTH_COOKIE_DOMAIN,
      sameSiteEnv: process.env.KLASSE_COOKIE_SAMESITE || process.env.KLASSE_AUTH_COOKIE_SAMESITE,
      browserHostname: requestUrl.hostname,
      isHttps: requestUrl.protocol === "https:",
    }),
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  };
}

function clearInfluencerSessionCookie(request: Request, response: NextResponse) {
  appendExpireResponseCookie(response, INFLUENCER_SESSION_COOKIE);

  const requestUrl = new URL(request.url);
  const domainCandidates = Array.from(
    new Set(
      [
        process.env.KLASSE_COOKIE_DOMAIN?.trim(),
        process.env.KLASSE_AUTH_COOKIE_DOMAIN?.trim(),
        requestUrl.hostname.endsWith(".klasse.ao") ? ".klasse.ao" : null,
      ].filter(Boolean) as string[]
    )
  );

  for (const domain of domainCandidates) {
    appendExpireResponseCookie(response, INFLUENCER_SESSION_COOKIE, domain);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
    }

    const supabase = await supabaseRouteClient();
    const codigo = parsed.data.codigo.trim().toUpperCase();
    const { data, error } = await (supabase.rpc as any)("create_influencer_portal_session", {
      p_codigo: codigo,
      p_member_id: parsed.data.memberId,
      p_pin: parsed.data.pin.trim(),
      p_ttl_minutes: Math.floor(SESSION_MAX_AGE_SECONDS / 60),
    });

    if (error) {
      return NextResponse.json({ ok: false, error: "Falha ao validar parceiro." }, { status: 401 });
    }

    if (!data?.ok) {
      return NextResponse.json({ ok: false, error: "Código, membro ou PIN inválido." }, { status: 401 });
    }

    const memberName =
      typeof data?.member?.name === "string" && data.member.name.trim()
        ? data.member.name.trim()
        : "Membro";
    const sessionId = typeof data?.session_id === "string" ? data.session_id : null;
    if (!sessionId) return NextResponse.json({ ok: false, error: "Sessão inválida." }, { status: 500 });

    const response = NextResponse.json({
      ok: true,
      codigo,
      member: {
        id: parsed.data.memberId,
        name: memberName,
      },
    });

    appendResponseCookie(
      response,
      INFLUENCER_SESSION_COOKIE,
      sessionId,
      buildCookieOptions(request)
    );

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const supabase = await supabaseRouteClient();
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${INFLUENCER_SESSION_COOKIE}=`));
  const sessionId = match ? decodeURIComponent(match.split("=").slice(1).join("=") || "") : "";

  if (sessionId) {
    await (supabase.rpc as any)("revoke_influencer_portal_session", {
      p_session_id: sessionId,
    }).catch(() => null);
  }

  const response = NextResponse.json({ ok: true });
  clearInfluencerSessionCookie(request, response);
  return response;
}
