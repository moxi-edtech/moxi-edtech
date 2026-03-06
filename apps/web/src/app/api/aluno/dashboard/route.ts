import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
import { applyKf2ListInvariants } from "@/lib/kf2";
import type { Database } from "~types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { escolherProximaAula, normalizeIsoWeekday } from "@/lib/agenda/proximaAula";

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

type ProximaAulaRow = {
  slot_id: string | null;
  weekday: number | null;
  inicio: string | null;
  fim: string | null;
  sala: string | null;
  ordem?: number | null;
};
type QuadroProximaAulaRow = {
  slot_id: string | null;
  sala_id: string | null;
  sala?: { nome: string | null } | null;
  slot?: { dia_semana: number | null; inicio: string | null; fim: string | null; ordem: number | null; is_intervalo: boolean | null } | null;
};
type NotaRow = { valor: number | null; created_at: string | null };
type MensalidadeRow = { status: string | null };
type StatusFinanceiro = { emDia: boolean; pendentes: number; error?: string };
type AvisoRow = { id: string; titulo: string | null; resumo: string | null; origem: string | null; created_at: string | null };

type DatabaseWithHorarioVersoes = Database & {
  public: Database["public"] & {
    Tables: Database["public"]["Tables"] & {
      horario_versoes: {
        Row: {
          id: string;
          escola_id: string;
          turma_id: string;
          status: string | null;
          publicado_em: string | null;
        };
      };
    };
  };
};

export async function GET() {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    const { escolaId, matriculaId, turmaId, anoLetivo } = ctx;

    // Próxima aula (lê apenas versão publicada do quadro oficial)
    let proxima_aula: ProximaAulaRow | null = null;
    try {
      if (turmaId && escolaId) {
        const now = new Date();
        const supabaseHorarios = supabase as SupabaseClient<DatabaseWithHorarioVersoes>;
        const versaoPublicada = (
          await supabaseHorarios
            .from('horario_versoes')
            .select('id')
            .eq('escola_id', escolaId)
            .eq('turma_id', turmaId)
            .eq('status', 'publicada')
            .order('publicado_em', { ascending: false })
            .limit(1)
            .maybeSingle()
        ).data as { id: string } | null;

        const { data: quadroRows } = versaoPublicada?.id
          ? await supabase
              .from('quadro_horarios')
              .select('slot_id, sala_id, sala:salas(nome), slot:horario_slots!inner(dia_semana, inicio, fim, ordem, is_intervalo)')
              .eq('escola_id', escolaId)
              .eq('turma_id', turmaId)
              .eq('versao_id', versaoPublicada.id)
              .order('slot_id', { ascending: true })
          : { data: [] as QuadroProximaAulaRow[] };

        const normalizedSlots: ProximaAulaRow[] = ((quadroRows || []) as QuadroProximaAulaRow[])
          .filter((row) => row.slot && !row.slot.is_intervalo)
          .map((row) => ({
            slot_id: row.slot_id,
            weekday: row.slot?.dia_semana ? normalizeIsoWeekday(row.slot.dia_semana) : null,
            inicio: row.slot?.inicio ?? null,
            fim: row.slot?.fim ?? null,
            sala: row.sala?.nome ?? null,
            ordem: row.slot?.ordem ?? null,
          }));

        const nextSlot = escolherProximaAula(normalizedSlots, now);
        proxima_aula = nextSlot
          ? {
              slot_id: nextSlot.slot_id,
              weekday: nextSlot.weekday,
              inicio: nextSlot.inicio,
              fim: nextSlot.fim,
              sala: nextSlot.sala,
            }
          : null;
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


        mensalidadesQuery = applyKf2ListInvariants(mensalidadesQuery, {
          defaultLimit: 50,
          order: [{ column: 'created_at', ascending: false }],
        });

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
