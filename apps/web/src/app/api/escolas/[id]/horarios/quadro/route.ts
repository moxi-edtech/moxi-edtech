import { NextResponse } from 'next/server'
import { resourceConflicts, slotsOverlap, type LessonSlot } from '@/lib/horarios/temporal-conflicts'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { applyKf2ListInvariants } from '@/lib/kf2'
import { authorizePedagogicalManage } from '@/lib/escola/disciplinas'
import { emitirEvento } from '@/lib/eventos/emitirEvento'
import { recordAuditServer } from '@/lib/audit'
import { AcademicYearContextError, assertAcademicYearEntity, resolveAcademicYearContext } from '@/lib/academic-year/context'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const BodySchema = z.object({
  ano_letivo_id: z.string().uuid(),
  versao_id: z.string().uuid().optional(),
  turma_id: z.string().uuid(),
  items: z.array(
    z.object({
      slot_id: z.string().uuid(),
      disciplina_id: z.string().uuid(),
      professor_id: z.string().uuid().nullable().optional(),
      sala_id: z.string().uuid().nullable().optional(),
    })
  ).max(500),
  mode: z.enum(['draft', 'publish']).optional(),
})

type PublishWarning = {
  code: 'CARGA_HORARIA_MISSING' | 'CARGA_HORARIA_MISMATCH'
  message: string
  details: Array<{ disciplina_id: string; disciplina_nome?: string | null }>
}

