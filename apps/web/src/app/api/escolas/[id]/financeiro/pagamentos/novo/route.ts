import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database } from '~types/supabase'
import { recordAuditServer } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'

const BodySchema = z.object({
  valor: z.number().positive(),
  metodo: z.string().trim().min(1),
  referencia: z.string().trim().nullable().optional(),
  status: z.enum(['pago','pendente']).default('pendente')
})

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await context.params
  try {
    const json = await req.json().catch(() => null)
    const parse = BodySchema.safeParse(json)
    if (!parse.success) {
      const msg = parse.error.errors[0]?.message || 'Dados inválidos'
      return NextResponse.json({ ok: false, error: msg }, { status: 400 })
    }
    const body = parse.data

    // AuthN
    const s = await supabaseServer()
    const { data: sess } = await s.auth.getUser()
    const user = sess?.user
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    // AuthZ via papel -> permission mapping
    const { data: vinc } = await s
      .from('escola_usuarios')
      .select('papel')
      .eq('escola_id', escolaId)
      .eq('user_id', user.id)
      .limit(1)
    const papel = (vinc?.[0] as any)?.papel as any
    if (!hasPermission(papel, 'registrar_pagamento')) {
      return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Configuração do Supabase ausente' }, { status: 500 })
    }
    const admin = createAdminClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any

    // Status gate: bloqueia suspensa/excluida
    const { data: esc } = await admin.from('escolas').select('status').eq('id', escolaId).limit(1)
    const status = (esc?.[0] as any)?.status as string | undefined
    if (status === 'excluida') return NextResponse.json({ ok: false, error: 'Escola excluída não permite lançamentos financeiros.' }, { status: 400 })
    if (status === 'suspensa') return NextResponse.json({ ok: false, error: 'Escola suspensa por pagamento. Regularize para registrar pagamentos.' }, { status: 400 })

    // Insert pagamento
    const { data: row, error } = await admin
      .from('pagamentos')
      .insert({
        escola_id: escolaId,
        valor: body.valor as any,
        metodo: body.metodo,
        referencia: body.referencia ?? null,
        status: body.status,
      })
      .select('id, escola_id, valor, metodo, referencia, status, created_at')
      .single()

    if (error || !row) return NextResponse.json({ ok: false, error: error?.message || 'Falha ao registrar pagamento' }, { status: 400 })

    recordAuditServer({ escolaId, portal: 'financeiro', action: 'PAGAMENTO_REGISTRADO', entity: 'pagamento', entityId: String(row.id), details: { valor: row.valor, metodo: row.metodo, status: row.status } }).catch(() => null)

    return NextResponse.json({ ok: true, pagamento: row })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
