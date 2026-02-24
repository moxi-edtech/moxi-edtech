import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { enqueueOutboxEvent, markOutboxEventFailed, markOutboxEventProcessed } from '@/lib/outbox'
import type { Database } from '~types/supabase'

const Body = z.object({
  turma_id: z.string().uuid(),
  disciplina_id: z.string().uuid(),
  data: z.string(), // ISO date yyyy-mm-dd
  presencas: z.array(z.object({ aluno_id: z.string().uuid(), status: z.enum(['presente','falta','atraso']) })),
})

export async function POST(req: Request) {
  let supabase: Awaited<ReturnType<typeof supabaseServerTyped<Database>>> | null = null
  const outboxEventId: string | null = null
  try {
    supabase = await supabaseServerTyped<Database>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const idempotencyKey = req.headers.get('idempotency-key')
    if (!idempotencyKey) {
      return NextResponse.json({ ok: false, error: 'Idempotency-Key header is required' }, { status: 400 })
    }

    const parsed = Body.safeParse(await req.json().catch(()=>({})))
    if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues?.[0]?.message || 'Dados inválidos' }, { status: 400 })
    const body = parsed.data

    const escolaId = await resolveEscolaIdForUser(supabase, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 })

    const { data: professor } = await supabase
      .from('professores')
      .select('id')
      .eq('profile_id', user.id)
      .eq('escola_id', escolaId)
      .maybeSingle()
    const professorId = (professor as { id?: string } | null)?.id
    if (!professorId) return NextResponse.json({ ok: false, error: 'Professor não encontrado' }, { status: 403 })

    const { data: turma } = await supabase
      .from('turmas')
      .select('id, curso_id, classe_id, ano_letivo')
      .eq('id', body.turma_id)
      .eq('escola_id', escolaId)
      .maybeSingle()
    if (!turma) return NextResponse.json({ ok: false, error: 'Turma não encontrada' }, { status: 404 })
    if (!turma.ano_letivo) {
      return NextResponse.json({ ok: false, error: 'Ano letivo não definido para a turma.' }, { status: 400 })
    }
    if (!turma.curso_id || !turma.classe_id) {
      return NextResponse.json({ ok: false, error: 'Turma sem curso/classe associada.' }, { status: 400 })
    }

    const { data: anoLetivo } = await supabase
      .from('anos_letivos')
      .select('id')
      .eq('escola_id', escolaId)
      .eq('ano', turma.ano_letivo)
      .maybeSingle()

    if (!anoLetivo?.id) {
      return NextResponse.json({ ok: false, error: 'Ano letivo não encontrado para a turma.' }, { status: 400 })
    }

    if (anoLetivo?.id) {
      const { data: periodo } = await supabase
        .from('periodos_letivos')
        .select('id')
        .eq('escola_id', escolaId)
        .eq('ano_letivo_id', anoLetivo.id)
        .eq('tipo', 'TRIMESTRE')
        .lte('data_inicio', body.data)
        .gte('data_fim', body.data)
        .maybeSingle()

      if (periodo?.id) {
        const { data: closed } = await supabase
          .from('frequencia_status_periodo')
          .select('id')
          .eq('escola_id', escolaId)
          .eq('turma_id', body.turma_id)
          .eq('periodo_letivo_id', periodo.id)
          .limit(1)
          .maybeSingle()

        if (closed) {
          return NextResponse.json({ ok: false, error: 'Período fechado para frequência.' }, { status: 409 })
        }
      }
    }

    const { data: matriz } = await supabase
      .from('curso_matriz')
      .select('id')
      .eq('escola_id', escolaId)
      .eq('curso_id', turma.curso_id)
      .eq('classe_id', turma.classe_id)
      .eq('disciplina_id', body.disciplina_id)
      .eq('ativo', true)
      .maybeSingle()

    if (!matriz) {
      return NextResponse.json({ ok: false, error: 'Disciplina não vinculada à matriz da turma' }, { status: 400 })
    }

    const { data: turmaDisciplina } = await supabase
      .from('turma_disciplinas')
      .select('id, professor_id')
      .eq('escola_id', escolaId)
      .eq('turma_id', body.turma_id)
      .eq('curso_matriz_id', matriz.id)
      .maybeSingle()

    if (!turmaDisciplina) {
      return NextResponse.json({ ok: false, error: 'Disciplina não atribuída à turma' }, { status: 404 })
    }

    let isProfessorAssigned = turmaDisciplina.professor_id === professorId
    if (!isProfessorAssigned) {
      const { data: assignment } = await supabase
        .from('turma_disciplinas_professores')
        .select('id')
        .eq('escola_id', escolaId)
        .eq('turma_id', body.turma_id)
        .eq('disciplina_id', body.disciplina_id)
        .eq('professor_id', professorId)
        .maybeSingle()
      isProfessorAssigned = Boolean(assignment)
    }

    if (!isProfessorAssigned) {
      return NextResponse.json({ ok: false, error: 'Professor não atribuído à disciplina' }, { status: 403 })
    }

    // A maior parte da lógica de validação foi movida para a RPC `upsert_frequencias_batch`.
    // A RPC irá resolver a aula, o período, as matrículas e fará o upsert de forma atômica e auditada.
    const { data, error } = await supabase.rpc('upsert_frequencias_batch', {
      p_escola_id: escolaId,
      p_turma_id: body.turma_id,
      p_disciplina_id: body.disciplina_id,
      p_data: body.data,
      p_presencas: body.presencas,
    });

    if (error) {
      console.error('Error calling upsert_frequencias_batch RPC:', error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (supabase) {
      await markOutboxEventFailed(supabase, outboxEventId, message).catch(() => null)
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
