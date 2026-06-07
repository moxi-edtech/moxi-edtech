import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRoleInSchool } from '@/lib/authz'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'

const payloadSchema = z.object({
  candidatura_id: z.string().uuid(),
  motivo: z.string().trim().min(3).max(500),
})

const REJECTABLE_STATUSES = new Set([
  'rascunho',
  'submetida',
  'documentos_reenviados',
  'em_analise',
  'pendente',
  'lista_espera',
])

export async function POST(request: Request) {
  const supabase = await createClient()

  const body = await request.json().catch(() => null)
  const parsed = payloadSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 })
  }

  const { candidatura_id, motivo } = parsed.data

  try {
    const { data: head, error: headErr } = await supabase
      .from('candidaturas')
      .select('id, escola_id, status')
      .eq('id', candidatura_id)
      .single()

    if (headErr || !head) {
      return NextResponse.json({ error: 'Candidatura not found' }, { status: 404 })
    }

    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const resolvedEscolaId = await resolveEscolaIdForUser(supabase, user.id, head.escola_id)
    if (!resolvedEscolaId || resolvedEscolaId !== head.escola_id) {
      return NextResponse.json({ error: 'Sem vínculo com a escola' }, { status: 403 })
    }

    const { error: authError } = await requireRoleInSchool({
      supabase,
      escolaId: head.escola_id,
      roles: ['secretaria', 'admin', 'admin_escola', 'staff_admin'],
    })
    if (authError) return authError

    const currentStatus = String(head.status ?? '').toLowerCase()
    if (!REJECTABLE_STATUSES.has(currentStatus)) {
      return NextResponse.json(
        {
          error: 'Esta candidatura já passou da fase de rejeição pela secretaria.',
          status: currentStatus,
        },
        { status: 409 }
      )
    }

    const { error } = await supabase.rpc('admissao_reject', {
      p_escola_id: head.escola_id,
      p_candidatura_id: candidatura_id,
      p_motivo: motivo,
      p_metadata: {},
    })

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('admissao reject error:', error)
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error?.message ?? null,
        code: error?.code ?? null,
      },
      { status: 500 }
    )
  }
}
