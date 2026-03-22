import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { parsePlanTier } from "@/config/plans";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ plano: null, error: "Não autenticado" }, { status: 401 });

    const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
    const resolvedEscolaId = await resolveEscolaIdForUser(
      supabase as any,
      user.id,
      id,
      metaEscolaId ? String(metaEscolaId) : null
    );

    if (!resolvedEscolaId) {
      return NextResponse.json({ plano: null, error: "Sem permissão" }, { status: 403 });
    }

    const { data } = await supabase
      .from('vw_escola_info')
      .select('plano_atual')
      .eq('escola_id', resolvedEscolaId)
      .maybeSingle();
    const planoRaw = (data as any)?.plano_atual ?? null;
    const plano = planoRaw ? parsePlanTier(planoRaw) : null;

    const { data: limites } = plano
      ? await supabase
          .from('app_plan_limits')
          .select('plan, price_mensal_kz, max_alunos, max_admin_users, max_storage_gb, professores_ilimitados, api_enabled, multi_campus, fin_recibo_pdf, sec_upload_docs, sec_matricula_online, doc_qr_code, app_whatsapp_auto, suporte_prioritario')
          .eq('plan', plano)
          .maybeSingle()
      : { data: null };

    const limitesNormalizados = limites ? { ...limites, fin_recibo_pdf: true } : null;

    return NextResponse.json({ plano, limites: limitesNormalizados });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ plano: null, error: message }, { status: 200 });
  }
}
