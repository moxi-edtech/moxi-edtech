// @kf2 allow-scan
import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
import { resolveAuthorizedStudentIds, resolveSelectedStudentId } from "@/lib/portalAlunoAuth";
import type { Database, Json } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MIN_ANO = 2000;
const MAX_SPAN = 10;

type FinanceiroLedgerMovimento = Database["public"]["Tables"]["financeiro_ledger"]["Row"];

function parseYear(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  if (parsed < MIN_ANO || parsed > new Date().getFullYear() + 1) return null;
  return parsed;
}

export async function GET(request: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx || !ctx.escolaId || !ctx.userId) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const url = new URL(request.url);
    const fromAno = parseYear(url.searchParams.get("fromAno"));
    const toAno = parseYear(url.searchParams.get("toAno"));

    if (fromAno == null || toAno == null) {
      return NextResponse.json({ ok: false, error: "Parâmetros obrigatórios: fromAno e toAno." }, { status: 400 });
    }

    const { data: userRes } = await supabase.auth.getUser();
    const authorizedIds = await resolveAuthorizedStudentIds({
      supabase,
      userId: ctx.userId,
      escolaId: ctx.escolaId,
      userEmail: userRes?.user?.email,
    });

    const selectedId = url.searchParams.get("studentId");
    const alunoId = resolveSelectedStudentId({ selectedId, authorizedIds, fallbackId: ctx.alunoId });
    if (!alunoId) return NextResponse.json({ ok: true, mensalidades: [], movimentos: [] });

    // 1. Buscar Mensalidades (Legado, para compatibilidade de UI e botões de pagar)
    const { data: mensalidades, error: mensError } = await supabase
      .from("mensalidades")
      .select("id, ano_referencia, mes_referencia, valor_previsto, valor, data_vencimento, status, data_pagamento_efetiva")
      .eq("aluno_id", alunoId)
      .eq("escola_id", ctx.escolaId)
      .gte("ano_referencia", fromAno)
      .lte("ano_referencia", toAno)
      .order("ano_referencia", { ascending: false })
      .order("mes_referencia", { ascending: false });

    if (mensError) throw mensError;

    // 2. Buscar Movimentos do Ledger (SSOT)
    const { data: movimentos, error: ledgerError } = await supabase
      .from("financeiro_ledger")
      .select("*")
      .eq("aluno_id", alunoId)
      .eq("escola_id", ctx.escolaId)
      .order("data_movimento", { ascending: false });

    if (ledgerError) throw ledgerError;

    // 3. Dados de pagamento da escola
    let dados_pagamento: Json | null = null;
    const { data: escola } = await supabase.from('escolas').select('dados_pagamento').eq('id', ctx.escolaId).maybeSingle();
    if (escola?.dados_pagamento) dados_pagamento = escola.dados_pagamento;

    // 4. Mapear status pendente real baseado no Ledger (opcional, ou manter o flag da tabela legada)
    const hoje = new Date().toISOString().slice(0, 10);
    const rows = (mensalidades || []).map((m) => {
      const competencia = `${m.ano_referencia}-${String(m.mes_referencia).padStart(2, "0")}`;
      const vencimento = m.data_vencimento ?? "";
      let status = m.status;
      if (status === "pendente" && vencimento < hoje) status = "atrasado";
      return { 
        id: m.id, 
        competencia, 
        valor: Number(m.valor_previsto ?? m.valor ?? 0), 
        vencimento, 
        status, 
        pago_em: m.data_pagamento_efetiva 
      };
    });

    // 5. Calcular Saldo Consolidado
    const ledgerMovimentos = (movimentos ?? []) as FinanceiroLedgerMovimento[];
    const totalDebitos = ledgerMovimentos.filter((m) => m.tipo === "debito").reduce((a, b) => a + Number(b.valor), 0) || 0;
    const totalCreditos = ledgerMovimentos.filter((m) => m.tipo === "credito").reduce((a, b) => a + Number(b.valor), 0) || 0;
    const saldoConsolidado = totalDebitos - totalCreditos;

    return NextResponse.json({
      ok: true,
      mensalidades: rows,
      movimentos: ledgerMovimentos,
      resumo: {
        saldo_consolidado: saldoConsolidado,
        total_pago: totalCreditos,
        total_pendente: saldoConsolidado > 0 ? saldoConsolidado : 0,
        em_dia: saldoConsolidado <= 0
      },
      dados_pagamento,
      fonte: "financeiro_ledger (SSOT)"
    });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
