// @kf2 allow-scan
// apps/web/src/app/api/secretaria/admissoes/radar/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRoleInSchool } from '@/lib/authz'

export const dynamic = "force-dynamic"

const searchParamsSchema = z
  .object({
    escolaId: z.string().uuid(),
    limit: z.string().regex(/^\d+$/).optional(),
    cursor_open: z.string().optional(),
    cursor_mat: z.string().optional(),
    cursor: z.string().optional(),
    turmaId: z.string().uuid().optional(),
    q: z.string().trim().max(120).optional(),
    status: z.enum(['novas', 'pre_candidaturas', 'lista_espera', 'pendentes', 'concluidas', 'expirando', 'reenviados', 'all']).optional(),
  })
  .strict()

type Status =
  | 'submetida'
  | 'pre_candidatura'
  | 'documentos_reenviados'
  | 'lista_espera'
  | 'em_analise'
  | 'aprovada'
  | 'aguardando_pagamento'
  | 'aguardando_compensacao'
  | 'matriculado'

const SUBMETIDA_STATUSES = ['submetida', 'pendente', 'documentos_reenviados']
const PRE_CANDIDATURA_STATUSES = ['pre_candidatura']
const LISTA_ESPERA_STATUSES = ['lista_espera']
const EM_ANALISE_STATUSES = ['em_analise']
const APROVADA_STATUSES = ['aprovada', 'aguardando_pagamento']
const MATRICULADO_STATUSES = ['matriculado', 'convertida']
const RASCUNHO_STATUSES = ['rascunho']
const REJEITADA_STATUSES = ['rejeitada', 'arquivado']

const STATUS_MAP: Record<string, Status> = {
  submetida: 'submetida',
  pre_candidatura: 'pre_candidatura',
  pendente: 'submetida',
  documentos_reenviados: 'documentos_reenviados',
  lista_espera: 'lista_espera',
  em_analise: 'em_analise',
  aprovada: 'aprovada',
  aguardando_pagamento: 'aguardando_pagamento',
  aguardando_compensacao: 'aguardando_compensacao',
  matriculado: 'matriculado',
  convertida: 'matriculado',
}

function statusOr(statuses: string[]) {
  return statuses.map((status) => `status.ilike.${status}`).join(',')
}

function escapeIlike(value: string) {
  return value.replace(/[%_]/g, (match) => `\\${match}`)
}

function statusesForFilter(filter: string | undefined) {
  if (filter === 'novas') return SUBMETIDA_STATUSES
  if (filter === 'pre_candidaturas') return PRE_CANDIDATURA_STATUSES
  if (filter === 'lista_espera') return LISTA_ESPERA_STATUSES
  if (filter === 'pendentes') return [...RASCUNHO_STATUSES, ...EM_ANALISE_STATUSES, ...APROVADA_STATUSES]
  if (filter === 'concluidas') return [...MATRICULADO_STATUSES, ...REJEITADA_STATUSES]
  if (filter === 'expirando') return ['aguardando_pagamento']
  if (filter === 'reenviados') return ['documentos_reenviados']
  return [
    ...RASCUNHO_STATUSES,
    ...PRE_CANDIDATURA_STATUSES,
    ...SUBMETIDA_STATUSES,
    ...LISTA_ESPERA_STATUSES,
    ...EM_ANALISE_STATUSES,
    ...APROVADA_STATUSES,
    ...MATRICULADO_STATUSES,
    ...REJEITADA_STATUSES,
  ]
}

function normalizeStatus(status: string | null | undefined): Status {
  const normalized = (status ?? '').toLowerCase()
  return STATUS_MAP[normalized] ?? (normalized as Status)
}

