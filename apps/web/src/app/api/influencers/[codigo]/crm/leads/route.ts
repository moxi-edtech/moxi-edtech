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
    const { data, error } = await (supabase.rpc as any)("get_influencer_crm_leads", {
      p_session_id: auth.session.id,
      p_codigo: auth.session.codigo,
    });

    if (error || !data?.ok) {
      return NextResponse.json({ ok: false, error: error?.message || "Falha ao buscar leads." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      leads: data.leads ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await context.params;
  const auth = await requireInfluencerSession(codigo);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const {
      nome_escola,
      nome_contacto,
      telefone,
      email,
      segmento,
      alunos_estimados,
      plano_estimado,
      proxima_acao,
      proxima_acao_data,
      trial_days,
      taxa_ativacao,
      responsavel_membro_id,
      marketing_lead_id,
    } = body;

    if (!nome_escola) {
      return NextResponse.json({ ok: false, error: "Nome da escola é obrigatório." }, { status: 400 });
    }

    const trialDaysNumber = Number(trial_days);
    const taxaAtivacaoNumber = Number(taxa_ativacao);

    const supabase = await supabaseRouteClient();
    const { data, error } = await (supabase.rpc as any)("create_influencer_crm_lead", {
      p_session_id: auth.session.id,
      p_codigo: auth.session.codigo,
      p_nome_escola: nome_escola,
      p_nome_contacto: nome_contacto || null,
      p_telefone: telefone || null,
      p_email: email || null,
      p_segmento: segmento || "privada",
      p_alunos_estimados: Number(alunos_estimados) || 0,
      p_plano_estimado: plano_estimado || "essencial",
      p_proxima_acao: proxima_acao || null,
      p_proxima_acao_data: proxima_acao_data || null,
      p_trial_days: Number.isFinite(trialDaysNumber) ? Math.min(30, Math.max(0, trialDaysNumber)) : 15,
      p_taxa_ativacao: Number.isFinite(taxaAtivacaoNumber) ? Math.max(0, taxaAtivacaoNumber) : 50000,
      p_responsavel_membro_id: responsavel_membro_id || null,
      p_marketing_lead_id: marketing_lead_id || null,
    });

    if (error || !data?.ok) {
      return NextResponse.json({ ok: false, error: error?.message || "Falha ao criar lead." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      lead_id: data.lead_id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
