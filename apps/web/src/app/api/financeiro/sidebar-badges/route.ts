import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export async function GET() {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 400 });

    const badgesQuery = supabase
      .from("vw_financeiro_sidebar_badges")
      .select("candidaturas_pendentes, cobrancas_pendentes")
      .eq("escola_id", escolaId)
      .maybeSingle();

    const { data: badges, error: badgesError } = await badgesQuery;

    if (badgesError) return NextResponse.json({ ok: false, error: badgesError.message }, { status: 400 });

    return NextResponse.json({
      ok: true,
      candidaturasPendentes: badges?.candidaturas_pendentes ?? 0,
      cobrancasPendentes: badges?.cobrancas_pendentes ?? 0,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