async function resolveVersionForRead(
  supabase: any,
  escolaId: string,
  turmaId: string,
  requestedVersionId: string | null
): Promise<string | null> {
  if (requestedVersionId) return requestedVersionId

  const { data: publishedVersion } = await supabase
    .from('horario_versoes')
    .select('id')
    .eq('escola_id', escolaId)
    .eq('turma_id', turmaId)
    .eq('status', 'publicada')
    .order('publicado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  return publishedVersion?.id ?? null
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const start = Date.now()
    const supabase = await supabaseServerTyped<any>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const { id: escolaId } = await ctx.params
    const escolaIdResolved = await resolveEscolaIdForUser(supabase as any, user.id, escolaId, escolaId)
    if (!escolaIdResolved) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 403 })

    const authz = await authorizePedagogicalManage(supabase as any, escolaIdResolved, user.id)
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const versaoId = searchParams.get('versao_id')
    const turmaId = searchParams.get('turma_id')
    if (!turmaId) {
      return NextResponse.json({ ok: false, error: 'turma_id é obrigatório' }, { status: 400 })
    }
    const academicContext = await resolveAcademicYearContext(supabase, {
      userId: user.id,
      requestedAcademicYearId: searchParams.get('ano_letivo_id'),
      operation: 'READ',
    })
    await assertAcademicYearEntity(supabase, {
      table: 'turmas', entityId: turmaId, escolaId: escolaIdResolved,
      anoLetivoId: academicContext.anoLetivoId,
    })

    const effectiveVersionId = await resolveVersionForRead(supabase, escolaIdResolved, turmaId, versaoId)
    if (!effectiveVersionId) {
      return NextResponse.json({ ok: true, context: academicContext, items: [], versao_id: null })
    }

    let quadroQuery = supabase
      .from('quadro_horarios')
      .select('id, turma_id, disciplina_id, professor_id, sala_id, slot_id, versao_id', { count: 'exact' })
      .eq('escola_id', escolaIdResolved)
      .eq('versao_id', effectiveVersionId)
      .eq('turma_id', turmaId)

    quadroQuery = applyKf2ListInvariants(quadroQuery, {
      defaultLimit: 500,
      maxLimit: 500,
      order: [{ column: 'slot_id', ascending: true }],
    })

    const { data, error, count } = await quadroQuery

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    if (count === null || count !== (data || []).length) return NextResponse.json({ ok: false, error: 'Horário incompleto. Não é seguro editar esta versão.' }, { status: 409 })
    const response = NextResponse.json({ ok: true, context: academicContext, versao_id: effectiveVersionId, items: data || [] })
    response.headers.set('Server-Timing', `app;dur=${Date.now() - start}`)
    return response
  } catch (e) {
    if (e instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: e.code, message: e.message }, { status: e.status })
    }
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const start = Date.now()
    const supabase = await supabaseServerTyped<any>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const { id: escolaId } = await ctx.params
    const escolaIdResolved = await resolveEscolaIdForUser(supabase as any, user.id, escolaId, escolaId)
    if (!escolaIdResolved) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 403 })

    const authz = await authorizePedagogicalManage(supabase as any, escolaIdResolved, user.id)
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 })

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues?.[0]?.message || 'Dados inválidos' }, { status: 400 })
    }

    const academicContext = await resolveAcademicYearContext(supabase, {
      userId: user.id,
      requestedAcademicYearId: parsed.data.ano_letivo_id,
      operation: 'WRITE',
    })
    await assertAcademicYearEntity(supabase, {
      table: 'turmas', entityId: parsed.data.turma_id, escolaId: escolaIdResolved,
      anoLetivoId: academicContext.anoLetivoId,
    })

    const { data: turma, error: turmaError } = await supabase.from('turmas')
      .select('turno').eq('escola_id', escolaIdResolved).eq('id', parsed.data.turma_id).maybeSingle()
    if (turmaError || !turma) return NextResponse.json({ ok: false, error: 'Não foi possível validar o turno da turma.' }, { status: 409 })
    const turn = String(turma.turno ?? '').toUpperCase()
    const expectedShift = turn === 'M' ? 'matinal' : turn === 'T' ? 'tarde' : turn === 'N' ? 'noite' : null
    const requestedSlots = Array.from(new Set(parsed.data.items.map((item) => item.slot_id)))
    if (!expectedShift) return NextResponse.json({ ok: false, error: 'Defina o turno da turma.' }, { status: 409 })
    let requestedSlotTimes: LessonSlot[] = []
    if (requestedSlots.length) {
      const { data: validSlots, error: validSlotsError } = await supabase.from('horario_slots')
        .select('id, dia_semana, inicio, fim').eq('escola_id', escolaIdResolved).eq('turno_id', expectedShift)
        .or('is_intervalo.is.null,is_intervalo.eq.false').in('id', requestedSlots)
      if (validSlotsError) return NextResponse.json({ ok: false, error: 'Não foi possível validar os tempos.' }, { status: 503 })
      requestedSlotTimes = (validSlots || []) as LessonSlot[]
      if (requestedSlotTimes.length !== requestedSlots.length) return NextResponse.json({ ok: false, error: 'O quadro contém intervalos ou tempos de outro turno.' }, { status: 409 })
    }
    const { data: previousPublishedVersion, error: previousPublishedError } = await supabase
      .from('horario_versoes')
      .select('id')
      .eq('escola_id', escolaIdResolved)
      .eq('turma_id', parsed.data.turma_id)
      .eq('status', 'publicada')
      .order('publicado_em', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    if (previousPublishedError) return NextResponse.json({ ok: false, error: 'Não foi possível consultar a versão publicada.' }, { status: 503 })
    const mode = parsed.data.mode ?? 'draft'
    if (mode === 'publish' && parsed.data.items.length === 0) {
      return NextResponse.json({ ok: false, error: 'Adicione pelo menos uma aula antes de publicar.' }, { status: 400 })
    }
    const emitObs = (status: 'success' | 'error', httpStatus: number, details: Record<string, unknown> = {}) =>
      emitirEvento(supabase as any, {
        escola_id: escolaIdResolved,
        tipo: 'academico.horario_quadro_post',
        payload: {
          status,
          http_status: httpStatus,
          duration_ms: Date.now() - start,
          mode,
          turma_id: parsed.data.turma_id,
          items_count: parsed.data.items.length,
          ...details,
        },
        actor_id: user.id,
        actor_role: 'admin',
        entidade_tipo: 'quadro_horario',
        entidade_id: parsed.data.turma_id,
      }).catch(() => null)

    // A published version is a snapshot, never the editor's write target.
    // Resolve the source under the exact tenant/turma before creating a draft.
    const sourceVersionId = parsed.data.versao_id ?? previousPublishedVersion?.id ?? null
    let sourceStatus: string | null = null
    if (sourceVersionId) {
      const { data: sourceVersion, error: sourceError } = await supabase
        .from('horario_versoes')
        .select('id, status')
        .eq('escola_id', escolaIdResolved)
        .eq('turma_id', parsed.data.turma_id)
        .eq('id', sourceVersionId)
        .maybeSingle()
      if (sourceError || !sourceVersion || !['draft', 'publicada'].includes(sourceVersion.status)) {
        return NextResponse.json({ ok: false, error: 'Versão desactualizada. Recarregue o horário.' }, { status: 409 })
      }
      sourceStatus = sourceVersion.status
    }
    // Keep the old publication available while editing or validating its replacement.
    const { data: versionIdFromDb, error: ensureVersionError } = await supabase.rpc('ensure_horario_versao', {
      p_escola_id: escolaIdResolved,
      p_turma_id: parsed.data.turma_id,
      p_versao_id: sourceStatus === 'draft' ? sourceVersionId : null,
      p_status: 'draft',
    })

    if (ensureVersionError || !versionIdFromDb) {
      emitObs('error', 400, { error_code: 'ENSURE_VERSION_FAILED' })
      return NextResponse.json({ ok: false, error: ensureVersionError?.message || 'Falha ao garantir versão' }, { status: 400 })
    }

    let versaoId = String(versionIdFromDb)

    const { data: previousRows, error: previousRowsError } = await supabase
      .from('quadro_horarios')
      .select('slot_id, disciplina_id, professor_id, sala_id, versao_id')
      .eq('escola_id', escolaIdResolved)
      .eq('turma_id', parsed.data.turma_id)
      .eq('versao_id', sourceVersionId ?? versaoId)
      .limit(500)

    if (previousRowsError) return NextResponse.json({ ok: false, error: 'Não foi possível preservar o horário anterior.' }, { status: 503 })
    const previousBySlot = new Map((previousRows || []).map((row: { slot_id: string; sala_id?: string | null }) => [row.slot_id, row]))
    const payload = parsed.data.items.map((item) => ({
      escola_id: escolaIdResolved,
      turma_id: parsed.data.turma_id,
      disciplina_id: item.disciplina_id,
      professor_id: item.professor_id ?? null,
      // Clientes que não editam salas (ex.: modal da lista de turmas) não devem
      // apagar uma sala já persistida; null explícito continua a removê-la.
      sala_id: item.sala_id === undefined ? (previousBySlot.get(item.slot_id)?.sala_id ?? null) : item.sala_id,
      slot_id: item.slot_id,
      versao_id: versaoId,
    }))

    const professorIds = Array.from(new Set(payload.map((item) => item.professor_id).filter(Boolean)))
    const salaIds = Array.from(new Set(payload.map((item) => item.sala_id).filter(Boolean)))
    const publishWarnings: PublishWarning[] = []

    const conflicts: Array<{ slot_id: string; professor_id?: string | null; sala_id?: string | null; kind?: 'turma' | 'professor' | 'sala' }>
      = []

    const seenSlots = new Set<string>()
    const seenProfessors = new Set<string>()
    const seenSalas = new Set<string>()
    for (const item of payload) {
      if (seenSlots.has(item.slot_id)) conflicts.push({ slot_id: item.slot_id, kind: 'turma' })
      seenSlots.add(item.slot_id)
      if (item.professor_id) {
        const professorSlotKey = `${item.professor_id}:${item.slot_id}`
        if (seenProfessors.has(professorSlotKey)) conflicts.push({ slot_id: item.slot_id, professor_id: item.professor_id, kind: 'professor' })
        seenProfessors.add(professorSlotKey)
      }
      if (item.sala_id) {
        const salaSlotKey = `${item.sala_id}:${item.slot_id}`
        if (seenSalas.has(salaSlotKey)) conflicts.push({ slot_id: item.slot_id, sala_id: item.sala_id, kind: 'sala' })
        seenSalas.add(salaSlotKey)
      }
    }

    if (mode === 'publish' && (professorIds.length > 0 || salaIds.length > 0)) {
      const { data: allSlots, count: allSlotCount, error: slotsError } = await supabase.from('horario_slots')
        .select('id, dia_semana, inicio, fim', { count: 'exact' }).eq('escola_id', escolaIdResolved)
        .order('id').limit(500)
      if (slotsError || allSlotCount !== (allSlots || []).length) {
        return NextResponse.json({ ok: false, error: 'Não foi possível validar todos os tempos da escola.' }, { status: 503 })
      }
      const temporalSlots = (allSlots || []) as LessonSlot[]
      const overlapping = temporalSlots.filter((slot) => requestedSlotTimes.some((requested) => slotsOverlap(requested, slot)))
      const overlappingIds = overlapping.map((slot) => slot.id)
      const slotMap = new Map(temporalSlots.map((slot) => [slot.id, slot]))
      const { data: otherTurmas, count: otherCount, error: otherError } = await supabase
        .from('turmas').select('id', { count: 'exact' })
        .eq('escola_id', escolaIdResolved).eq('ano_letivo_id', academicContext.anoLetivoId)
        .neq('id', parsed.data.turma_id).order('id').limit(1000)
      if (otherError || otherCount !== (otherTurmas || []).length) {
        return NextResponse.json({ ok: false, error: 'Não foi possível validar todos os horários concorrentes.' }, { status: 503 })
      }
      // Bounded batches avoid oversized URL filters and detect incomplete results.
      const otherIds = (otherTurmas || []).map((row: { id: string }) => row.id)
      for (let start = 0; start < otherIds.length; start += 50) {
        const { data: versions, count: versionCount, error: versionError } = await supabase.from('horario_versoes')
          .select('id', { count: 'exact' }).eq('escola_id', escolaIdResolved)
          .eq('status', 'publicada').in('turma_id', otherIds.slice(start, start + 50))
        if (versionError || versionCount !== (versions || []).length) {
          return NextResponse.json({ ok: false, error: 'Não foi possível validar as versões publicadas.' }, { status: 503 })
        }
        const ids = (versions || []).map((row: { id: string }) => row.id)
        if (!ids.length || !overlappingIds.length) continue
        for (let index = 0; index < overlappingIds.length; index += 50) {
          const { data: existing, count: existingCount, error: existingError } = await supabase.from('quadro_horarios')
            .select('slot_id, professor_id, sala_id', { count: 'exact' }).eq('escola_id', escolaIdResolved)
            .in('versao_id', ids).in('slot_id', overlappingIds.slice(index, index + 50)).limit(1000)
          if (existingError || existingCount !== (existing || []).length) {
            return NextResponse.json({ ok: false, error: 'Não foi possível validar todos os conflitos.' }, { status: 503 })
          }
          conflicts.push(...resourceConflicts(payload, existing || [], slotMap))
        }
      }
    }

    if (conflicts.length > 0) {
      emitObs('error', 409, { error_code: 'HORARIO_CONFLICT', conflicts_count: conflicts.length })
      return NextResponse.json(
        { ok: false, error: 'Conflito de horário detectado', conflicts },
        { status: 409 }
      )
    }

    if (mode === 'publish') {
      const { data: cargas, error: cargasError } = await supabase
        .from('turma_disciplinas')
        .select(
          'carga_horaria_semanal, entra_no_horario, curso_matriz:curso_matriz_id(carga_horaria_semanal, entra_no_horario, disciplina_id, disciplina:disciplinas_catalogo!curso_matriz_disciplina_id_fkey(nome))'
        )
        .eq('escola_id', escolaIdResolved)
        .eq('turma_id', parsed.data.turma_id)

      if (cargasError) {
        emitObs('error', 400, { error_code: 'LOAD_TURMA_DISCIPLINAS_FAILED' })
        return NextResponse.json({ ok: false, error: cargasError.message }, { status: 400 })
      }

      const disciplinaCounts: Record<string, number> = {}
      for (const item of parsed.data.items) {
        disciplinaCounts[item.disciplina_id] = (disciplinaCounts[item.disciplina_id] || 0) + 1
      }

      const missing: Array<{ disciplina_id: string; disciplina_nome?: string | null }> = []
      const mismatch: Array<{ disciplina_id: string; disciplina_nome?: string | null }> = []

      for (const row of cargas || []) {
        const cursoMatriz = Array.isArray(row.curso_matriz)
          ? row.curso_matriz[0]
          : row.curso_matriz
        const disciplinaId = cursoMatriz?.disciplina_id ?? null
        if (!disciplinaId) continue
        const entra = row.entra_no_horario ?? cursoMatriz?.entra_no_horario ?? true
        if (!entra) continue
        const expected = row.carga_horaria_semanal ?? cursoMatriz?.carga_horaria_semanal ?? 0
        const disciplinaNome = (Array.isArray(cursoMatriz?.disciplina) ? cursoMatriz?.disciplina[0] : cursoMatriz?.disciplina)?.nome ?? null

        if (expected <= 0) {
          missing.push({ disciplina_id: disciplinaId, disciplina_nome: disciplinaNome })
          continue
        }

        const assigned = disciplinaCounts[disciplinaId] || 0
        if (assigned !== expected) {
          mismatch.push({ disciplina_id: disciplinaId, disciplina_nome: disciplinaNome })
        }
      }

      if (missing.length > 0 || mismatch.length > 0) {
        if (missing.length > 0) {
          publishWarnings.push({
            code: 'CARGA_HORARIA_MISSING',
            message: 'Existem disciplinas sem carga horária semanal definida.',
            details: missing,
          })
        }
        if (mismatch.length > 0) {
          publishWarnings.push({
            code: 'CARGA_HORARIA_MISMATCH',
            message: 'A distribuição publicada não cobre exatamente a carga horária esperada.',
            details: mismatch,
          })
        }
      }
    }

    const { data: upsertResult, error: upsertError } = await supabase.rpc('upsert_quadro_horarios_versao_atomic', {
      p_escola_id: escolaIdResolved,
      p_turma_id: parsed.data.turma_id,
      p_versao_id: versaoId,
      p_items: payload,
      p_publish: mode === 'publish',
    })

    if (upsertError) {
      const conflict = /conflito|HORARIO_CONFLICT|HORARIO_STALE/i.test(upsertError.message || '')
      if (conflict) return NextResponse.json({ ok: false, error: upsertError.message }, { status: 409 })
      emitObs('error', 400, { error_code: 'UPSERT_QUADRO_FAILED' })
      return NextResponse.json({ ok: false, error: upsertError.message }, { status: 400 })
    }

    versaoId = String((upsertResult as { versao_id?: string } | null)?.versao_id ?? versaoId)
    const { data, error: selectError } = await supabase
      .from('quadro_horarios')
      .select('id, turma_id, disciplina_id, professor_id, sala_id, slot_id, versao_id')
      .eq('escola_id', escolaIdResolved)
      .eq('turma_id', parsed.data.turma_id)
      .eq('versao_id', versaoId)

    if (selectError) {
      emitObs('error', 400, { error_code: 'SELECT_QUADRO_FAILED' })
      return NextResponse.json({ ok: false, error: selectError.message }, { status: 400 })
    }

    await recordAuditServer({
      escolaId: escolaIdResolved,
      portal: 'admin_escola',
      acao: mode === 'publish' ? 'publicar_quadro_horarios' : 'salvar_quadro_horarios',
      entity: 'quadro_horarios',
      entityId: parsed.data.turma_id,
      details: {
        mode,
        versao_id: versaoId,
        previous_version_id: previousPublishedVersion?.id ?? previousRows?.[0]?.versao_id ?? null,
        before: previousRows ?? [],
        after: data ?? [],
        reason: mode === 'publish' ? 'Publicação do quadro validado.' : 'Atualização manual do quadro.',
      },
    })

    if (mode === 'publish') {
      const publishedVersionId = (upsertResult as { published_id?: string | null } | null)?.published_id ?? null
      emitObs('success', 200, {
        published: true,
        versao_id: String(publishedVersionId || versaoId),
        warnings_count: publishWarnings.length,
        warning_codes: publishWarnings.map((warning) => warning.code),
      })
      const response = NextResponse.json({
        ok: true,
        versao_id: String(publishedVersionId || versaoId),
        status: 'publicada',
        items: data || [],
        warnings: publishWarnings,
      })
      response.headers.set('Server-Timing', `app;dur=${Date.now() - start}`)
      return response
    }

    emitObs('success', 200, { published: false, versao_id: versaoId })
    const response = NextResponse.json({ ok: true, context: academicContext, versao_id: versaoId, status: 'draft', items: data || [] })
    response.headers.set('Server-Timing', `app;dur=${Date.now() - start}`)
    return response
  } catch (e) {
    if (e instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: e.code, message: e.message }, { status: e.status })
    }
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseServerTyped<any>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const { id: escolaId } = await ctx.params
    const escolaIdResolved = await resolveEscolaIdForUser(supabase as any, user.id, escolaId, escolaId)
    if (!escolaIdResolved) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 403 })

    const authz = await authorizePedagogicalManage(supabase as any, escolaIdResolved, user.id)
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const versaoId = searchParams.get('versao_id')
    const turmaId = searchParams.get('turma_id')
    if (!versaoId || !turmaId) {
      return NextResponse.json({ ok: false, error: 'versao_id e turma_id são obrigatórios' }, { status: 400 })
    }
    const academicContext = await resolveAcademicYearContext(supabase, {
      userId: user.id,
      requestedAcademicYearId: searchParams.get('ano_letivo_id'),
      operation: 'WRITE',
    })
    await assertAcademicYearEntity(supabase, {
      table: 'turmas', entityId: turmaId, escolaId: escolaIdResolved,
      anoLetivoId: academicContext.anoLetivoId,
    })

    const { data: versaoData } = await supabase
      .from('horario_versoes')
      .select('status')
      .eq('id', versaoId)
      .eq('escola_id', escolaIdResolved)
      .eq('turma_id', turmaId)
      .maybeSingle()

    if ((versaoData as { status?: string } | null)?.status === 'publicada') {
      return NextResponse.json({ ok: false, error: 'Não é permitido remover versão publicada' }, { status: 409 })
    }

    const { error } = await supabase
      .from('quadro_horarios')
      .delete()
      .eq('escola_id', escolaIdResolved)
      .eq('versao_id', versaoId)
      .eq('turma_id', turmaId)

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    await supabase
      .from('horario_versoes')
      .delete()
      .eq('id', versaoId)
      .eq('escola_id', escolaIdResolved)
      .eq('turma_id', turmaId)
      .neq('status', 'publicada')

    return NextResponse.json({ ok: true, context: academicContext })
  } catch (e) {
    if (e instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: e.code, message: e.message }, { status: e.status })
    }
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
