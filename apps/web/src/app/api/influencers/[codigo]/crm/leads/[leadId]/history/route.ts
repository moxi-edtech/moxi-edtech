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
  context: { params: Promise<{ codigo: string; leadId: string }> }
) {
  const { codigo, leadId } = await context.params;
  const auth = await requireInfluencerSession(codigo);
  if (!auth.ok) return auth.response;

  try {
    const supabase = await supabaseRouteClient();
    
    // Fetch logs from public.audit_logs where entity = 'crm_leads' and entity_id = leadId
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, created_at, acao, details")
      .eq("entity", "crm_leads")
      .eq("entity_id", leadId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      history: data.map(log => {
        const details = (log.details || {}) as any;
        const before = details.before && typeof details.before === "object" ? details.before : {};
        const after = details.after && typeof details.after === "object" ? details.after : {};
        const monthlyValue = typeof after.mensalidade_kz === "number"
          ? `Kz ${Number(after.mensalidade_kz).toLocaleString("pt-PT")}`
          : null;
        const commercialSummary = log.acao === "CRM_LEAD_COMMERCIAL_UPDATED"
          ? [
              after.plano_estimado ? `Plano: ${after.plano_estimado}` : null,
              monthlyValue ? `Mensalidade: ${monthlyValue}` : null,
              typeof after.trial_days === "number" ? `Trial: ${after.trial_days} dias` : null,
              typeof after.taxa_ativacao === "number" ? `Taxa: Kz ${Number(after.taxa_ativacao).toLocaleString("pt-PT")}` : null,
              after.commercial_status ? `Status: ${after.commercial_status}` : null,
            ].filter(Boolean).join(" • ")
          : "";
        const proposalUploadSummary = log.acao === "CRM_LEAD_PROPOSAL_UPLOADED"
          ? `Documento comercial anexado: ${details.file_name || "arquivo"}`
          : "";
        const convertSummary = log.acao === "CRM_LEAD_CONVERTED_TO_ONBOARDING"
          ? `Lead convertido para onboarding. Token: ${details.tracking_token || "gerado"}`
          : "";
        const fallbackNotes =
          proposalUploadSummary ||
          convertSummary ||
          commercialSummary ||
          details.notes ||
          "";

        return {
          id: log.id,
          created_at: log.created_at,
          acao: log.acao,
          member_name: details.member_name || details.member_name === "" ? details.member_name : "Sistema",
          notes: fallbackNotes,
          origem_etapa: details.origem_etapa || "",
          nova_etapa: details.nova_etapa || "",
          motivo_perda: details.motivo_perda || "",
          before,
          after,
        };
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
