import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { applyKf2ListInvariants } from '@/lib/kf2'
import {
  buildComponentesAtivos,
  buildPesoPorTipo,
  resolveModeloAvaliacao,
} from '@/lib/academico/avaliacao-utils'
import { getSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const Query = z.object({
  turmaId: z.string().uuid(),
  disciplinaId: z.string().uuid(),
  turmaDisciplinaId: z.string().uuid().optional(),
  trimestre: z.coerce.number().int().min(1).max(3).optional(),
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
    const turmaDisciplinaId = searchParams.get('turmaDisciplinaId') ?? searchParams.get('turma_disciplina_id')
    const trimestreRaw = searchParams.get('trimestre') ?? searchParams.get('periodoNumero')
    const parsed = Query.safeParse({
      turmaId,
      disciplinaId,
      turmaDisciplinaId: turmaDisciplinaId ?? undefined,
      trimestre: trimestreRaw ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
    }
    const detalhadoRaw = searchParams.get('detalhado') ?? ''
    const detalhado = ['1', 'true', 'yes'].includes(detalhadoRaw.toLowerCase())

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id)
    if (!escolaId) return NextResponse.json({ error: 'Escola não encontrada' }, { status: 400 })

    const admin = getSupabaseServerClient()
    if (!admin) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY ausente' }, { status: 500 })
    }

    const { data: professor } = await admin
      .from('professores')
      .select('id')
      .eq('profile_id', user.id)
      .eq('escola_id', escolaId)
      .maybeSingle()
    const professorId = (professor as any)?.id as string | undefined
    if (!professorId) return NextResponse.json({ error: 'Professor não encontrado' }, { status: 403 })

    const { data: turma } = await admin
      .from('turmas')
      .select('id, curso_id, classe_id')
      .eq('id', turmaId)
      .eq('escola_id', escolaId)
      .maybeSingle()
    if (!turma) return NextResponse.json({ error: 'Turma não encontrada' }, { status: 404 })

    let matrizFallback:
      | { id: string; disciplina_id: string | null; avaliacao_mode: string | null; avaliacao_modelo_id: string | null; avaliacao_disciplina_id: string | null }
      | null = null

    let turmaDisciplina: { id: string; professor_id: string | null; curso_matriz_id: string | null } | null = null

    if (parsed.data.turmaDisciplinaId) {
      const { data } = await admin
        .from('turma_disciplinas')
        .select('id, professor_id, curso_matriz_id')
        .eq('escola_id', escolaId)
        .eq('turma_id', turmaId)
        .eq('id', parsed.data.turmaDisciplinaId)
        .maybeSingle()
      turmaDisciplina = data as any
    } else {
      const { data: matrizData } = await admin
        .from('curso_matriz')
        .select('id, disciplina_id, avaliacao_mode, avaliacao_modelo_id, avaliacao_disciplina_id')
        .eq('escola_id', escolaId)
        .eq('curso_id', turma.curso_id)
        .eq('classe_id', turma.classe_id)
        .eq('disciplina_id', disciplinaId)
        .eq('ativo', true)
        .maybeSingle()
      matrizFallback = (matrizData as any) ?? null

      if (matrizFallback?.id) {
        const { data } = await admin
          .from('turma_disciplinas')
          .select('id, professor_id, curso_matriz_id')
          .eq('escola_id', escolaId)
          .eq('turma_id', turmaId)
          .eq('curso_matriz_id', matrizFallback.id)
          .maybeSingle()
        turmaDisciplina = data as any
      }
    }

    if (!turmaDisciplina) {
      return NextResponse.json({ error: 'Disciplina não atribuída à turma' }, { status: 404 })
    }

    let isProfessorAssigned = turmaDisciplina.professor_id === professorId
    if (!isProfessorAssigned) {
      const { data: assignment } = await admin
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

    const { data: matrizData } = await admin
      .from('curso_matriz')
      .select('id, disciplina_id, avaliacao_mode, avaliacao_modelo_id, avaliacao_disciplina_id')
      .eq('escola_id', escolaId)
      .eq('id', turmaDisciplina.curso_matriz_id)
      .eq('ativo', true)
      .maybeSingle()
    const matriz = (matrizData as any) ?? matrizFallback

    if (!matriz) {
      return NextResponse.json({ error: 'Disciplina não vinculada à matriz da turma' }, { status: 400 })
    }

    if (matriz.disciplina_id && matriz.disciplina_id !== disciplinaId) {
      return NextResponse.json({ error: 'Disciplina não vinculada à matriz da turma' }, { status: 400 })
    }

    const modelo = await resolveModeloAvaliacao({
      supabase: admin,
      escolaId,
      cursoId: turma.curso_id,
      classeId: turma.classe_id,
      matriz,
    })

    const componentesAtivos = buildComponentesAtivos(modelo.componentes)
    const pesoPorTipo = buildPesoPorTipo(modelo.componentes)
    const usarTrimestres = modelo.tipo === 'trimestral'

    let matriculasQuery = admin
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
        tipoSum?: Record<string, number>
        tipoCount?: Record<string, number>
      }
    >()

    if (matriculaIds.length > 0) {
      let notasQuery = admin
        .from('notas')
        .select('valor, matricula_id, avaliacoes ( trimestre, turma_disciplina_id, tipo, nome, peso )')
        .eq('escola_id', escolaId)
        .eq('avaliacoes.turma_disciplina_id', turmaDisciplina.id)
        .in('matricula_id', matriculaIds)

      if (detalhado && parsed.data.trimestre && usarTrimestres) {
        notasQuery = notasQuery.eq('avaliacoes.trimestre', parsed.data.trimestre)
      }

      const { data: notasRows, error: notasError } = await notasQuery

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
        const trimestre = usarTrimestres ? avaliacao?.trimestre ?? null : 0
        if (usarTrimestres && !trimestre) continue
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
          if (detalhado) {
            if (!stats.tipoSum) stats.tipoSum = {}
            if (!stats.tipoCount) stats.tipoCount = {}
            const key = tipo ?? 'OUTRO'
            stats.tipoSum[key] = (stats.tipoSum[key] ?? 0) + row.valor
            stats.tipoCount[key] = (stats.tipoCount[key] ?? 0) + 1
          }
        }
      }
    }

    if (detalhado && parsed.data.trimestre) {
      const trimestre = parsed.data.trimestre
      const pickTipo = (stats: { tipoSum?: Record<string, number>; tipoCount?: Record<string, number> } | undefined, tipo: string) => {
        if (!stats?.tipoSum || !stats?.tipoCount) return null
        const sum = stats.tipoSum[tipo] ?? 0
        const count = stats.tipoCount[tipo] ?? 0
        if (count === 0) return null
        return Number((sum / count).toFixed(2))
      }

      const resolveValor = (
        stats: { tipoSum?: Record<string, number>; tipoCount?: Record<string, number> } | undefined,
        tipo: string
      ) => {
        const raw = pickTipo(stats, tipo)
        if (raw !== null) return raw
        if (tipo === 'NPT') return pickTipo(stats, 'PT')
        return null
      }

      const calcularMt = (values: Array<{ tipo: string; valor: number | null }>) => {
        const valid = values.filter((entry) => typeof entry.valor === 'number') as Array<{
          tipo: string
          valor: number
        }>
        if (valid.length === 0) return null
        let weightedSum = 0
        let weightSum = 0
        for (const entry of valid) {
          const peso = pesoPorTipo.get(entry.tipo) ?? 1
          weightedSum += entry.valor * Number(peso)
          weightSum += Number(peso)
        }
        if (weightSum > 0) {
          return Number((weightedSum / weightSum).toFixed(2))
        }
        const avg = valid.reduce((acc, cur) => acc + cur.valor, 0) / valid.length
        return Number(avg.toFixed(2))
      }

      const payload = matriculaRows.map((row: any) => {
        const stats = notasPorMatricula.get(row.id)
        const mac = resolveValor(stats, 'MAC')
        const npp = resolveValor(stats, 'NPP')
        const npt = resolveValor(stats, 'NPT')
        const componentes = componentesAtivos.reduce<Record<string, number | null>>((acc, tipo) => {
          acc[tipo] = resolveValor(stats, tipo)
          return acc
        }, {})
        const mt = calcularMt([
          ...componentesAtivos.map((tipo) => ({
            tipo,
            valor: componentes[tipo] ?? null,
          })),
        ])
        return {
          aluno_id: row.aluno_id,
          nome: row.alunos?.nome ?? 'Sem nome',
          foto: row.alunos?.profiles?.avatar_url ?? null,
          numero_chamada: row.numero_chamada ?? null,
          mac,
          npp,
          npt,
          mt,
          componentes,
        }
      })

      return NextResponse.json(payload)
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
      if (componentesAtivos.length === 0) return null

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
