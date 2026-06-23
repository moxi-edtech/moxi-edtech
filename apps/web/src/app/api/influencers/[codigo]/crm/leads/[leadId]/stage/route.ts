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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ codigo: string; leadId: string }> }
) {
  const { codigo, leadId } = await context.params;
  const auth = await requireInfluencerSession(codigo);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { etapa, motivo_perda } = body;

    if (!etapa) {
      return NextResponse.json({ ok: false, error: "Etapa é obrigatória." }, { status: 400 });
    }

    const supabase = await supabaseRouteClient();
    const { data, error } = await (supabase.rpc as any)("update_influencer_crm_lead_stage", {
      p_session_id: auth.session.id,
      p_codigo: auth.session.codigo,
      p_lead_id: leadId,
      p_etapa: etapa,
      p_motivo_perda: motivo_perda || null,
    });

    if (error || !data?.ok) {
      return NextResponse.json({ ok: false, error: error?.message || "Falha ao atualizar etapa do lead." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
