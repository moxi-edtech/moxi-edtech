import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { requireRoleInSchool } from '@/lib/authz'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  turma_id: z.string().uuid(),
  alunos_ids: z.array(z.string().uuid()).optional(),
})

export async function POST(request: Request) {
  const supabase = await supabaseServerTyped<any>()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

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

  if (alunos_ids && alunos_ids.length > 0) query = query.in('aluno_id', alunos_ids)

  const { data: matriculas, error: matError } = await query
  if (matError) return NextResponse.json({ ok: false, error: matError.message }, { status: 400 })

  const { data: turmaDisciplinas } = await supabase
    .from('turma_disciplinas')
    .select('id, conta_para_media_med, curso_matriz(disciplina_id, disciplinas_catalogo(nome))')
    .eq('escola_id', escolaId)
    .eq('turma_id', turma_id)

  const tdMap = new Map<string, { nome: string; conta: boolean; disciplina_id: string | null }>()
  for (const td of turmaDisciplinas || []) {
    tdMap.set(td.id, {
      nome: (td as any)?.curso_matriz?.disciplinas_catalogo?.nome ?? 'Disciplina',
      conta: (td as any)?.conta_para_media_med !== false,
      disciplina_id: (td as any)?.curso_matriz?.disciplina_id ?? null,
    })
  }

  const snapshots: any[] = []

  for (const m of matriculas || []) {
    const { data: docRes, error: emitError } = await supabase.rpc('emitir_documento_final', {
      p_escola_id: escolaId,
      p_aluno_id: m.aluno_id,
      p_ano_letivo: Number(turma.ano_letivo),
      p_tipo_documento: 'declaracao_notas',
    })
    if (emitError || !docRes?.docId) continue

    const { data: row } = await supabase
      .from('documentos_emitidos')
      .select('dados_snapshot, hash_validacao')
      .eq('id', docRes.docId)
      .eq('escola_id', escolaId)
      .maybeSingle()

    const { data: boletimRows } = await supabase
      .from('vw_boletim_por_matricula')
      .select('turma_disciplina_id, trimestre, nota_final')
      .eq('escola_id', escolaId)
      .eq('matricula_id', m.id)

    const notasByDisciplina = new Map<string, { t1?: number | null; t2?: number | null; t3?: number | null }>()
    for (const rowNota of boletimRows || []) {
      const td = tdMap.get((rowNota as any).turma_disciplina_id)
      if (!td?.disciplina_id) continue
      const current = notasByDisciplina.get(td.disciplina_id) ?? {}
      const tri = Number((rowNota as any).trimestre)
      if (tri === 1) current.t1 = (rowNota as any).nota_final
      if (tri === 2) current.t2 = (rowNota as any).nota_final
      if (tri === 3) current.t3 = (rowNota as any).nota_final
      notasByDisciplina.set(td.disciplina_id, current)
    }

    const disciplinas = Array.from(tdMap.values()).map((disc) => {
      const notas = disc.disciplina_id ? notasByDisciplina.get(disc.disciplina_id) : undefined
      return {
        nome: disc.nome,
        conta_para_media_med: disc.conta,
        t1: notas?.t1 ?? null,
        t2: notas?.t2 ?? null,
        t3: notas?.t3 ?? null,
      }
    })

    const snapshot = (row?.dados_snapshot || {}) as Record<string, any>
    snapshots.push({
      ...snapshot,
      hash_validacao: row?.hash_validacao ?? snapshot.hash_validacao ?? null,
      disciplinas,
    })
  }

  return NextResponse.json({ ok: true, snapshots })
}
