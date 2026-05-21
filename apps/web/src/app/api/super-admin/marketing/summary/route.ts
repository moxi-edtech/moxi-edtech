import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = await createRouteClient();
    
    // Validar super admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const [leadsCount, affiliatesCount, recentLeads] = await Promise.all([
      supabase.from('marketing_leads').select('id', { count: 'exact', head: true }),
      supabase.from('afiliados').select('id', { count: 'exact', head: true }).eq('ativo', true),
      supabase.from('marketing_leads').select('id, escola, nome, score, created_at').order('created_at', { ascending: false }).limit(5)
    ]);

    return NextResponse.json({
      ok: true,
      summary: {
        total_leads: leadsCount.count ?? 0,
        active_afiliados: affiliatesCount.count ?? 0,
      },
      recent_leads: recentLeads.data || []
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
