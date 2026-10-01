import { NextResponse } from "next/server";
import { resolveAnoLetivoScope } from "@/lib/financeiro/resolveAnoLetivoScope";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import type { Database } from "~types/supabase";
import {
  exactMoney,
  moneyToJson,
  percentFromCounts,
  safeCount,
  sumExact,
} from "@/lib/financeiro/exact";
import { addExact, subExact } from "@/lib/fiscal/decimal";

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

    let despesasTotalExact = exactMoney("0", "despesasTotal");
    let entradasTotalExact = exactMoney("0", "entradasTotal");
    let saldoAnteriorExact = exactMoney("0", "saldoAnterior");

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

      despesasTotalExact = sumExact(
        (despesasRes.data ?? []).map((row) => row.valor ?? "0"),
        "despesas.valor"
      );
      entradasTotalExact = sumExact(
        (entradasRes.data ?? []).map((row) => row.valor ?? "0"),
        "entradas.valor"
      );
      saldoAnteriorExact = (saldoAnteriorRes.data ?? []).reduce((sum, row) => {
        const valor = exactMoney(row.valor ?? "0", "saldo_anterior.valor");
        return row.tipo === "credito" ? addExact(sum, valor) : subExact(sum, valor);
      }, exactMoney("0", "saldoAnterior"));
    }

    const resumo = propinasRows.reduce(
      (acc, row) => {
        acc.mensalidades += safeCount(row.qtd_mensalidades ?? 0, "qtd_mensalidades");
        acc.emAtraso += safeCount(row.qtd_em_atraso ?? 0, "qtd_em_atraso");
        acc.pagasAdiantadas += safeCount(
          row.qtd_pagas_adiantadas ?? 0,
          "qtd_pagas_adiantadas"
        );
        acc.parciais += safeCount(row.qtd_parciais ?? 0, "qtd_parciais");
        acc.previsto = addExact(
          acc.previsto,
          exactMoney(row.total_previsto ?? "0", "total_previsto")
        );
        acc.pago = addExact(
          acc.pago,
          exactMoney(row.total_pago ?? "0", "total_pago")
        );
        acc.pagoAdiantado = addExact(
          acc.pagoAdiantado,
          exactMoney(row.total_pago_adiantado ?? "0", "total_pago_adiantado")
        );
        acc.parcialEmAberto = addExact(
          acc.parcialEmAberto,
          exactMoney(row.total_parcial_em_aberto ?? "0", "total_parcial_em_aberto")
        );
        acc.atraso = addExact(
          acc.atraso,
          exactMoney(row.total_em_atraso ?? "0", "total_em_atraso")
        );
        return acc;
      },
      {
        mensalidades: 0,
        emAtraso: 0,
        pagasAdiantadas: 0,
        parciais: 0,
        previsto: exactMoney("0", "previsto"),
        pago: exactMoney("0", "pago"),
        pagoAdiantado: exactMoney("0", "pagoAdiantado"),
        parcialEmAberto: exactMoney("0", "parcialEmAberto"),
        atraso: exactMoney("0", "atraso"),
      }
    );

    const despesasTotal = moneyToJson(despesasTotalExact);
    const entradasTotal = moneyToJson(entradasTotalExact);
    const saldoAnterior = moneyToJson(saldoAnteriorExact);
    const saldoPeriodoExact = subExact(entradasTotalExact, despesasTotalExact);
    const saldoAcumuladoExact = addExact(saldoAnteriorExact, saldoPeriodoExact);
    const resumoJson = {
      mensalidades: resumo.mensalidades,
      emAtraso: resumo.emAtraso,
      pagasAdiantadas: resumo.pagasAdiantadas,
      parciais: resumo.parciais,
      previsto: moneyToJson(resumo.previsto),
      pago: moneyToJson(resumo.pago),
      pagoAdiantado: moneyToJson(resumo.pagoAdiantado),
      parcialEmAberto: moneyToJson(resumo.parcialEmAberto),
      atraso: moneyToJson(resumo.atraso),
    };

    return NextResponse.json({
      ok: true,
      anoLetivo,
      anoLetivoId: anoScope?.id ?? null,
      periodo: {
        inicio: anoScope?.dataInicio ?? null,
        fim: anoScope?.dataFim ?? null,
      },
      resumo: {
        ...resumoJson,
        despesasTotal,
        entradasTotal,
        saldoAnterior,
        saldoPeriodo: moneyToJson(saldoPeriodoExact),
        saldoAcumulado: moneyToJson(saldoAcumuladoExact),
        taxaAtrasoPct: percentFromCounts(resumo.emAtraso, resumo.mensalidades, 1),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro inesperado ao carregar resumo";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
