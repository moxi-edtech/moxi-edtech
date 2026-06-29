import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { INFLUENCER_SESSION_COOKIE } from "@/lib/influencerSession";

export const dynamic = "force-dynamic";

function getConvertLeadErrorMessage(errorCode: string | undefined) {
  switch (errorCode) {
    case "lost_lead_cannot_convert":
      return "Leads marcados como perdidos não podem iniciar ativação.";
    case "lead_stage_not_ready":
      return "Marque o lead como Fechado Ganho antes de iniciar a ativação.";
    case "missing_plan":
      return "Defina o plano comercial antes de converter o lead.";
    case "commercial_status_not_ready":
      return "Registre a proposta e o aceite comercial antes de iniciar a ativação.";
    case "invalid_trial_days":
      return "O trial precisa estar entre 0 e 30 dias.";
    case "invalid_taxa_ativacao":
      return "A taxa de ativação precisa ser maior que zero para liberar a ativação.";
    case "lead_not_found_or_access_denied":
      return "Lead não encontrado para este parceiro.";
    default:
      return "Falha ao converter lead.";
  }
}

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

export async function POST(
  _request: Request,
  context: { params: Promise<{ codigo: string; leadId: string }> }
) {
  const { codigo, leadId } = await context.params;
  const auth = await requireInfluencerSession(codigo);
  if (!auth.ok) return auth.response;

  try {
    const supabase = await supabaseRouteClient();
    const { data, error } = await (supabase.rpc as any)("convert_influencer_crm_lead_to_onboarding", {
      p_session_id: auth.session.id,
      p_codigo: auth.session.codigo,
      p_lead_id: leadId,
    });

    if (error || !data?.ok) {
      return NextResponse.json(
        { ok: false, error: getConvertLeadErrorMessage(data?.error || error?.message) },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      already_converted: Boolean(data.already_converted),
      onboarding_request_id: data.onboarding_request_id,
      tracking_token: data.tracking_token,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
