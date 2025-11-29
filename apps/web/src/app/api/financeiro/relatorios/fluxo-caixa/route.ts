import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(_req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    // Resolve escola vinculada ao usuário atual
    const { data: prof, error: profErr } = await supabase
      .from('profiles')
      .select('escola_id')
      .order('created_at', { ascending: false })
      .limit(1);

    if (profErr) {
      return NextResponse.json({ ok: false, error: profErr.message }, { status: 500 });
    }
    const escolaId = prof?.[0]?.escola_id as string | null;
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Perfil sem escola vinculada" }, { status: 400 });
    }

    // Prefer view simples (v_financeiro_escola_dia). Se não existir, retorna vazio.
    const { data, error } = await supabase
      .from('v_financeiro_escola_dia')
      .select('dia, qtd_pagos, qtd_total')
      .eq('escola_id', escolaId)
      .order('dia', { ascending: true });

    if (error) {
      return NextResponse.json(
        { ok: false, error: "Erro ao carregar fluxo de caixa diário", details: error.message },
        { status: 500 }
      );
    }

    const series = (data ?? []).map((row) => {
      const total = Number(row.qtd_total ?? 0);
      const pagos = Number(row.qtd_pagos ?? 0);
      const pct = total > 0 ? (pagos / total) * 100 : 0;
      return {
        dia: row.dia,
        qtdTotal: total,
        qtdPagos: pagos,
        pctPago: pct,
      };
    });

    return NextResponse.json({ ok: true, escolaId, series }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Erro inesperado' }, { status: 500 });
  }
}

