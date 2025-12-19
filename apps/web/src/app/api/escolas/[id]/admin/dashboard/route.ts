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

    // Data de corte para o gráfico (12 meses atrás)
    const now = new Date();
    const fromDate = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().slice(0, 10);

    // 🚀 O SEGREDO: Disparar TODAS as queries ao mesmo tempo (Paralelismo)
    const [
      alunosRes,
      turmasRes,
      profsRes,
      avisosRes,
      pagamentosRes,
      graficoMatriculasRes,
      avaliacoesRes
    ] = await Promise.all([
      
      // 1. Alunos Ativos (Count direto no banco, sem trazer dados)
      supabase
        .from('matriculas')
        .select('*', { count: 'exact', head: true }) // head: true não traz o JSON, só o número!
        .eq('escola_id', escolaId)
        .in('status', ['ativa', 'ativo', 'active']),

      // 2. Turmas (Count direto)
      supabase
        .from('turmas')
        .select('*', { count: 'exact', head: true })
        .eq('escola_id', escolaId),

      // 3. Professores (Count direto)
      supabase
        .from('escola_users')
        .select('*', { count: 'exact', head: true })
        .eq('escola_id', escolaId)
        .eq('papel', 'professor'),

      // 4. Avisos (Top 5)
      supabase
        .from('avisos')
        .select('id, titulo, created_at')
        .eq('escola_id', escolaId)
        .order('created_at', { ascending: false })
        .limit(5),

      // 5. Pagamentos (Trazemos 'status' para calcular kpis no JS, pois são poucos bytes)
      supabase
        .from('pagamentos')
        .select('status')
        .eq('escola_id', escolaId),

      // 6. Gráfico Matrículas (Já filtrado por data no banco)
      supabase
        .from('matriculas')
        .select('data_matricula, created_at')
        .eq('escola_id', escolaId)
        .gte('data_matricula', fromDate),

      // 7. Avaliações/Notas (OTIMIZAÇÃO CRÍTICA)
      // Em vez de buscar IDs de matriculas e fazer um loop, usamos o JOIN do Supabase.
      // Filtramos notas onde a matrícula associada pertence a esta escola.
      supabase
        .from('notas') // Verifique se o nome da tabela é 'notas' ou 'notas_avaliacoes'
        .select('id, matriculas!inner(escola_id)', { count: 'exact', head: true })
        .eq('matriculas.escola_id', escolaId)
    ]);

    // --- Processamento dos Dados (Executado em memória, super rápido) ---

    // KPI: Pagamentos
    const pgList = pagamentosRes.data || [];
    const pagamentos = {
      pago: pgList.filter((p: any) => p.status === 'pago').length,
      pendente: pgList.filter((p: any) => p.status === 'pendente').length,
      inadimplente: pgList.filter((p: any) => p.status === 'atrasado' || p.status === 'inadimplente').length,
      ajuste: pgList.filter((p: any) => p.status === 'ajuste').length,
    };

    // KPI: Gráfico de Matrículas
    const monthsLabels = last12MonthsLabels();
    const counts = new Array(12).fill(0);
    const matsGrafico = graficoMatriculasRes.data || [];
    
    matsGrafico.forEach((m: any) => {
      const d = new Date(m.data_matricula || m.created_at);
      // Cálculo simples de diferença de meses
      const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      const idx = 11 - diff;
      if (idx >= 0 && idx < 12) counts[idx] += 1;
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
        alunos: alunosRes.count ?? 0,
        turmas: turmasRes.count ?? 0,
        professores: profsRes.count ?? 0,
        avaliacoes: avaliacoesRes.count ?? 0, // Agora vem direto do banco!
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