import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

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

export async function GET(req: NextRequest, context: { params: Promise<{ escolaId: string }> }) {
  // Nota: Verifique se sua pasta se chama [escolaId] ou [id]. 
  // No código anterior usaste 'id', mas a convenção do next é o nome do ficheiro. 
  // Vou assumir que o param é 'escolaId' conforme a estrutura padrão.
  const { escolaId } = await context.params; 

  try {
    const supabase = await supabaseServer();

    const now = new Date();

    // 🚀 O SEGREDO: Disparar TODAS as queries ao mesmo tempo (Paralelismo)
    const [
      countsRes,
      avisosRes,
      pagamentosRes,
      matriculasMesRes,
    ] = await Promise.all([
      supabase
        .from('vw_admin_dashboard_counts')
        .select('alunos_ativos, turmas_total, professores_total, avaliacoes_total')
        .eq('escola_id', escolaId)
        .maybeSingle(),
      supabase
        .from('avisos')
        .select('id, titulo, created_at')
        .eq('escola_id', escolaId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('pagamentos_status')
        .select('status, total')
        .eq('escola_id', escolaId),
      supabase
        .from('vw_admin_matriculas_por_mes')
        .select('mes, total')
        .eq('escola_id', escolaId),
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

    // Mapeamento de Avisos
    const avisos = (avisosRes.data || []).map((a: any) => ({
      id: String(a.id),
      titulo: a.titulo,
      dataISO: a.created_at
    }));

    return NextResponse.json({
      ok: true,
      kpis: {
        alunos: countsRes.data?.alunos_ativos ?? 0,
        turmas: countsRes.data?.turmas_total ?? 0,
        professores: countsRes.data?.professores_total ?? 0,
        avaliacoes: countsRes.data?.avaliacoes_total ?? 0,
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