function sevenDaysAgoIso() {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString()
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const parsed = searchParamsSchema.safeParse(Object.fromEntries(searchParams))

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 })
  }

  const { escolaId, turmaId } = parsed.data
  const supabase = await createClient()

  const { error: authError } = await requireRoleInSchool({
    supabase,
    escolaId,
    roles: ['secretaria', 'secretaria_financeiro', 'admin_financeiro', 'admin', 'admin_escola', 'staff_admin'],
  })
  if (authError) return authError

  const sinceIso = sevenDaysAgoIso()
  const limit = Math.min(Math.max(Number(parsed.data.limit || 30), 1), 50)
  const cursorOpen = parsed.data.cursor_open ?? null
  const cursorMat = parsed.data.cursor_mat ?? null
  const cursor = parsed.data.cursor ?? null
  const q = parsed.data.q?.trim() ?? ''
  const statusFilter = parsed.data.status

  try {
    // 1) Counts (canônico por status)
    const countsQuery = supabase
      .from('vw_admissoes_counts_por_status')
      .select('submetida_total, em_analise_total, aprovada_total, matriculado_7d_total, expirando_24h_total, reenviados_48h_total')
      .eq('escola_id', escolaId)

    if (turmaId) {
      // If filtering by turma, we should ideally filter counts too, 
      // but the view is per school. For now, we'll return school-wide counts 
      // or we could add a new view/query for counts per turma if needed.
    }

    const { data: countsRow, error: countsError } = await countsQuery.maybeSingle()
    if (countsError) throw countsError

    let preCandidaturaCountQuery = supabase
      .from('candidaturas')
      .select('id', { count: 'exact', head: true })
      .eq('escola_id', escolaId)
      .or(statusOr(PRE_CANDIDATURA_STATUSES))

    if (turmaId) preCandidaturaCountQuery = preCandidaturaCountQuery.eq('turma_preferencial_id', turmaId)

    const { count: preCandidaturaTotal, error: preCandidaturaCountError } = await preCandidaturaCountQuery
    if (preCandidaturaCountError) throw preCandidaturaCountError

    // 1.1) Oportunidades de Lista de Espera
    const { data: opps, error: oppsError } = await supabase
      .from('view_admissao_oportunidades_lista_espera' as any)
      .select('vagas_disponiveis, total_na_espera')
      .eq('escola_id', escolaId) as { data: Array<{ vagas_disponiveis: number, total_na_espera: number }> | null, error: any }
    if (oppsError) throw oppsError
    
    const waitlistOpportunities = (opps || []).reduce((acc, curr) => acc + Math.min(curr.vagas_disponiveis || 0, curr.total_na_espera || 0), 0)

    // 2) Items para o Kanban (separado para evitar problemas com .or e datas ISO)
    const baseSelect = `
      id,
      protocolo_publico,
      escola_id,
      status,
      created_at,
      updated_at,
      matriculado_em,
      expires_at,
      portal_reenvio_at,
      nome_candidato,
      curso_id,
      classe_id,
      turma_preferencial_id,
      turno,
      dados_candidato,
      cursos(nome),
      classes(nome)
    `

    if (q || statusFilter) {
      const statuses = statusesForFilter(statusFilter)
      let query = supabase
        .from('candidaturas')
        .select(baseSelect)
        .eq('escola_id', escolaId)
        .or(statusOr(statuses))
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })

      if (turmaId) query = query.eq('turma_preferencial_id', turmaId)

      if (statusFilter === 'expirando') {
        query = query
          .gt('expires_at', new Date().toISOString())
          .lte('expires_at', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
      } else if (statusFilter === 'reenviados') {
        query = query.gte('portal_reenvio_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      }

      if (q) {
        const normalizedQ = escapeIlike(q)
        query = query.or(
          [
            `nome_candidato.ilike.%${normalizedQ}%`,
            `protocolo_publico.ilike.${normalizedQ.toUpperCase()}%`,
            `id.ilike.${normalizedQ.toLowerCase()}%`,
          ].join(',')
        )
      }

      if (cursor) {
        const [cursorCreatedAt, cursorId] = cursor.split(',')
        if (cursorCreatedAt && cursorId) {
          query = query.or(
            `created_at.lt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`
          )
        }
      }

      const { data: filteredData, error: filteredError } = await query.limit(limit)
      if (filteredError) throw filteredError

      const items = (filteredData ?? []).map((item) => ({
        ...item,
        status_raw: item.status,
        status: normalizeStatus(item.status),
      }))
      const lastFiltered = filteredData?.[Math.max((filteredData?.length ?? 1) - 1, 0)]

      return NextResponse.json(
        {
          ok: true,
          counts: {
            submetida: countsRow?.submetida_total ?? 0,
            pre_candidatura: preCandidaturaTotal ?? 0,
            lista_espera: 0,
            em_analise: countsRow?.em_analise_total ?? 0,
            aprovada: countsRow?.aprovada_total ?? 0,
            matriculado: countsRow?.matriculado_7d_total ?? 0,
            expirando: countsRow?.expirando_24h_total ?? 0,
            reenviados: countsRow?.reenviados_48h_total ?? 0,
          },
          items,
          meta: { matriculados_since: sinceIso, q: q || null, status: statusFilter ?? null },
          next_cursor: filteredData && filteredData.length === limit && lastFiltered
            ? `${lastFiltered.created_at},${lastFiltered.id}`
            : null,
          next_cursor_open: null,
          next_cursor_mat: null,
        },
        { status: 200 }
      )
    }

    const [openRes, matRes] = await Promise.all([
      (() => {
        let query = supabase
          .from('candidaturas')
          .select(baseSelect)
          .eq('escola_id', escolaId)
          .or(statusOr([...PRE_CANDIDATURA_STATUSES, ...SUBMETIDA_STATUSES, ...LISTA_ESPERA_STATUSES, ...EM_ANALISE_STATUSES, ...APROVADA_STATUSES]))
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })

        if (turmaId) query = query.eq('turma_preferencial_id', turmaId)

        if (cursorOpen) {
          const [cursorCreatedAt, cursorId] = cursorOpen.split(',')
          if (cursorCreatedAt && cursorId) {
            query = query.or(
              `created_at.lt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`
            )
          }
        }

        return query.limit(limit)
      })(),
      (() => {
        let query = supabase
          .from('candidaturas')
          .select(baseSelect)
          .eq('escola_id', escolaId)
          .or(statusOr(MATRICULADO_STATUSES))
          .gte('matriculado_em', sinceIso)
          .order('matriculado_em', { ascending: false })
          .order('id', { ascending: false })

        if (turmaId) query = query.eq('turma_preferencial_id', turmaId)

        if (cursorMat) {
          const [cursorCreatedAt, cursorId] = cursorMat.split(',')
          if (cursorCreatedAt && cursorId) {
            query = query.or(
              `matriculado_em.lt.${cursorCreatedAt},and(matriculado_em.eq.${cursorCreatedAt},id.lt.${cursorId})`
            )
          }
        }

        return query.limit(limit)
      })(),
    ])

    if (openRes.error) throw openRes.error
    if (matRes.error) throw matRes.error

    // Merge e sort
    const items = [...(matRes.data ?? []), ...(openRes.data ?? [])]
      .map((item) => ({
        ...item,
        status_raw: item.status,
        status: normalizeStatus(item.status),
      }))
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
      .slice(0, limit * 2)

    const counts: Record<string, number> = {
      submetida: countsRow?.submetida_total ?? 0,
      pre_candidatura: preCandidaturaTotal ?? 0,
      lista_espera: 0,
      em_analise: countsRow?.em_analise_total ?? 0,
      aprovada: countsRow?.aprovada_total ?? 0,
      aguardando_pagamento: 0,
      aguardando_compensacao: 0,
      matriculado: countsRow?.matriculado_7d_total ?? 0,
      expirando: countsRow?.expirando_24h_total ?? 0,
      reenviados: countsRow?.reenviados_48h_total ?? 0,
      oportunidades_espera: waitlistOpportunities,
    }

    const lastOpen = (openRes.data ?? [])[Math.max((openRes.data?.length ?? 1) - 1, 0)]
    const lastMat = (matRes.data ?? [])[Math.max((matRes.data?.length ?? 1) - 1, 0)]

    return NextResponse.json(
      {
        ok: true,
        counts,
        items,
        meta: { matriculados_since: sinceIso },
        next_cursor_open: openRes.data && openRes.data.length === limit && lastOpen
          ? `${lastOpen.created_at},${lastOpen.id}`
          : null,
        next_cursor_mat: matRes.data && matRes.data.length === limit && lastMat
          ? `${lastMat.matriculado_em},${lastMat.id}`
          : null,
      },
      { status: 200 }
    )
  } catch (e: unknown) {
    console.error('radar error:', e)
    return NextResponse.json(
      { error: 'Internal Server Error', code: typeof e === 'object' && e && 'code' in e ? String(e.code ?? '') : null },
      { status: 500 }
    )
  }
}
