import { NextResponse } from "next/server";
import { resolveAnoLetivoScope } from "@/lib/financeiro/resolveAnoLetivoScope";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const anoLetivoId =
      searchParams.get("ano_letivo_id") ||
      searchParams.get("session_id") ||
      searchParams.get("sessionId") ||
      null;
    const ano = searchParams.get("ano");
    const escolaIdParam = searchParams.get("escolaId");

    const supabase = await supabaseServerTyped<Database>();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const metaEscolaId = (userRes?.user?.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
    const escolaId = await resolveEscolaIdForUser(
      supabase,
      userRes.user.id,
      escolaIdParam,
      metaEscolaId ? String(metaEscolaId) : null
    );

    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Perfil sem escola vinculada" }, { status: 400 });
    }

    const anoScope = await resolveAnoLetivoScope(supabase, escolaId, {
      anoLetivoId,
      ano: ano ? parseInt(ano, 10) : null,
    });

    // Buscar débitos (saídas) do ledger para o ano solicitado
    // Usamos financeiro_ledger onde tipo = 'debito'
    let query = supabase
      .from("financeiro_ledger")
      .select("valor, data_movimento, descricao, tipo_evento")
      .eq("escola_id", escolaId)
      .eq("tipo", "debito");

    if (anoScope?.dataInicio && anoScope?.dataFim) {
      query = query
        .gte("data_movimento", `${anoScope.dataInicio}T00:00:00`)
        .lte("data_movimento", `${anoScope.dataFim}T23:59:59`);
    } else if (ano) {
      query = query
        .gte("data_movimento", `${ano}-01-01T00:00:00`)
        .lte("data_movimento", `${ano}-12-31T23:59:59`);
    }

    const { data: ledgerData, error: ledgerError } = await query.order("data_movimento", { ascending: false });

    if (ledgerError) throw ledgerError;

    // Agrupar por categoria (tipo_evento ou parse da descrição)
    const categorias: Record<string, { label: string; total: number; qtd: number }> = {};
    let totalGeral = 0;

    (ledgerData || []).forEach((item) => {
      const catKey = item.tipo_evento || "Outras Despesas";
      if (!categorias[catKey]) {
        categorias[catKey] = { label: catKey, total: 0, qtd: 0 };
      }
      categorias[catKey].total += Number(item.valor);
      categorias[catKey].qtd += 1;
      totalGeral += Number(item.valor);
    });

    const items = Object.values(categorias).sort((a, b) => b.total - a.total);

    return NextResponse.json({
      ok: true,
      anoLetivo: anoScope?.ano ?? null,
      anoLetivoId: anoScope?.id ?? null,
      periodo: {
        inicio: anoScope?.dataInicio ?? null,
        fim: anoScope?.dataFim ?? null,
      },
      items,
      totalGeral,
      count: ledgerData?.length ?? 0
    });
  } catch (err: unknown) {
    console.error("Error fetching expenses:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar despesas" }, { status: 500 });
  }
}
