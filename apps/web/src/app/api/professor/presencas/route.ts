import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { enqueueOutboxEvent, markOutboxEventFailed, markOutboxEventProcessed } from '@/lib/outbox'

const Body = z.object({
  turma_id: z.string().uuid(),
  disciplina_id: z.string().uuid(),
  data: z.string(), // ISO date yyyy-mm-dd
  presencas: z.array(z.object({ aluno_id: z.string().uuid(), status: z.enum(['presente','falta','atraso']) })),
})

export async function POST(req: Request) {
  let supabase: any = null
  let outboxEventId: string | null = null
  try {
    supabase = await supabaseServerTyped<any>()
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

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 })

    const { data: professor } = await supabase
      .from('professores')
      .select('id')
      .eq('profile_id', user.id)
      .eq('escola_id', escolaId)
      .maybeSingle()
    const professorId = (professor as any)?.id as string | undefined
    if (!professorId) return NextResponse.json({ ok: false, error: 'Professor não encontrado' }, { status: 403 })

    const { data: turma } = await supabase
      .from('turmas')
      .select('id, curso_id, classe_id, ano_letivo')
      .eq('id', body.turma_id)
      .eq('escola_id', escolaId)
      .maybeSingle()
    if (!turma) return NextResponse.json({ ok: false, error: 'Turma não encontrada' }, { status: 404 })

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

    const alunoIds = body.presencas.map((p) => p.aluno_id)
    const { data: matriculas } = await supabase
      .from('matriculas')
      .select('id, aluno_id, status')
      .eq('escola_id', escolaId)
      .eq('turma_id', body.turma_id)
      .eq('ano_letivo', turma.ano_letivo)
      .in('aluno_id', alunoIds)

    const matriculaByAluno = new Map<string, string>()
    for (const m of (matriculas || []) as Array<{ id: string; aluno_id: string; status: string | null }>) {
      if (m.status && ['ativo', 'ativa', 'active'].includes(m.status)) {
        matriculaByAluno.set(m.aluno_id, m.id)
      }
    }

    const missing = alunoIds.filter((id) => !matriculaByAluno.has(id))
    if (missing.length > 0) {
      return NextResponse.json({ ok: false, error: 'Matrícula ativa não encontrada para todos os alunos.' }, { status: 400 })
    }

    const dataAula = body.data
    let periodoLetivoId: string | null = null

    if (anoLetivo?.id) {
      const { data: periodo } = await supabase
        .from('periodos_letivos')
        .select('id')
        .eq('escola_id', escolaId)
        .eq('ano_letivo_id', anoLetivo.id)
        .eq('tipo', 'TRIMESTRE')
        .lte('data_inicio', dataAula)
        .gte('data_fim', dataAula)
        .maybeSingle()

      periodoLetivoId = periodo?.id ?? null
    }

    if (!periodoLetivoId) {
      return NextResponse.json({ ok: false, error: 'Período letivo não resolvido para a data informada.' }, { status: 400 })
    }

    outboxEventId = await enqueueOutboxEvent(supabase, {
      escolaId,
      eventType: 'professor_presencas',
      idempotencyKey,
      scope: 'professor',
      payload: {
        turma_id: body.turma_id,
        disciplina_id: body.disciplina_id,
        data: dataAula,
        presencas: body.presencas,
      },
    })
    const frequenciasRows = body.presencas.map((p) => ({
      escola_id: escolaId,
      matricula_id: matriculaByAluno.get(p.aluno_id) as string,
      data: dataAula,
      status: p.status,
      periodo_letivo_id: periodoLetivoId,
    }))

    const { error: frequenciasError } = await supabase
      .from('frequencias')
      .upsert(frequenciasRows as any, { onConflict: 'escola_id,matricula_id,data' })

    if (frequenciasError) {
      await markOutboxEventFailed(supabase, outboxEventId, frequenciasError.message).catch(() => null)
      return NextResponse.json({ ok: false, error: frequenciasError.message }, { status: 400 })
    }

    const presencasRows = body.presencas.map(p => ({
      escola_id: escolaId,
      aluno_id: p.aluno_id,
      turma_id: body.turma_id,
      data: dataAula,
      status: p.status,
      disciplina_id: body.disciplina_id,
    }))

    const { error: presencasError } = await supabase
      .from('presencas')
      .upsert(presencasRows as any, { onConflict: 'aluno_id,turma_id,data' })
    if (presencasError) {
      await markOutboxEventFailed(supabase, outboxEventId, presencasError.message).catch(() => null)
      return NextResponse.json({ ok: false, error: presencasError.message }, { status: 400 })
    }

    await markOutboxEventProcessed(supabase, outboxEventId).catch(() => null)

    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (supabase) {
      await markOutboxEventFailed(supabase, outboxEventId, message).catch(() => null)
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
