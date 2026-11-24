import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { requireRoleInSchool } from '@/lib/authz'
import { requireFeature } from '@/lib/plan/requireFeature'
import { HttpError } from '@/lib/errors'
import { buildCertificadoSnapshot, type CertificadoSnapshot } from '@/lib/documentos/certificadoSnapshot'
import { K12_DOCUMENTOS_ROLE_GROUP } from '@/lib/roles'
import { AcademicYearContextError, assertAcademicYearEntity, resolveAcademicYearContext } from '@/lib/academic-year/context'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  turma_id: z.string().uuid(),
  ano_letivo_id: z.string().uuid(),
  alunos_ids: z.array(z.string().uuid()).optional(),
})

export async function POST(request: Request) {
  try {
    const supabase = await supabaseServerTyped<any>()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    await requireFeature('doc_qr_code')

    const parsed = BodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 })
    }

    const { turma_id, alunos_ids } = parsed.data

    const { data: turma, error: turmaError } = await supabase
      .from('turmas')
      .select('id, escola_id, ano_letivo')
      .eq('id', turma_id)
      .single()

    if (turmaError || !turma?.escola_id) {
      return NextResponse.json({ ok: false, error: 'Turma não encontrada' }, { status: 404 })
    }

    const escolaId = turma.escola_id as string
    const academicContext = await resolveAcademicYearContext(supabase, {
      userId: user.id,
      requestedAcademicYearId: parsed.data.ano_letivo_id,
      operation: "READ",
    })
    if (academicContext.escolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: 'Escola inválida' }, { status: 403 })
    }
    await assertAcademicYearEntity(supabase, {
      table: "turmas",
      entityId: turma_id,
      escolaId,
      anoLetivoId: academicContext.anoLetivoId,
    })
    const resolvedEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId)
    if (!resolvedEscolaId || resolvedEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: 'Escola inválida' }, { status: 403 })
    }

    const { error: authError } = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: [...K12_DOCUMENTOS_ROLE_GROUP],
    })
    if (authError) return authError

    let query = supabase
      .from('matriculas')
      .select('id, aluno_id')
      .eq('escola_id', escolaId)
      .eq('turma_id', turma_id)
      .eq('session_id', academicContext.anoLetivoId)
      .in('status', ['concluido', 'reprovado'])

    if (alunos_ids && alunos_ids.length > 0) {
      query = query.in('aluno_id', alunos_ids)
    }

    const { data: matriculas, error: matError } = await query
    if (matError) return NextResponse.json({ ok: false, error: matError.message }, { status: 400 })

    if (!matriculas?.length || (alunos_ids?.length && new Set(matriculas.map((m: any) => m.aluno_id)).size !== new Set(alunos_ids).size)) return NextResponse.json({ ok: false, error: 'Não existem matrículas elegíveis para todos os alunos selecionados.' }, { status: 409 })
    const snapshots: CertificadoSnapshot[] = []
    for (const m of matriculas || []) {
      const { data: access, error: accessError } = await supabase.rpc('documento_individual_acesso', { p_escola_id: escolaId, p_aluno_id: m.aluno_id, p_session_id: academicContext.anoLetivoId, p_tipo: 'certificado' })
      if (accessError || access?.matricula_id !== m.id) return NextResponse.json({ ok: false, error: 'Matrícula ou elegibilidade divergente no lote.', alunoId: m.aluno_id }, { status: 409 })
      const { data: docRes, error: emitError } = await supabase.rpc('emitir_documento_final_individual', {
        p_escola_id: escolaId,
        p_aluno_id: m.aluno_id,
        p_ano_letivo: Number(turma.ano_letivo),
        p_tipo_documento: 'certificado',
        p_session_id: academicContext.anoLetivoId,
        p_idempotency_key: `certificado-lote:${m.id}`,
      })
      if (emitError || !docRes?.docId) return NextResponse.json({ ok: false, error: 'Existe um certificado pendente de regularização académica ou financeira. Nenhum PDF parcial foi disponibilizado.', alunoId: m.aluno_id }, { status: 409 })

      const { data: row, error: rowError } = await supabase
        .from('documentos_emitidos')
        .select('dados_snapshot, hash_validacao')
        .eq('id', docRes.docId)
        .eq('escola_id', escolaId)
        .maybeSingle()

      if (rowError || !row?.dados_snapshot || row.dados_snapshot.matricula_id !== m.id) return NextResponse.json({ ok: false, error: 'Documento não corresponde à matrícula do lote.' }, { status: 409 })
      const snapshot = row.dados_snapshot as Record<string, unknown>
      const certificado = await buildCertificadoSnapshot({
        supabase,
        escolaId,
        alunoId: m.aluno_id,
        baseSnapshot: snapshot,
        hashValidacao: row?.hash_validacao ?? snapshot.hash_validacao ?? null,
      })

      snapshots.push(certificado)
    }

    return NextResponse.json({ ok: true, context: academicContext, snapshots })
  } catch (err) {
    if (err instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: err.status })
    }
    if (err instanceof HttpError) {
      return NextResponse.json(
        {
          ok: false,
          error: err.message,
          error_code: err.code,
          upgrade_required: err.status === 403 && err.code === 'PLAN_FEATURE_REQUIRED',
        },
        { status: err.status }
      )
    }
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
