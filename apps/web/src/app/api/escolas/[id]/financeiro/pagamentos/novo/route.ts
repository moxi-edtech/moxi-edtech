import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabaseServer'
import { recordAuditServer } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'

const BodySchema = z.object({
  valor: z.number().positive(),
  metodo: z.string().trim().min(1),
  referencia: z.string().trim().nullable().optional(),
  status: z.enum(['pago','pendente']).default('pendente')
})

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await context.params
  try {
    const idempotencyKey =
      req.headers.get('Idempotency-Key') ?? req.headers.get('idempotency-key')
    if (!idempotencyKey) {
      return NextResponse.json({ ok: false, error: 'Idempotency-Key header é obrigatório' }, { status: 400 })
    }

    const json = await req.json().catch(() => null)
    const parse = BodySchema.safeParse(json)
    if (!parse.success) {
      const msg = parse.error.issues?.[0]?.message || 'Dados inválidos'
      return NextResponse.json({ ok: false, error: msg }, { status: 400 })
    }
    const body = parse.data

    // AuthN
    const s = await supabaseServer()
    const { data: sess } = await s.auth.getUser()
    const user = sess?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const resolvedEscolaId = await resolveEscolaIdForUser(s, user.id, escolaId)
    if (!resolvedEscolaId || resolvedEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    }

    // AuthZ via papel -> permission mapping
    const { data: vinc } = await s
      .from('escola_users')
      .select('papel')
      .eq('escola_id', escolaId)
      .eq('user_id', user.id)
      .limit(1)
    const papel = (vinc?.[0] as { papel?: string | null })?.papel ?? null
    if (!hasPermission(papel, 'registrar_pagamento')) {
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    }

    // Hard check: user profile must belong to this escola
    const { data: profCheck } = await s.from('profiles').select('escola_id').eq('user_id', user.id).maybeSingle()
    if (!profCheck || profCheck.escola_id !== escolaId) {
      return NextResponse.json({ ok: false, error: 'Perfil não vinculado à escola' }, { status: 403 })
    }

    // Status gate: bloqueia suspensa/excluida
    const { data: esc } = await s.from('escolas').select('status').eq('id', escolaId).limit(1)
    const status = (esc?.[0] as { status?: string | null })?.status ?? undefined
    if (status === 'excluida') return NextResponse.json({ ok: false, error: 'Escola excluída não permite lançamentos financeiros.' }, { status: 400 })
    if (status === 'suspensa') return NextResponse.json({ ok: false, error: 'Escola suspensa por pagamento. Regularize para registrar pagamentos.' }, { status: 400 })

    const { data: existingPagamento } = await s
      .from('pagamentos')
      .select('id, escola_id, valor_pago, metodo, referencia, status, created_at, meta')
      .eq('escola_id', escolaId)
      .contains('meta', { idempotency_key: idempotencyKey })
      .maybeSingle()
    if (existingPagamento) {
      return NextResponse.json({ ok: true, pagamento: existingPagamento, idempotent: true })
    }

    // Insert pagamento
    const { data: row, error } = await s
      .from('pagamentos')
      .insert({
        escola_id: escolaId,
        valor_pago: body.valor,
        metodo: body.metodo,
        referencia: body.referencia ?? null,
        status: body.status,
        meta: { idempotency_key: idempotencyKey },
      })
      .select('id, escola_id, valor_pago, metodo, referencia, status, created_at')
      .single()

    if (error || !row) return NextResponse.json({ ok: false, error: error?.message || 'Falha ao registrar pagamento' }, { status: 400 })

    recordAuditServer({ escolaId, portal: 'financeiro', acao: 'PAGAMENTO_REGISTRADO', entity: 'pagamento', entityId: String(row.id), details: { valor: row.valor_pago, metodo: row.metodo, status: row.status } }).catch(() => null)

    return NextResponse.json({ ok: true, pagamento: row })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
