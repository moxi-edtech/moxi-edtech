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

    const { data: configuracoes } = await supabase
      .from('configuracoes_escola')
      .select('modelo_avaliacao, avaliacao_config')
      .eq('escola_id', escolaId)
      .maybeSingle()

    const modeloAvaliacao = String(configuracoes?.modelo_avaliacao ?? 'SIMPLIFICADO').toUpperCase()
    const componentes = Array.isArray((configuracoes as any)?.avaliacao_config?.componentes)
      ? (configuracoes as any).avaliacao_config.componentes
      : []
    const pesoPorTipo = new Map<string, number>()
    for (const comp of componentes as Array<{ code?: string; peso?: number; ativo?: boolean }>) {
      if (!comp?.code || comp?.ativo === false) continue
      const peso = typeof comp.peso === 'number' ? comp.peso : Number(comp.peso)
      if (Number.isFinite(peso)) {
        pesoPorTipo.set(comp.code.toString().trim().toUpperCase(), peso)
      }
    }

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
      .order('numero_chamada', { ascending: true, nullsFirst: false })

    matriculasQuery = applyKf2ListInvariants(matriculasQuery, { defaultLimit: 50 })

    const { data: matriculas, error: matriculasError } = await matriculasQuery
    if (matriculasError) {
      return NextResponse.json({ error: matriculasError.message }, { status: 400 })
    }

    const matriculaRows = (matriculas || []).filter((row: any) => row?.alunos)
    const matriculaIds = matriculaRows.map((row: any) => row.id)

    const notasPorMatricula = new Map<
      string,
      {
        sum: Record<number, number>
        count: Record<number, number>
        weightedSum: Record<number, number>
        weightSum: Record<number, number>
      }
    >()

    if (matriculaIds.length > 0) {
      const { data: notasRows, error: notasError } = await supabase
        .from('notas')
        .select('valor, matricula_id, avaliacoes ( trimestre, turma_disciplina_id, tipo, nome, peso )')
        .eq('escola_id', escolaId)
        .eq('avaliacoes.turma_disciplina_id', turmaDisciplina.id)
        .in('matricula_id', matriculaIds)

      if (notasError) {
        return NextResponse.json({ error: notasError.message }, { status: 400 })
      }

      for (const row of (notasRows || []) as Array<{
        valor: number | null
        matricula_id: string
        avaliacoes:
          | { trimestre: number | null; tipo?: string | null; nome?: string | null; peso?: number | null }
          | Array<{ trimestre: number | null; tipo?: string | null; nome?: string | null; peso?: number | null }>
          | null
      }>) {
        const avaliacao = Array.isArray(row.avaliacoes) ? row.avaliacoes[0] : row.avaliacoes
        const trimestre = avaliacao?.trimestre ?? null
        if (!trimestre) continue
        if (!notasPorMatricula.has(row.matricula_id)) {
          notasPorMatricula.set(row.matricula_id, { sum: {}, count: {}, weightedSum: {}, weightSum: {} })
        }
        const stats = notasPorMatricula.get(row.matricula_id)!
        if (typeof row.valor === 'number') {
          const tipoRaw = avaliacao?.tipo ?? avaliacao?.nome
          const tipo = tipoRaw ? tipoRaw.toString().trim().toUpperCase() : null
          const peso = (tipo && pesoPorTipo.get(tipo)) ?? avaliacao?.peso ?? 1
          stats.sum[trimestre] = (stats.sum[trimestre] ?? 0) + row.valor
          stats.count[trimestre] = (stats.count[trimestre] ?? 0) + 1
          stats.weightedSum[trimestre] = (stats.weightedSum[trimestre] ?? 0) + row.valor * Number(peso)
          stats.weightSum[trimestre] = (stats.weightSum[trimestre] ?? 0) + Number(peso)
        }
      }
    }

    const calcularNota = (stats: {
      sum: Record<number, number>
      count: Record<number, number>
      weightedSum: Record<number, number>
      weightSum: Record<number, number>
    } | undefined, trimestre: number) => {
      if (!stats) return null
      const count = stats.count[trimestre] ?? 0
      if (count === 0) return null
      const mediaSimples = stats.sum[trimestre] / count
      if (modeloAvaliacao === 'DEPOIS') return null

      const weightSum = stats.weightSum[trimestre] ?? 0
      if (weightSum > 0) {
        return Number((stats.weightedSum[trimestre] / weightSum).toFixed(2))
      }

      return Number(mediaSimples.toFixed(2))
    }

    const payload = matriculaRows.map((row: any) => {
      const stats = notasPorMatricula.get(row.id)
      const notas = {
        t1: calcularNota(stats, 1),
        t2: calcularNota(stats, 2),
        t3: calcularNota(stats, 3),
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
