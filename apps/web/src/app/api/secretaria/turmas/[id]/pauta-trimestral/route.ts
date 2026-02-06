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
  periodoNumero: z.coerce.number().int().min(1).max(3),
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
    const periodoNumero = searchParams.get('periodoNumero') ?? searchParams.get('periodo')
    const parsed = Query.safeParse({ disciplinaId, periodoNumero })
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Parâmetros inválidos' }, { status: 400 })
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 403 })

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id)
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 })

    const { data: turma } = await supabase
      .from('turmas')
      .select('id, nome, curso_id, classe_id, ano_letivo, turno, diretor_turma_id')
      .eq('id', turmaId)
      .eq('escola_id', escolaId)
      .maybeSingle()
    if (!turma) return NextResponse.json({ ok: false, error: 'Turma não encontrada' }, { status: 404 })

    const { data: matriz } = await supabase
      .from('curso_matriz')
      .select('id, disciplina_id, disciplina:disciplinas_catalogo(id, nome)')
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
      .select('id, professor_id, periodos_ativos')
      .eq('escola_id', escolaId)
      .eq('turma_id', turmaId)
      .eq('curso_matriz_id', matriz.id)
      .maybeSingle()
    if (!turmaDisciplina?.id) {
      return NextResponse.json({ ok: false, error: 'Disciplina não atribuída à turma' }, { status: 404 })
    }

    const { data: anoLetivo } = await supabase
      .from('anos_letivos')
      .select('id')
      .eq('escola_id', escolaId)
      .eq('ano', turma.ano_letivo)
      .maybeSingle()

    const { data: periodosRows } = anoLetivo?.id
      ? await supabase
          .from('periodos_letivos')
          .select('id, numero')
          .eq('escola_id', escolaId)
          .eq('ano_letivo_id', anoLetivo.id)
          .eq('tipo', 'TRIMESTRE')
          .order('numero', { ascending: true })
      : { data: [] as any[] }

    const periodosAtivos = (turmaDisciplina.periodos_ativos || []).map((n: any) => Number(n))
    if (periodosAtivos.length > 0 && !periodosAtivos.includes(parsed.data.periodoNumero)) {
      return NextResponse.json({ ok: false, error: 'Período não ativo para esta disciplina' }, { status: 400 })
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
        numero_chamada,
        alunos!inner (
          id,
          nome,
          profiles!alunos_profile_id_fkey ( sexo )
        )
      `
      )
      .eq('escola_id', escolaId)
      .eq('turma_id', turmaId)
      .in('status', ['ativo', 'ativa', 'active'])
      .order('numero_chamada', { ascending: true, nullsFirst: false })

    matriculasQuery = applyKf2ListInvariants(matriculasQuery, { defaultLimit: 1000 })

    const { data: matriculas, error: matriculasError } = await matriculasQuery
    if (matriculasError) {
      return NextResponse.json({ ok: false, error: matriculasError.message }, { status: 400 })
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
        .eq('avaliacoes.trimestre', parsed.data.periodoNumero)
        .in('matricula_id', matriculaIds)

      if (notasError) {
        return NextResponse.json({ ok: false, error: notasError.message }, { status: 400 })
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

    const calcularNota = (
      stats: {
        sum: Record<number, number>
        count: Record<number, number>
        weightedSum: Record<number, number>
        weightSum: Record<number, number>
      } | undefined,
      trimestre: number
    ) => {
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

    let diretorNome: string | null = null
    if (turma.diretor_turma_id) {
      const { data: diretor } = await supabase
        .from('escola_users')
        .select('user_id')
        .eq('id', turma.diretor_turma_id)
        .maybeSingle()
      if (diretor?.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('nome')
          .eq('user_id', diretor.user_id)
          .maybeSingle()
        diretorNome = (profile as any)?.nome ?? null
      }
    }

    let professorNome: string | null = null
    if (turmaDisciplina.professor_id) {
      const { data: professor } = await supabase
        .from('professores')
        .select('profiles!professores_profile_id_fkey ( nome )')
        .eq('id', turmaDisciplina.professor_id)
        .eq('escola_id', escolaId)
        .maybeSingle()
      const profile = Array.isArray((professor as any)?.profiles) ? (professor as any)?.profiles?.[0] : (professor as any)?.profiles
      professorNome = profile?.nome ?? null
    }

    const { data: escola } = await supabase
      .from('escolas')
      .select('nome, responsavel, diretor_nome')
      .eq('id', escolaId)
      .maybeSingle()

    const payload = {
      metadata: {
        provincia: '—',
        escola: escola?.nome ?? 'Escola',
        anoLectivo: turma.ano_letivo ? String(turma.ano_letivo) : '',
        turma: turma.nome ?? 'Turma',
        disciplina: (matriz as any)?.disciplina?.nome ?? 'Disciplina',
        professor: professorNome ?? '—',
        diretor: diretorNome ?? escola?.diretor_nome ?? escola?.responsavel ?? '—',
        emissao: new Date().toLocaleString('pt-PT'),
        hash: crypto.randomUUID(),
      },
      alunos: matriculaRows.map((row: any, index: number) => {
        const stats = notasPorMatricula.get(row.id)
        const t = calcularNota(stats, parsed.data.periodoNumero)
        const generoRaw = row?.alunos?.profiles?.sexo ?? null
        const genero = generoRaw === 'F' || generoRaw === 'f' ? 'F' : 'M'
        return {
          id: row.aluno_id,
          numero: row.numero_chamada ?? index + 1,
          nome: row.alunos?.nome ?? 'Sem nome',
          genero,
          trim1: { mac: null, npp: null, npt: null, mt: parsed.data.periodoNumero === 1 ? t : null },
          trim2: { mac: null, npp: null, npt: null, mt: parsed.data.periodoNumero === 2 ? t : null },
          trim3: { mac: null, npp: null, npt: null, mt: parsed.data.periodoNumero === 3 ? t : null },
          mfd: null,
          obs: '',
        }
      }),
      periodoNumero: parsed.data.periodoNumero,
      periodosDisponiveis: (periodosRows || []).map((p: any) => p.numero),
    }

    return NextResponse.json({ ok: true, payload })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
