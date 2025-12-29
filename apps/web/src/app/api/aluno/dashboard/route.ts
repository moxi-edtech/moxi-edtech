import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";

export async function GET() {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    const { userId, escolaId, matriculaId, turmaId } = ctx;

    // Próxima aula (heurística: próxima rotina da turma pelo weekday atual)
    let proxima_aula: any = null;
    try {
      if (turmaId) {
        const now = new Date();
        const weekday = now.getDay(); // 0..6
        const { data: rs } = await supabase
          .from('rotinas')
          .select('weekday, inicio, fim, sala')
          .eq('turma_id', turmaId)
          .gte('weekday', weekday)
          .order('weekday', { ascending: true })
          .limit(1);
        proxima_aula = rs?.[0] ?? null;
      }
    } catch {}

    // Última nota lançada (placeholder: depende de schema de notas)
    let ultima_nota: any = null;
    try {
      if (matriculaId) {
        const { data: ns } = await supabase
          .from('notas')
          .select('valor, created_at')
          .eq('matricula_id', matriculaId)
          .order('created_at', { ascending: false })
          .limit(1);
        ultima_nota = ns?.[0] ?? null;
      }
    } catch {}

    // Status financeiro (baseado em mensalidades do aluno)
    let status_financeiro: any = { emDia: true, pendentes: 0 };
    try {
      const { data: matriculaData, error: matriculaError } = await supabase
        .from('matriculas')
        .select('aluno_id')
        .eq('id', matriculaId)
        .single();

      if (matriculaError) throw matriculaError;

      if (matriculaData) {
        const { data: mens, error: mensalidadesError } = await supabase
          .from('mensalidades')
          .select('status')
          .eq('aluno_id', matriculaData.aluno_id);

        if (mensalidadesError) throw mensalidadesError;

        const pend = (mens || []).filter((m: any) => m.status === 'pendente' || m.status === 'atrasado').length;
        status_financeiro = { emDia: pend === 0, pendentes: pend };
      }
    } catch (e) {
      console.error('Erro ao buscar status financeiro:', e);
      status_financeiro = { emDia: false, pendentes: 0, error: 'Falha ao carregar' };
    }

    // Avisos recentes (até 3)
    let avisos_recentes: any[] = [];
    try {
      if (escolaId) {
        const { data: avs } = await supabase
          .from('avisos')
          .select('id, titulo, resumo, origem, created_at')
          .eq('escola_id', escolaId)
          .order('created_at', { ascending: false })
          .limit(3);
        avisos_recentes = (avs || []).map((a: any) => ({
          id: a.id,
          titulo: a.titulo,
          resumo: a.resumo,
          origem: a.origem,
          data: a.created_at,
        }));
      }
    } catch {}

    return NextResponse.json({ ok: true, proxima_aula, ultima_nota, status_financeiro, avisos_recentes });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

