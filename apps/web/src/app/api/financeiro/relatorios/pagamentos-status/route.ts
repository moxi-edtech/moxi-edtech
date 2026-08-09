import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { applyKf2ListInvariants } from "@/lib/kf2";
import { resolveAnoLetivoScope } from "@/lib/financeiro/resolveAnoLetivoScope";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

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

export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const anoScope = await resolveAnoLetivoScope(supabase, escolaId, {
      anoLetivoId: searchParams.get("ano_letivo_id") || searchParams.get("session_id"),
      ano: searchParams.get("ano") ? Number(searchParams.get("ano")) : null,
    });
    if (!anoScope?.id) {
      return NextResponse.json({ ok: false, error: "Ano letivo não encontrado" }, { status: 400 });
    }

    let query = supabase
      .from('vw_pagamentos_status_ano' as any)
      .select('status, total')
      .eq('escola_id', escolaId)
      .eq('ano_letivo_id', anoScope.id);

    query = applyKf2ListInvariants(query, {
      defaultLimit: 50,
      order: [{ column: "status", ascending: true }],
    });

    const { data, error } = await query;

    if (error) {
      if (isMissingReadModelError(error)) {
        return NextResponse.json({ ok: true, escolaId, total: 0, items: [], warning: "Read model de pagamentos por status indisponível; retornado vazio." }, { status: 200 });
      }
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

    return NextResponse.json({ ok: true, escolaId, anoLetivoId: anoScope.id, anoLetivo: anoScope.ano, total: totalGeral, items: withPct }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Erro inesperado' }, { status: 500 });
  }
}
