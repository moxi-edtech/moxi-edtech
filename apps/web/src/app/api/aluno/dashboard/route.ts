import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
import type { Database } from "~types/supabase";

type DatabaseWithAvisos = Database & {
  public: Database["public"] & {
    Tables: Database["public"]["Tables"] & {
      avisos: {
        Row: {
          id: string;
          titulo: string | null;
          resumo: string | null;
          origem: string | null;
          created_at: string | null;
          escola_id: string | null;
        };
      };
    };
  };
};

type RotinaRow = { weekday: number | null; inicio: string | null; fim: string | null; sala: string | null };
type NotaRow = { valor: number | null; created_at: string | null };
type MensalidadeRow = { status: string | null };
type StatusFinanceiro = { emDia: boolean; pendentes: number; error?: string };
type AvisoRow = { id: string; titulo: string | null; resumo: string | null; origem: string | null; created_at: string | null };

export async function GET() {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    const { escolaId, matriculaId, turmaId, anoLetivo } = ctx;

    // Próxima aula (heurística: próxima rotina da turma pelo weekday atual)
    let proxima_aula: RotinaRow | null = null;
    try {
      if (turmaId) {
        const now = new Date();
        const weekday = now.getDay(); // 0..6
        let rotinasQuery = supabase
          .from('rotinas')
          .select('weekday, inicio, fim, sala')
          .eq('turma_id', turmaId)
          .gte('weekday', weekday)
          .order('weekday', { ascending: true })
          .limit(1);
        if (escolaId) rotinasQuery = rotinasQuery.eq('escola_id', escolaId);
        const { data: rs } = await rotinasQuery;
        proxima_aula = rs?.[0] ?? null;
      }
    } catch {}

    // Última nota lançada (placeholder: depende de schema de notas)
    let ultima_nota: NotaRow | null = null;
    try {
      if (matriculaId && escolaId) {
        const { data: ns } = await supabase
          .from('notas')
          .select('valor, created_at')
          .eq('escola_id', escolaId)
          .eq('matricula_id', matriculaId)
          .order('created_at', { ascending: false })
          .limit(1);
        ultima_nota = ns?.[0] ?? null;
      }
    } catch {}

    // Status financeiro (baseado em mensalidades do aluno)
    let status_financeiro: StatusFinanceiro = { emDia: true, pendentes: 0 };
    try {
      const { data: matriculaData, error: matriculaError } = escolaId && matriculaId
        ? await supabase
            .from('matriculas')
            .select('aluno_id')
            .eq('id', matriculaId)
            .eq('escola_id', escolaId)
            .single()
        : { data: null, error: null };

      if (matriculaError) throw matriculaError;

      if (matriculaData && escolaId) {
        let mensalidadesQuery = supabase
          .from('mensalidades')
          .select('status')
          .eq('escola_id', escolaId)
          .eq('aluno_id', matriculaData.aluno_id);

        if (matriculaId) mensalidadesQuery = mensalidadesQuery.eq('matricula_id', matriculaId);
        if (typeof anoLetivo === 'number') {
          mensalidadesQuery = mensalidadesQuery.or(`ano_referencia.eq.${anoLetivo},ano_letivo.eq.${anoLetivo}`);
        }

        const { data: mens, error: mensalidadesError } = await mensalidadesQuery;

        if (mensalidadesError) throw mensalidadesError;

        const pend = (mens || []).filter((m: MensalidadeRow) => m.status === 'pendente' || m.status === 'atrasado').length;
        status_financeiro = { emDia: pend === 0, pendentes: pend };
      }
    } catch (e) {
      console.error('Erro ao buscar status financeiro:', e);
      status_financeiro = { emDia: false, pendentes: 0, error: 'Falha ao carregar' };
    }

    // Avisos recentes (até 3)
    let avisos_recentes: Array<{ id: string; titulo: string | null; resumo: string | null; origem: string | null; data: string | null }> = [];
    try {
      if (escolaId) {
        const supabaseAvisos = supabase as unknown as import("@supabase/supabase-js").SupabaseClient<DatabaseWithAvisos>;
        const { data: avs } = await supabaseAvisos
          .from('avisos')
          .select('id, titulo, resumo, origem, created_at')
          .eq('escola_id', escolaId)
          .order('created_at', { ascending: false })
          .limit(3);
        avisos_recentes = (avs || []).map((a: AvisoRow) => ({
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
