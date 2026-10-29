import { NextResponse } from 'next/server'
import { z } from 'zod'
import { gradePeriodState } from '@/lib/academico/grade-period-context'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { authorizeTurmasManage } from '@/lib/escola/disciplinas'
import type { Database } from '~types/supabase'
import {
  AcademicYearContextError,
  assertAcademicYearEntity,
  resolveAcademicYearContext,
} from '@/lib/academic-year/context'

const Body = z.object({
  turma_id: z.string().uuid(),
  disciplina_id: z.string().uuid().optional(),
  turma_disciplina_id: z.string().uuid().optional(),
  ano_letivo_id: z.string().uuid().optional().nullable(),
  trimestre: z.number().int().min(1).max(3),
  tipo_avaliacao: z.string().trim().min(2).max(40).optional(),
  is_isento: z.boolean().optional().default(false),
  notas: z.array(z.object({
    aluno_id: z.string().uuid(),
    // Não aceitar notas em branco: public.notas.valor é NOT NULL.
    valor: z.number().finite().min(0).max(100),
  })).min(1).max(50),
})

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const idempotencyKey = req.headers.get('idempotency-key')
    if (!idempotencyKey) {
      return NextResponse.json({ ok: false, error: 'Idempotency-Key header is required' }, { status: 400 })
    }

    const parsed = Body.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues?.[0]?.message || 'Dados inválidos' }, { status: 400 })
    }
    const body = parsed.data
    if (!body.disciplina_id || !body.turma_disciplina_id) {
      return NextResponse.json({ ok: false, error: 'Disciplina inválida para lançamento.' }, { status: 400 })
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 })

    const authz = await authorizeTurmasManage(supabase, escolaId, user.id)
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 })

    const academicContext = await resolveAcademicYearContext(supabase, {
      userId: user.id,
      requestedAcademicYearId: body.ano_letivo_id,
      operation: 'WRITE',
    })
    await assertAcademicYearEntity(supabase, {
      table: 'turmas',
      entityId: body.turma_id,
      escolaId: academicContext.escolaId,
      anoLetivoId: academicContext.anoLetivoId,
    })

    const { data: turmaDisciplina, error: turmaDisciplinaError } = await supabase
      .from('turma_disciplinas')
      .select('id,periodos_ativos')
      .eq('id', body.turma_disciplina_id)
      .eq('escola_id', escolaId)
      .eq('turma_id', body.turma_id)
      .maybeSingle()
    if (turmaDisciplinaError) throw turmaDisciplinaError
    if (!turmaDisciplina) {
      return NextResponse.json({
        ok: false, code: 'GRADE_DISCIPLINE_MISMATCH',
        error: 'Esta disciplina não pertence à turma selecionada.',
      }, { status: 409 })
    }
    if (Array.isArray(turmaDisciplina.periodos_ativos) &&
        turmaDisciplina.periodos_ativos.length > 0 &&
        !turmaDisciplina.periodos_ativos.includes(body.trimestre)) {
      return NextResponse.json({
        ok: false, code: 'GRADE_DISCIPLINE_INACTIVE_TRIMESTER',
        error: 'A disciplina não está prevista neste trimestre.',
      }, { status: 409 })
    }

    const { data: candidatePeriods, error: periodsError } = await supabase
      .from('periodos_letivos')
      .select('id,numero,data_inicio,data_fim,trava_notas_em,offering_id,source_template_id')
      .eq('escola_id', escolaId)
      .eq('ano_letivo_id', academicContext.anoLetivoId)
      .eq('tipo', 'TRIMESTRE')
      .eq('numero', body.trimestre)
      .limit(2)
    if (periodsError) throw periodsError
    if (!candidatePeriods || candidatePeriods.length !== 1 || candidatePeriods[0].offering_id !== null) {
      return NextResponse.json({
        ok: false, code: 'GRADE_PERIOD_UNRESOLVED',
        error: 'O trimestre desta turma não está configurado de forma inequívoca.',
      }, { status: 409 })
    }
    if (academicContext.anoLetivoLabel.startsWith('2026/') && !candidatePeriods[0].source_template_id) {
      return NextResponse.json({
        ok: false, code: 'OFFICIAL_CALENDAR_NOT_RECONCILED',
        error: 'O calendário oficial de 2026/2027 ainda não está sincronizado nesta escola.',
      }, { status: 409 })
    }
    const periodStatus = gradePeriodState(candidatePeriods[0])
    if (periodStatus === 'future' || periodStatus === 'unconfigured') {
      return NextResponse.json({
        ok: false, code: 'GRADE_PERIOD_NOT_AVAILABLE',
        error: periodStatus === 'future'
          ? 'Este trimestre ainda não começou.'
          : 'As datas do trimestre precisam de ser confirmadas.',
      }, { status: 409 })
    }
    // Past/locked writes are adjudicated by the database trigger and its
    // formally authorized pauta-reopening exception; never bypass it here.

    const alunoIds = Array.from(new Set(body.notas.map((nota) => nota.aluno_id)))
    const { data: activeMatriculas, error: matriculasError } = await supabase
      .from('matriculas')
      .select('aluno_id')
      .eq('escola_id', escolaId)
      .eq('turma_id', body.turma_id)
      .eq('session_id', academicContext.anoLetivoId)
      .eq('ativo', true)
      .in('aluno_id', alunoIds)

    if (matriculasError) {
      return NextResponse.json({ ok: false, error: matriculasError.message }, { status: 400 })
    }

    const activeAlunoIds = new Set((activeMatriculas ?? []).map((row) => String(row.aluno_id)))
    const invalidAlunoId = alunoIds.find((alunoId) => !activeAlunoIds.has(alunoId))
    if (invalidAlunoId) {
      return NextResponse.json({
        ok: false,
        error: 'Um ou mais alunos não possuem matrícula ativa nesta turma e ano letivo.',
        code: 'ACTIVE_ENROLLMENT_REQUIRED',
      }, { status: 409 })
    }

    const { data, error } = await supabase.rpc('lancar_notas_batch', {
      p_escola_id: escolaId,
      p_turma_id: body.turma_id,
      p_disciplina_id: body.disciplina_id,
      p_turma_disciplina_id: body.turma_disciplina_id,
      p_trimestre: body.trimestre,
      p_tipo_avaliacao: body.tipo_avaliacao || 'MAC',
      p_notas: body.notas,
      p_is_isento: body.is_isento,
    })

    if (error) {
      const message = error.message || 'Não foi possível guardar as notas.'
      const status =
        /^AUTH:/i.test(message)
          ? 403
          : /^DATA:/i.test(message)
            ? 400
            : /ACADEMIC_YEAR_READ_ONLY|fechad|trav|reabert|bloquead/i.test(message)
              ? 409
              : 500
      return NextResponse.json({ ok: false, error: message, code: error.code ?? null }, { status })
    }

    return NextResponse.json({ ok: true, data })
  } catch (e) {
    if (e instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: e.message, code: e.code }, { status: e.status })
    }
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
