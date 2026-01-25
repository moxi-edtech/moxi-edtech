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
  })
  .strict()

type Status = 'submetida' | 'em_analise' | 'aprovada' | 'matriculado'

const SUBMETIDA_STATUSES = ['submetida', 'pendente']
const EM_ANALISE_STATUSES = ['em_analise']
const APROVADA_STATUSES = ['aprovada', 'aguardando_pagamento']
const MATRICULADO_STATUSES = ['matriculado', 'convertida']

const STATUS_MAP: Record<string, Status> = {
  submetida: 'submetida',
  pendente: 'submetida',
  em_analise: 'em_analise',
  aprovada: 'aprovada',
  aguardando_pagamento: 'aprovada',
  matriculado: 'matriculado',
  convertida: 'matriculado',
}

function statusOr(statuses: string[]) {
  return statuses.map((status) => `status.ilike.${status}`).join(',')
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

  const { escolaId } = parsed.data
  const supabase = await createClient()

  const { error: authError } = await requireRoleInSchool({
    supabase,
    escolaId,
    roles: ['secretaria', 'admin', 'admin_escola', 'staff_admin'],
  })
  if (authError) return authError

  const sinceIso = sevenDaysAgoIso()
  const limit = Math.min(Math.max(Number(parsed.data.limit || 30), 1), 50)
  const cursorOpen = parsed.data.cursor_open ?? null
  const cursorMat = parsed.data.cursor_mat ?? null

  try {
    // 1) Counts (canônico por status)
    const { data: countsRow, error: countsError } = await supabase
      .from('vw_admissoes_counts_por_status')
      .select('submetida_total, em_analise_total, aprovada_total, matriculado_7d_total')
      .eq('escola_id', escolaId)
      .maybeSingle()

    if (countsError) throw countsError

    // 2) Items para o Kanban (separado para evitar problemas com .or e datas ISO)
    const baseSelect = `
      id,
      escola_id,
      status,
      created_at,
      updated_at,
      matriculado_em,
      nome_candidato,
      cursos(nome),
      classes(nome)
    `

    const [openRes, matRes] = await Promise.all([
      (() => {
        let query = supabase
          .from('candidaturas')
          .select(baseSelect)
          .eq('escola_id', escolaId)
          .or(statusOr([...SUBMETIDA_STATUSES, ...EM_ANALISE_STATUSES, ...APROVADA_STATUSES]))
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })

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

    const counts: Record<Status, number> = {
      submetida: countsRow?.submetida_total ?? 0,
      em_analise: countsRow?.em_analise_total ?? 0,
      aprovada: countsRow?.aprovada_total ?? 0,
      matriculado: countsRow?.matriculado_7d_total ?? 0,
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
  } catch (e: any) {
    console.error('radar error:', e)
    return NextResponse.json(
      { error: 'Internal Server Error', code: e?.code ?? null },
      { status: 500 }
    )
  }
}
