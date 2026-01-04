import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/escola/disciplinas";
import type { Database } from "~types/supabase";

export async function GET() {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 400 });

    const { count: candidaturasPendentes, error: candErr } = await supabase
      .from("candidaturas")
      .select("id", { count: "exact", head: true })
      .eq("escola_id", escolaId)
      .in("status", ["pendente", "aguardando_compensacao"] as any);

    if (candErr) return NextResponse.json({ ok: false, error: candErr.message }, { status: 400 });

    const { count: cobrancasPendentes, error: cobErr } = await supabase
      .from("financeiro_cobrancas")
      .select("id", { count: "exact", head: true })
      .eq("escola_id", escolaId)
      .in("status", ["enviada", "entregue"] as any);

    if (cobErr) return NextResponse.json({ ok: false, error: cobErr.message }, { status: 400 });

    return NextResponse.json({
      ok: true,
      candidaturasPendentes: candidaturasPendentes ?? 0,
      cobrancasPendentes: cobrancasPendentes ?? 0,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

