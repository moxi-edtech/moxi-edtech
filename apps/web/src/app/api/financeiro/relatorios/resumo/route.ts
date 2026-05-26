import { NextResponse } from "next/server";
import { resolveAnoLetivoScope } from "@/lib/financeiro/resolveAnoLetivoScope";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";
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

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: userRes } = await supabase.auth.getUser();

    if (!userRes?.user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const requestedEscolaId =
      searchParams.get("escolaId") ||
      searchParams.get("escola_id") ||
      null;
    const escolaId = await resolveEscolaIdForUser(
      supabase,
      userRes.user.id,
      requestedEscolaId
    );
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Perfil sem escola vinculada" }, { status: 400 });
    }

    const anoLetivoId =
      searchParams.get("ano_letivo_id") ||
      searchParams.get("session_id") ||
      searchParams.get("sessionId") ||
      null;
    const anoParam = searchParams.get("ano");
    const anoScope = await resolveAnoLetivoScope(supabase, escolaId, {
      anoLetivoId,
      ano: anoParam ? parseInt(anoParam, 10) : null,
    });
    const anoLetivo = anoScope?.ano ?? new Date().getFullYear();

    let propinasRows: Array<{
      qtd_mensalidades: number | null;
      qtd_em_atraso: number | null;
      qtd_pagas_adiantadas: number | null;
      qtd_parciais: number | null;
      total_previsto: number | null;
      total_pago: number | null;
      total_pago_adiantado: number | null;
      total_parcial_em_aberto: number | null;
      total_em_atraso: number | null;
    }> = [];

    const { data: propinas, error: propinasError } = await supabase
      .from("vw_financeiro_propinas_mensal_escola")
      .select(
        "qtd_mensalidades, qtd_em_atraso, qtd_pagas_adiantadas, qtd_parciais, total_previsto, total_pago, total_pago_adiantado, total_parcial_em_aberto, total_em_atraso"
      )
      .eq("escola_id", escolaId)
      .eq("ano_letivo", anoLetivo);

    if (propinasError && !isMissingReadModelError(propinasError)) {
      return NextResponse.json(
        { ok: false, error: "Erro ao carregar resumo de propinas", details: propinasError.message },
        { status: 500 }
      );
    }

    propinasRows = propinas ?? [];

    let despesasTotal = 0;
    let entradasTotal = 0;
    let saldoAnterior = 0;

    if (anoScope?.dataInicio && anoScope?.dataFim) {
      const [despesasRes, entradasRes, saldoAnteriorRes] = await Promise.all([
        supabase
          .from("financeiro_ledger")
          .select("valor")
          .eq("escola_id", escolaId)
          .eq("tipo", "debito")
          .gte("data_movimento", `${anoScope.dataInicio}T00:00:00`)
          .lte("data_movimento", `${anoScope.dataFim}T23:59:59`),
        supabase
          .from("financeiro_ledger")
          .select("valor")
          .eq("escola_id", escolaId)
          .eq("tipo", "credito")
          .gte("data_movimento", `${anoScope.dataInicio}T00:00:00`)
          .lte("data_movimento", `${anoScope.dataFim}T23:59:59`),
        supabase
          .from("financeiro_ledger")
          .select("tipo, valor")
          .eq("escola_id", escolaId)
          .lt("data_movimento", `${anoScope.dataInicio}T00:00:00`),
      ]);

      if (despesasRes.error) {
        return NextResponse.json(
          { ok: false, error: "Erro ao carregar despesas do período", details: despesasRes.error.message },
          { status: 500 }
        );
      }
      if (entradasRes.error) {
        return NextResponse.json(
          { ok: false, error: "Erro ao carregar entradas do período", details: entradasRes.error.message },
          { status: 500 }
        );
      }
      if (saldoAnteriorRes.error) {
        return NextResponse.json(
          { ok: false, error: "Erro ao calcular saldo anterior", details: saldoAnteriorRes.error.message },
          { status: 500 }
        );
      }

      despesasTotal = (despesasRes.data ?? []).reduce((sum, row) => sum + Number(row.valor ?? 0), 0);
      entradasTotal = (entradasRes.data ?? []).reduce((sum, row) => sum + Number(row.valor ?? 0), 0);
      saldoAnterior = (saldoAnteriorRes.data ?? []).reduce((sum, row) => {
        const valor = Number(row.valor ?? 0);
        return sum + (row.tipo === "credito" ? valor : -valor);
      }, 0);
    }

    const resumo = propinasRows.reduce(
      (acc, row) => {
        acc.mensalidades += Number(row.qtd_mensalidades ?? 0);
        acc.emAtraso += Number(row.qtd_em_atraso ?? 0);
        acc.pagasAdiantadas += Number(row.qtd_pagas_adiantadas ?? 0);
        acc.parciais += Number(row.qtd_parciais ?? 0);
        acc.previsto += Number(row.total_previsto ?? 0);
        acc.pago += Number(row.total_pago ?? 0);
        acc.pagoAdiantado += Number(row.total_pago_adiantado ?? 0);
        acc.parcialEmAberto += Number(row.total_parcial_em_aberto ?? 0);
        acc.atraso += Number(row.total_em_atraso ?? 0);
        return acc;
      },
      {
        mensalidades: 0,
        emAtraso: 0,
        pagasAdiantadas: 0,
        parciais: 0,
        previsto: 0,
        pago: 0,
        pagoAdiantado: 0,
        parcialEmAberto: 0,
        atraso: 0,
      }
    );

    return NextResponse.json({
      ok: true,
      anoLetivo,
      anoLetivoId: anoScope?.id ?? null,
      periodo: {
        inicio: anoScope?.dataInicio ?? null,
        fim: anoScope?.dataFim ?? null,
      },
      resumo: {
        ...resumo,
        despesasTotal,
        entradasTotal,
        saldoAnterior,
        saldoPeriodo: entradasTotal - despesasTotal,
        saldoAcumulado: saldoAnterior + entradasTotal - despesasTotal,
        taxaAtrasoPct:
          resumo.mensalidades > 0 ? Number(((resumo.emAtraso / resumo.mensalidades) * 100).toFixed(1)) : 0,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro inesperado ao carregar resumo";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
