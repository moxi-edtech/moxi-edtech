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

function getCommercialErrorMessage(errorCode: string | undefined) {
  switch (errorCode) {
    case "invalid_plan":
      return "Selecione um plano comercial válido.";
    case "invalid_alunos_estimados":
      return "A estimativa de alunos não pode ser negativa.";
    case "invalid_trial_days":
      return "O trial deve ficar entre 0 e 30 dias.";
    case "invalid_taxa_ativacao":
      return "A taxa de ativação deve ser zero ou maior.";
    case "invalid_mensalidade_kz":
      return "A mensalidade precisa ser maior que zero para proposta enviada ou aceite.";
    case "invalid_commercial_status":
      return "Selecione um status comercial válido.";
    case "lead_not_found_or_access_denied":
      return "Lead não encontrado para este parceiro.";
    default:
      return "Falha ao salvar termos comerciais.";
  }
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
    const planoEstimado = typeof body.plano_estimado === "string" ? body.plano_estimado : "";
    const alunosEstimados = Number(body.alunos_estimados);
    const trialDays = Number(body.trial_days);
    const taxaAtivacao = Number(body.taxa_ativacao);
    const mensalidadeKz = Number(body.mensalidade_kz);
    const commercialStatus = typeof body.commercial_status === "string" ? body.commercial_status : "rascunho";
    const curriculumPreset = typeof body.curriculum_preset === "string" ? body.curriculum_preset : null;
    const niveisEnsino = Array.isArray(body.niveis_ensino) ? body.niveis_ensino : [];
    const contactoSecretaria = body.contacto_secretaria || null;
    const contactoFinanceiro = body.contacto_financeiro || null;
    const contactoPedagogico = body.contacto_pedagogico || null;

    const supabase = await supabaseRouteClient();
    const { data, error } = await (supabase.rpc as any)("update_influencer_crm_lead_commercial_terms", {
      p_session_id: auth.session.id,
      p_codigo: auth.session.codigo,
      p_lead_id: leadId,
      p_plano_estimado: planoEstimado,
      p_alunos_estimados: Number.isFinite(alunosEstimados) ? Math.max(0, Math.round(alunosEstimados)) : 0,
      p_trial_days: Number.isFinite(trialDays) ? Math.round(trialDays) : null,
      p_taxa_ativacao: Number.isFinite(taxaAtivacao) ? Math.max(0, Math.round(taxaAtivacao)) : null,
      p_mensalidade_kz: Number.isFinite(mensalidadeKz) ? Math.max(0, Math.round(mensalidadeKz)) : null,
      p_commercial_status: commercialStatus,
      p_curriculum_preset: curriculumPreset,
      p_niveis_ensino: niveisEnsino,
      p_contacto_secretaria: contactoSecretaria,
      p_contacto_financeiro: contactoFinanceiro,
      p_contacto_pedagogico: contactoPedagogico,
    });

    if (error || !data?.ok) {
      const message = getCommercialErrorMessage(data?.error || error?.message);
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
