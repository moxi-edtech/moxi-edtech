import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { applyKf2ListInvariants } from "@/lib/kf2";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function last12MonthsLabels(): string[] {
  const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const now = new Date();
  const arr: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push(months[d.getMonth()]);
  }
  return arr;
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await context.params; 

  try {
    const supabase = await supabaseServer();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
    const resolvedEscolaId = await resolveEscolaIdForUser(
      supabase as any,
      user.id,
      escolaId,
      metaEscolaId ? String(metaEscolaId) : null
    );

    if (!resolvedEscolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const now = new Date();

    // 🚀 O SEGREDO: Disparar TODAS as queries ao mesmo tempo (Paralelismo)
    let pagamentosQuery = supabase
      .from('vw_pagamentos_status' as any)
      .select('status, total')
      .eq('escola_id', resolvedEscolaId)
      .order('status', { ascending: true });
    pagamentosQuery = applyKf2ListInvariants(pagamentosQuery, { defaultLimit: 50 });

    let matriculasMesQuery = supabase
      .from('vw_admin_matriculas_por_mes' as any)
      .select('mes, total')
      .eq('escola_id', resolvedEscolaId)
      .order('mes', { ascending: true });
    matriculasMesQuery = applyKf2ListInvariants(matriculasMesQuery, { defaultLimit: 50 });

    const [
      countsRes,
      pagamentosRes,
      matriculasMesRes,
    ] = await Promise.all([
      supabase
        .from('vw_admin_dashboard_counts' as any)
        .select('alunos_ativos, turmas_total, professores_total, avaliacoes_total')
        .eq('escola_id', resolvedEscolaId)
        .maybeSingle(),
      pagamentosQuery,
      matriculasMesQuery,
    ]);

    // --- Processamento dos Dados (Executado em memória, super rápido) ---

    // KPI: Pagamentos
    const pgList = pagamentosRes.data || [];
    const pagamentos = {
      pago: 0,
      pendente: 0,
      inadimplente: 0,
      ajuste: 0,
    };
    pgList.forEach((p: any) => {
      const status = String(p.status || '').toLowerCase();
      const total = Number(p.total || 0);
      if (status === 'pago') pagamentos.pago += total;
      else if (status === 'pendente') pagamentos.pendente += total;
      else if (status === 'ajuste') pagamentos.ajuste += total;
      else if (status === 'atrasado' || status === 'inadimplente') pagamentos.inadimplente += total;
    });

    // KPI: Gráfico de Matrículas
    const monthsLabels = last12MonthsLabels();
    const counts = new Array(12).fill(0);
    const monthKeys: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    (matriculasMesRes.data || []).forEach((row: any) => {
      const d = new Date(row.mes);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const idx = monthKeys.indexOf(key);
      if (idx >= 0) counts[idx] = Number(row.total || 0);
    });

    const avisos: Array<{ id: string; titulo: string; dataISO: string }> = [];

    const countsData = countsRes.data as
      | {
          alunos_ativos?: number | null
          turmas_total?: number | null
          professores_total?: number | null
          avaliacoes_total?: number | null
        }
      | null;

    return NextResponse.json({
      ok: true,
      kpis: {
        alunos: countsData?.alunos_ativos ?? 0,
        turmas: countsData?.turmas_total ?? 0,
        professores: countsData?.professores_total ?? 0,
        avaliacoes: countsData?.avaliacoes_total ?? 0,
      },
      avisos,
      eventos: [], // Se tiveres tabela de eventos, adiciona ao Promise.all
      charts: {
        meses: monthsLabels,
        alunosPorMes: counts,
        pagamentos
      },
    });

  } catch (e: any) {
    console.error("Erro Dashboard:", e);
    return NextResponse.json({ ok: false, error: e?.message || 'Erro interno' }, { status: 500 });
  }
}
