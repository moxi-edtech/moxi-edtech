import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { applyKf2ListInvariants } from "@/lib/kf2";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";

function isMissingReadModelError(error: unknown): boolean {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
  const message = typeof error === "object" && error !== null && "message" in error
    ? String((error as { message?: unknown }).message ?? "")
    : "";

  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /does not exist|relation .* does not exist|schema cache|Could not find .* in the schema cache/i.test(message)
  );
}

export async function GET(_req: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const metaEscolaId = (userRes?.user?.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
    const escolaId = await resolveEscolaIdForUser(
      supabase,
      userRes.user.id,
      null,
      metaEscolaId ? String(metaEscolaId) : null
    );
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Perfil sem escola vinculada" }, { status: 400 });
    }

    // Prefer view simples (vw_financeiro_escola_dia). Se não existir, retorna vazio.
    let query = supabase
      .from('vw_financeiro_escola_dia')
      .select('dia, qtd_pagos, qtd_total')
      .eq('escola_id', escolaId);

    query = applyKf2ListInvariants(query, {
      defaultLimit: 50,
      order: [
        { column: 'dia', ascending: true },
      ],
    });

    const { data, error } = await query;

    if (error) {
      if (isMissingReadModelError(error)) {
        return NextResponse.json({ ok: true, escolaId, series: [], warning: "Read model de fluxo de caixa indisponível; retornado vazio." }, { status: 200 });
      }
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
