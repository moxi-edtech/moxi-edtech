import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

const withGroup = (group: string) =>
  ({ group } as unknown as { head?: boolean; count?: 'exact' | 'planned' | 'estimated' });

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
  try {
    const { id: escolaId } = await context.params;
    const supabase = await supabaseServer();

    const [alunosAtivosRes, turmasCount, professoresCount, avisosRes, pagamentosRes, matsIdsRes] = await Promise.all([
      // Número de alunos com matrícula ativa (distinto por aluno_id)
      supabase
        .from('matriculas')
        .select('aluno_id, count:aluno_id', withGroup('aluno_id'))
        .eq('escola_id', escolaId)
        .in('status', ['ativa', 'ativo', 'active'])
        .not('aluno_id', 'is', null),
      supabase.from('turmas').select('id', { count: 'exact', head: true }).eq('escola_id', escolaId),
      supabase.from('escola_usuarios').select('user_id', { count: 'exact', head: true }).eq('escola_id', escolaId).eq('papel', 'professor'),
      (supabase as any).from('avisos').select('id, titulo, created_at').eq('escola_id', escolaId).order('created_at', { ascending: false }).limit(5),
      supabase.from('pagamentos').select('status').eq('escola_id', escolaId),
      supabase.from('matriculas').select('id').eq('escola_id', escolaId),
    ]);

    // Contagem de notas lançadas (por matrícula da escola)
    let notasLancadas = 0;
    try {
      const mats = (matsIdsRes.data as any[]) || [];
      if (mats.length > 0) {
        const ids = mats.map((m: any) => m.id);
        const { count } = await supabase
          .from('notas')
          .select('id', { head: true, count: 'exact' })
          .in('matricula_id', ids);
        notasLancadas = count ?? 0;
      }
    } catch {}

    const kpis = {
      alunos: (alunosAtivosRes.data?.length ?? 0),
      turmas: turmasCount.count ?? 0,
      professores: professoresCount.count ?? 0,
      avaliacoes: notasLancadas,
    };

    const avisos = ((avisosRes as any).data || []).map((a: any) => ({ id: String(a.id), titulo: a.titulo, dataISO: a.created_at }))

    const pgList = pagamentosRes.data || [];
    const pagamentos = {
      pago: pgList.filter((p: any) => p.status === 'pago').length,
      pendente: pgList.filter((p: any) => p.status === 'pendente').length,
      inadimplente: pgList.filter((p: any) => p.status === 'atrasado' || p.status === 'inadimplente').length,
    };

    // Matrículas por mês (últimos 12 meses)
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().slice(0, 10);
    const { data: mats } = await supabase
      .from('matriculas')
      .select('id, data_matricula, created_at')
      .eq('escola_id', escolaId)
      .gte('data_matricula', from);

    const monthsLabels = last12MonthsLabels();
    const counts = new Array(12).fill(0);
    (mats || []).forEach((m: any) => {
      const d = new Date(m.data_matricula || m.created_at);
      const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      const idx = 11 - diff;
      if (idx >= 0 && idx < 12) counts[idx] += 1;
    });

    return NextResponse.json({
      ok: true,
      kpis,
      avisos,
      eventos: [],
      charts: { meses: monthsLabels, alunosPorMes: counts, pagamentos },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Erro inesperado' }, { status: 500 });
  }
}
