// apps/web/src/app/api/secretaria/admissoes/radar/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRoleInSchool } from '@/lib/authz'

export const dynamic = "force-dynamic"

const searchParamsSchema = z
  .object({
    escolaId: z.string().uuid(),
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

  try {
    // 1) Counts (canônico por status)
    const [cSub, cAna, cApr, cMat] = await Promise.all([
      supabase
        .from('candidaturas')
        .select('id', { count: 'exact', head: true })
        .eq('escola_id', escolaId)
        .or(statusOr(SUBMETIDA_STATUSES)),
      supabase
        .from('candidaturas')
        .select('id', { count: 'exact', head: true })
        .eq('escola_id', escolaId)
        .or(statusOr(EM_ANALISE_STATUSES)),
      supabase
        .from('candidaturas')
        .select('id', { count: 'exact', head: true })
        .eq('escola_id', escolaId)
        .or(statusOr(APROVADA_STATUSES)),
      // “Matriculados (7 dias)” — ideal: matriculado_em.
      supabase
        .from('candidaturas')
        .select('id', { count: 'exact', head: true })
        .eq('escola_id', escolaId)
        .or(statusOr(MATRICULADO_STATUSES))
        .gte('matriculado_em', sinceIso),
    ])

    for (const r of [cSub, cAna, cApr, cMat]) {
      if (r.error) throw r.error
    }

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
      // Candidaturas abertas (submetida, em_analise, aprovada)
      supabase
        .from('candidaturas')
        .select(baseSelect)
        .eq('escola_id', escolaId)
        .or(statusOr([...SUBMETIDA_STATUSES, ...EM_ANALISE_STATUSES, ...APROVADA_STATUSES]))
        .order('created_at', { ascending: false })
        .limit(200),

      // Matriculados recentes
      supabase
        .from('candidaturas')
        .select(baseSelect)
        .eq('escola_id', escolaId)
        .or(statusOr(MATRICULADO_STATUSES))
        .gte('matriculado_em', sinceIso)
        .order('created_at', { ascending: false })
        .limit(200),
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
      .slice(0, 200)

    const counts: Record<Status, number> = {
      submetida: cSub.count ?? 0,
      em_analise: cAna.count ?? 0,
      aprovada: cApr.count ?? 0,
      matriculado: cMat.count ?? 0,
    }

    return NextResponse.json(
      {
        ok: true,
        counts,
        items,
        meta: { matriculados_since: sinceIso },
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
