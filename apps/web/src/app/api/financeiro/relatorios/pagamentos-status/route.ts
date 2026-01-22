import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { applyKf2ListInvariants } from "@/lib/kf2";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

export async function GET(_req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Perfil sem escola vinculada" }, { status: 400 });
    }

    let query = supabase
      .from('pagamentos_status')
      .select('status, total')
      .eq('escola_id', escolaId);

    query = applyKf2ListInvariants(query, {
      defaultLimit: 50,
      order: [{ column: "status", ascending: true }],
    });

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { ok: false, error: "Erro ao carregar pagamentos por status", details: error.message },
        { status: 500 }
      );
    }

    const items = (data ?? []).map((row) => ({
      status: (row.status ?? 'desconhecido') as string,
      total: Number(row.total ?? 0),
    }));

    // Totais agregados
    const totalGeral = items.reduce((acc, it) => acc + it.total, 0);
    const withPct = items.map((it) => ({ ...it, pct: totalGeral > 0 ? (it.total / totalGeral) * 100 : 0 }));

    return NextResponse.json({ ok: true, escolaId, total: totalGeral, items: withPct }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Erro inesperado' }, { status: 500 });
  }
}
