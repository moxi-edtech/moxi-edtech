import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { authorizeTurmasManage } from '@/lib/escola/disciplinas'
import { applyKf2ListInvariants } from '@/lib/kf2'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const Query = z.object({
  disciplinaId: z.string().uuid(),
  trimestre: z.coerce.number().int().min(1).max(3),
})

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseServerTyped<any>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const { id: turmaId } = await ctx.params
    const { searchParams } = new URL(req.url)
    const disciplinaId = searchParams.get('disciplinaId') ?? searchParams.get('disciplina_id')
    const trimestre = searchParams.get('trimestre') ?? searchParams.get('periodoNumero')
    const parsed = Query.safeParse({ disciplinaId, trimestre })
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Parâmetros inválidos' }, { status: 400 })
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 403 })

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id)
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 })

    const { data: turma } = await supabase
      .from('turmas')
      .select('id, curso_id, classe_id')
      .eq('id', turmaId)
      .eq('escola_id', escolaId)
      .maybeSingle()
    if (!turma) return NextResponse.json({ ok: false, error: 'Turma não encontrada' }, { status: 404 })

    const { data: matriz } = await supabase
      .from('curso_matriz')
      .select('id')
      .eq('escola_id', escolaId)
      .eq('curso_id', turma.curso_id)
      .eq('classe_id', turma.classe_id)
      .eq('disciplina_id', parsed.data.disciplinaId)
      .eq('ativo', true)
      .maybeSingle()
    if (!matriz) {
      return NextResponse.json({ ok: false, error: 'Disciplina não vinculada à turma' }, { status: 400 })
    }

    const { data: turmaDisciplina } = await supabase
      .from('turma_disciplinas')
      .select('id')
      .eq('escola_id', escolaId)
      .eq('turma_id', turmaId)
      .eq('curso_matriz_id', matriz.id)
      .maybeSingle()
    if (!turmaDisciplina) {
      return NextResponse.json({ ok: false, error: 'Disciplina não atribuída à turma' }, { status: 404 })
    }

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
      return NextResponse.json({ ok: false, error: matriculasError.message }, { status: 400 })
    }

    const matriculaRows = (matriculas || []).filter((row: any) => row?.alunos)
    const matriculaIds = matriculaRows.map((row: any) => row.id)

    const notasPorMatricula = new Map<
      string,
      {
        tipoSum?: Record<string, number>
        tipoCount?: Record<string, number>
      }
    >()

    if (matriculaIds.length > 0) {
      const { data: notasRows, error: notasError } = await supabase
        .from('notas')
        .select('valor, matricula_id, avaliacoes ( trimestre, turma_disciplina_id, tipo, nome, peso )')
        .eq('escola_id', escolaId)
        .eq('avaliacoes.turma_disciplina_id', turmaDisciplina.id)
        .eq('avaliacoes.trimestre', parsed.data.trimestre)
        .in('matricula_id', matriculaIds)

      if (notasError) {
        return NextResponse.json({ ok: false, error: notasError.message }, { status: 400 })
      }

      for (const row of (notasRows || []) as Array<{
        valor: number | null
        matricula_id: string
        avaliacoes:
          | { tipo?: string | null; nome?: string | null; peso?: number | null }
          | Array<{ tipo?: string | null; nome?: string | null; peso?: number | null }>
          | null
      }>) {
        const avaliacao = Array.isArray(row.avaliacoes) ? row.avaliacoes[0] : row.avaliacoes
        if (!notasPorMatricula.has(row.matricula_id)) {
          notasPorMatricula.set(row.matricula_id, { tipoSum: {}, tipoCount: {} })
        }
        const stats = notasPorMatricula.get(row.matricula_id)!
        if (typeof row.valor === 'number') {
          const tipoRaw = avaliacao?.tipo ?? avaliacao?.nome
          const tipo = tipoRaw ? tipoRaw.toString().trim().toUpperCase() : 'OUTRO'
          stats.tipoSum![tipo] = (stats.tipoSum![tipo] ?? 0) + row.valor
          stats.tipoCount![tipo] = (stats.tipoCount![tipo] ?? 0) + 1
        }
      }
    }

    const pickTipo = (stats: { tipoSum?: Record<string, number>; tipoCount?: Record<string, number> } | undefined, tipo: string) => {
      if (!stats?.tipoSum || !stats?.tipoCount) return null
      const sum = stats.tipoSum[tipo] ?? 0
      const count = stats.tipoCount[tipo] ?? 0
      if (count === 0) return null
      return Number((sum / count).toFixed(2))
    }

    const calcularMt = (values: Array<{ tipo: string; valor: number | null }>) => {
      if (modeloAvaliacao === 'DEPOIS') return null
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
      const mac = pickTipo(stats, 'MAC')
      const npp = pickTipo(stats, 'NPP')
      const npt = pickTipo(stats, 'NPT')
      const mt = calcularMt([
        { tipo: 'MAC', valor: mac },
        { tipo: 'NPP', valor: npp },
        { tipo: 'NPT', valor: npt },
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
      }
    })

    return NextResponse.json({ ok: true, items: payload })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
