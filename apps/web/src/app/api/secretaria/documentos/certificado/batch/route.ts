import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { requireRoleInSchool } from '@/lib/authz'
import { requireFeature } from '@/lib/plan/requireFeature'
import { HttpError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  turma_id: z.string().uuid(),
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
    const resolvedEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId)
    if (!resolvedEscolaId || resolvedEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: 'Escola inválida' }, { status: 403 })
    }

    const { error: authError } = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: ['secretaria', 'admin', 'admin_escola', 'staff_admin'],
    })
    if (authError) return authError

    let query = supabase
      .from('matriculas')
      .select('id, aluno_id')
      .eq('escola_id', escolaId)
      .eq('turma_id', turma_id)
      .in('status', ['concluido', 'reprovado'])

    if (alunos_ids && alunos_ids.length > 0) {
      query = query.in('aluno_id', alunos_ids)
    }

    const { data: matriculas, error: matError } = await query
    if (matError) return NextResponse.json({ ok: false, error: matError.message }, { status: 400 })

    const snapshots: any[] = []
    for (const m of matriculas || []) {
      const { data: docRes, error: emitError } = await supabase.rpc('emitir_documento_final', {
        p_escola_id: escolaId,
        p_aluno_id: m.aluno_id,
        p_ano_letivo: Number(turma.ano_letivo),
        p_tipo_documento: 'certificado',
      })
      if (emitError || !docRes?.docId) continue

      const { data: row } = await supabase
        .from('documentos_emitidos')
        .select('dados_snapshot, hash_validacao')
        .eq('id', docRes.docId)
        .eq('escola_id', escolaId)
        .maybeSingle()

      const snapshot = (row?.dados_snapshot || {}) as Record<string, any>
      snapshots.push({ ...snapshot, hash_validacao: row?.hash_validacao ?? snapshot.hash_validacao ?? null })
    }

    return NextResponse.json({ ok: true, snapshots })
  } catch (err) {
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
