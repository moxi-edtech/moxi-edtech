import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { INFLUENCER_SESSION_COOKIE } from "@/lib/influencerSession";

export const dynamic = "force-dynamic";

async function requireInfluencerSession(codigo: string) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(INFLUENCER_SESSION_COOKIE)?.value ?? "";
  if (!sessionId) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Sessão expirada." }, { status: 401 }),
    };
  }

  const supabase = await supabaseRouteClient();
  const { data, error } = await (supabase.rpc as any)("get_influencer_portal_session", {
    p_session_id: sessionId,
    p_codigo: codigo.trim().toUpperCase(),
  });

  if (error || !data?.ok || !data?.session) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Sessão expirada." }, { status: 401 }),
    };
  }

  return { ok: true as const, session: data.session };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await context.params;
  const auth = await requireInfluencerSession(codigo);
  if (!auth.ok) return auth.response;

  try {
    const supabase = await supabaseRouteClient();
    const [portalRes, assetsRes] = await Promise.all([
      (supabase.rpc as any)("get_influencer_member_portal_by_session", {
        p_session_id: auth.session.id,
        p_codigo: auth.session.codigo,
      }),
      supabase.from("marketing_assets").select("*").eq("is_active", true),
    ]);

    if (portalRes.error || !portalRes.data?.ok) {
      return NextResponse.json({ ok: false, error: "Falha ao carregar portal do parceiro." }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      portal: portalRes.data,
      assets: assetsRes.data ?? [],
      member: {
        id: auth.session.member_id,
        name: auth.session.member_name,
        role: portalRes.data.member?.role ?? "operator",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
