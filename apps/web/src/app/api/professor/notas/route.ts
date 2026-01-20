import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { recordAuditServer } from '@/lib/audit'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'

const Body = z.object({
  turma_id: z.string().uuid(),
  disciplina_id: z.string().uuid().optional(),
  turma_disciplina_id: z.string().uuid().optional(),
  periodo_letivo_id: z.string().uuid().optional(),
  trimestre: z.number().int().min(1).max(3).optional(),
  tipo_avaliacao: z.string().trim().min(2).max(40).optional(),
  disciplina_nome: z.string().optional(),
  notas: z.array(z.object({ aluno_id: z.string().uuid(), valor: z.number().min(0).max(100) })),
})

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const parsed = Body.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues?.[0]?.message || 'Dados inválidos' }, { status: 400 })
    }
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
      .select('id, escola_id, curso_id, classe_id, ano_letivo')
      .eq('id', body.turma_id)
      .eq('escola_id', escolaId)
      .maybeSingle()
    if (!turma) return NextResponse.json({ ok: false, error: 'Turma não encontrada' }, { status: 404 })

    let disciplinaId = body.disciplina_id || null
    let resolvedTurmaDisciplinaId = body.turma_disciplina_id || null

    if (!resolvedTurmaDisciplinaId) {
      if (!disciplinaId) {
        return NextResponse.json({ ok: false, error: 'Disciplina obrigatória' }, { status: 400 })
      }

      const { data: matriz } = await supabase
        .from('curso_matriz')
        .select('id')
        .eq('escola_id', escolaId)
        .eq('curso_id', turma.curso_id)
        .eq('classe_id', turma.classe_id)
        .eq('disciplina_id', disciplinaId)
        .eq('ativo', true)
        .maybeSingle()

      if (!matriz) {
        return NextResponse.json({ ok: false, error: 'Disciplina não vinculada à matriz da turma' }, { status: 400 })
      }

      const { data: turmaDisc } = await supabase
        .from('turma_disciplinas')
        .select('id, professor_id, curso_matriz_id')
        .eq('escola_id', escolaId)
        .eq('turma_id', body.turma_id)
        .eq('curso_matriz_id', matriz.id)
        .maybeSingle()

      if (!turmaDisc) {
        return NextResponse.json({ ok: false, error: 'Disciplina não atribuída à turma' }, { status: 400 })
      }

      resolvedTurmaDisciplinaId = turmaDisc.id
    }

    const { data: turmaDisciplina } = await supabase
      .from('turma_disciplinas')
      .select('id, professor_id, curso_matriz_id')
      .eq('id', resolvedTurmaDisciplinaId)
      .eq('escola_id', escolaId)
      .maybeSingle()

    if (!disciplinaId && turmaDisciplina?.curso_matriz_id) {
      const { data: matrizDisc } = await supabase
        .from('curso_matriz')
        .select('disciplina_id')
        .eq('id', turmaDisciplina.curso_matriz_id)
        .maybeSingle()
      disciplinaId = (matrizDisc as any)?.disciplina_id ?? null
    }

    let isProfessorAssigned = turmaDisciplina?.professor_id === professorId
    if (!isProfessorAssigned && disciplinaId) {
      const { data: assignment } = await supabase
        .from('turma_disciplinas_professores')
        .select('id')
        .eq('escola_id', escolaId)
        .eq('turma_id', body.turma_id)
        .eq('disciplina_id', disciplinaId)
        .eq('professor_id', professorId)
        .maybeSingle()
      isProfessorAssigned = Boolean(assignment)
    }

    if (!isProfessorAssigned) {
      return NextResponse.json({ ok: false, error: 'Professor não atribuído à disciplina' }, { status: 403 })
    }

    const tipoAvaliacao = (body.tipo_avaliacao || 'MAC').trim()
    const anoLetivo = turma.ano_letivo || new Date().getFullYear()
    const trimestre = body.trimestre ?? (() => {
      const month = new Date().getMonth() + 1
      if (month <= 4) return 1
      if (month <= 8) return 2
      return 3
    })()

    const { data: avaliacao, error: avaliacaoErr } = await supabase
      .from('avaliacoes')
      .upsert(
        {
          escola_id: escolaId,
          turma_disciplina_id: resolvedTurmaDisciplinaId,
          ano_letivo: anoLetivo,
          trimestre,
          nome: tipoAvaliacao,
          tipo: tipoAvaliacao,
          peso: 1,
          nota_max: 20,
        },
        { onConflict: 'escola_id,turma_disciplina_id,ano_letivo,trimestre,tipo' }
      )
      .select('id')
      .maybeSingle()

    if (avaliacaoErr || !avaliacao?.id) {
      return NextResponse.json({ ok: false, error: avaliacaoErr?.message || 'Falha ao resolver avaliação' }, { status: 400 })
    }

    let disciplinaNome = body.disciplina_nome || null
    if (!disciplinaNome && disciplinaId) {
      const { data: disc } = await supabase
        .from('disciplinas')
        .select('nome')
        .eq('id', disciplinaId)
        .maybeSingle()
      disciplinaNome = (disc as any)?.nome ?? null
    }

    const alunoIds = body.notas.map((n) => n.aluno_id)
    const { data: matriculas } = await supabase
      .from('matriculas')
      .select('id, aluno_id, status')
      .eq('escola_id', escolaId)
      .eq('turma_id', body.turma_id)
      .eq('ano_letivo', anoLetivo)
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

    const rows = body.notas.map((n) => ({
      escola_id: escolaId,
      avaliacao_id: avaliacao.id,
      matricula_id: matriculaByAluno.get(n.aluno_id) as string,
      valor: n.valor,
    }))

    const { error } = await supabase
      .from('notas')
      .upsert(rows as any, { onConflict: 'escola_id,matricula_id,avaliacao_id' })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    recordAuditServer({
      escolaId,
      portal: 'professor',
      acao: 'NOTA_LANCADA',
      entity: 'avaliacoes',
      entityId: avaliacao.id,
      details: {
        turma_id: body.turma_id,
        turma_disciplina_id: resolvedTurmaDisciplinaId,
        tipo_avaliacao: tipoAvaliacao,
        trimestre,
        ano_letivo: anoLetivo,
        quantidade: rows.length,
      },
    }).catch(() => null)

    return NextResponse.json({ ok: true, avaliacao_id: avaliacao.id })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
