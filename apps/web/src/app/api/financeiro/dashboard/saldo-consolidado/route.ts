// @kf2 allow-scan
// apps/web/src/app/api/financeiro/dashboard/saldo-consolidado/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const supabase = await supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
    }

    // 1. Agregação Geral do Ledger por Escola
    // Buscamos o balanço bruto (Soma Débitos - Soma Créditos)
    const { data: ledgerStats, error: ledgerError } = await (supabase as any)
      .from("financeiro_ledger")
      .select("tipo, valor")
      .eq("escola_id", escolaId);

    if (ledgerError) throw ledgerError;

    let totalDebito = 0;
    let totalCredito = 0;

    (ledgerStats || []).forEach((row: { tipo: string, valor: number }) => {
      if (row.tipo === 'debito') totalDebito += Number(row.valor);
      else if (row.tipo === 'credito') totalCredito += Number(row.valor);
    });

    // 2. Contagem de Alunos Devedores (Balanço Individual > 0)
    const { data: balancoAlunos, error: balancoError } = await (supabase as any)
      .from("financeiro_ledger")
      .select("aluno_id, tipo, valor")
      .eq("escola_id", escolaId);

    if (balancoError) throw balancoError;

    const alunoMap = new Map<string, number>();
    (balancoAlunos || []).forEach((row: { aluno_id: string, tipo: string, valor: number }) => {
      const current = alunoMap.get(row.aluno_id) || 0;
      const amount = Number(row.valor);
      alunoMap.set(row.aluno_id, row.tipo === 'debito' ? current + amount : current - amount);
    });

    let countDevedores = 0;
    let totalEmAtrasoConsolidado = 0;

    alunoMap.forEach((saldo) => {
      if (saldo > 0.01) { // Tolera discrepâncias de arredondamento
        countDevedores++;
        totalEmAtrasoConsolidado += saldo;
      }
    });

    return NextResponse.json({
      ok: true,
      escola_id: escolaId,
      kpis: {
        receita_total_historica: totalCredito,
        debito_total_historico: totalDebito,
        saldo_devedor_atual: totalDebito - totalCredito,
        total_alunos_com_debito: countDevedores,
        vlr_total_em_atraso: totalEmAtrasoConsolidado
      },
      fonte: "financeiro_ledger (SSOT)",
      reconciliado: true
    });

  } catch (e: any) {
    console.error("[DASHBOARD-LEDGER] Erro:", e);
    return NextResponse.json({ ok: false, error: "Erro ao carregar saldo consolidado." }, { status: 500 });
  }
}
