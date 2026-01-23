import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { applyKf2ListInvariants } from '@/lib/kf2'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const Query = z.object({
  turmaId: z.string().uuid(),
  disciplinaId: z.string().uuid(),
})

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const turmaId = searchParams.get('turmaId') ?? searchParams.get('turma_id')
    const disciplinaId = searchParams.get('disciplinaId') ?? searchParams.get('disciplina_id')
    const parsed = Query.safeParse({ turmaId, disciplinaId })
    if (!parsed.success) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id)
    if (!escolaId) return NextResponse.json({ error: 'Escola não encontrada' }, { status: 400 })

    const { data: professor } = await supabase
      .from('professores')
      .select('id')
      .eq('profile_id', user.id)
      .eq('escola_id', escolaId)
      .maybeSingle()
    const professorId = (professor as any)?.id as string | undefined
    if (!professorId) return NextResponse.json({ error: 'Professor não encontrado' }, { status: 403 })

    const { data: turma } = await supabase
      .from('turmas')
      .select('id, curso_id, classe_id')
      .eq('id', turmaId)
      .eq('escola_id', escolaId)
      .maybeSingle()
    if (!turma) return NextResponse.json({ error: 'Turma não encontrada' }, { status: 404 })

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
      return NextResponse.json({ error: 'Disciplina não vinculada à matriz da turma' }, { status: 400 })
    }

    const { data: turmaDisciplina } = await supabase
      .from('turma_disciplinas')
      .select('id, professor_id')
      .eq('escola_id', escolaId)
      .eq('turma_id', turmaId)
      .eq('curso_matriz_id', matriz.id)
      .maybeSingle()

    if (!turmaDisciplina) {
      return NextResponse.json({ error: 'Disciplina não atribuída à turma' }, { status: 404 })
    }

    let isProfessorAssigned = turmaDisciplina.professor_id === professorId
    if (!isProfessorAssigned) {
      const { data: assignment } = await supabase
        .from('turma_disciplinas_professores')
        .select('id')
        .eq('escola_id', escolaId)
        .eq('turma_id', turmaId)
        .eq('disciplina_id', disciplinaId)
        .eq('professor_id', professorId)
        .maybeSingle()
      isProfessorAssigned = Boolean(assignment)
    }

    if (!isProfessorAssigned) {
      return NextResponse.json({ error: 'Professor não atribuído à disciplina' }, { status: 403 })
    }

    let matriculasQuery = supabase
      .from('matriculas')
      .select(
        `
        id,
        aluno_id,
        numero_chamada,
        alunos!inner (
          id,
          nome,
          profile_id,
          profiles!alunos_profile_id_fkey ( avatar_url )
        )
      `
      )
      .eq('escola_id', escolaId)
      .eq('turma_id', turmaId)
      .in('status', ['ativo', 'ativa', 'active'])
      .order('numero_chamada', { ascending: true, nullsLast: true })

    matriculasQuery = applyKf2ListInvariants(matriculasQuery, { defaultLimit: 500 })

    const { data: matriculas, error: matriculasError } = await matriculasQuery
    if (matriculasError) {
      return NextResponse.json({ error: matriculasError.message }, { status: 400 })
    }

    const matriculaRows = (matriculas || []).filter((row: any) => row?.alunos)
    const matriculaIds = matriculaRows.map((row: any) => row.id)

    const notasPorMatricula = new Map<
      string,
      { sum: Record<number, number>; count: Record<number, number> }
    >()

    if (matriculaIds.length > 0) {
      const { data: notasRows, error: notasError } = await supabase
        .from('notas')
        .select('valor, matricula_id, avaliacoes ( trimestre, turma_disciplina_id )')
        .eq('escola_id', escolaId)
        .eq('avaliacoes.turma_disciplina_id', turmaDisciplina.id)
        .in('matricula_id', matriculaIds)

      if (notasError) {
        return NextResponse.json({ error: notasError.message }, { status: 400 })
      }

      for (const row of (notasRows || []) as Array<{
        valor: number | null
        matricula_id: string
        avaliacoes: { trimestre: number | null } | null
      }>) {
        const trimestre = row.avaliacoes?.trimestre ?? null
        if (!trimestre) continue
        if (!notasPorMatricula.has(row.matricula_id)) {
          notasPorMatricula.set(row.matricula_id, { sum: {}, count: {} })
        }
        const stats = notasPorMatricula.get(row.matricula_id)!
        if (typeof row.valor === 'number') {
          stats.sum[trimestre] = (stats.sum[trimestre] ?? 0) + row.valor
          stats.count[trimestre] = (stats.count[trimestre] ?? 0) + 1
        }
      }
    }

    const payload = matriculaRows.map((row: any) => {
      const stats = notasPorMatricula.get(row.id)
      const notas = {
        t1: stats?.count[1] ? Number((stats.sum[1] / stats.count[1]).toFixed(2)) : null,
        t2: stats?.count[2] ? Number((stats.sum[2] / stats.count[2]).toFixed(2)) : null,
        t3: stats?.count[3] ? Number((stats.sum[3] / stats.count[3]).toFixed(2)) : null,
      }
      return {
        aluno_id: row.aluno_id,
        nome: row.alunos?.nome ?? 'Sem nome',
        foto: row.alunos?.profiles?.avatar_url ?? null,
        notas,
      }
    })

    return NextResponse.json(payload)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
