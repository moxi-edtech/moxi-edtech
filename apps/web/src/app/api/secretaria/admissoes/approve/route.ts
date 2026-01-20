import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRoleInSchool } from '@/lib/authz'

const payloadSchema = z.object({
  candidatura_id: z.string().uuid(),
  observacao: z.string().trim().min(3).max(500).optional(),
  metodo_pagamento: z.enum(['TPA', 'CASH', 'TRANSFERENCIA']).optional(),
  comprovativo_url: z.string().url().optional(),
  amount: z.number().positive().optional(),
  referencia: z.string().trim().optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()

  const body = await request.json().catch(() => null)
  const parsed = payloadSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 })
  }

  const { candidatura_id, observacao, metodo_pagamento, comprovativo_url, amount, referencia } = parsed.data

  try {
    const { data: head, error: headErr } = await supabase
      .from('candidaturas')
      .select('id, escola_id, status, dados_candidato')
      .eq('id', candidatura_id)
      .single()

    if (headErr || !head) {
      return NextResponse.json({ error: 'Candidatura not found' }, { status: 404 })
    }

    const { error: authError } = await requireRoleInSchool({
      supabase,
      escolaId: head.escola_id,
      roles: ['secretaria', 'admin', 'admin_escola', 'staff_admin'],
    })
    if (authError) return authError

    if (head.status === 'rascunho' && (metodo_pagamento || comprovativo_url || amount || referencia)) {
      const current = (head as any)?.dados_candidato ?? {}
      const currentPagamento = (current as any)?.pagamento ?? {}
      const pagamento = {
        ...currentPagamento,
        ...(metodo_pagamento ? { metodo: metodo_pagamento } : {}),
        ...(comprovativo_url ? { comprovativo_url } : {}),
        ...(amount ? { amount } : {}),
        ...(referencia ? { referencia } : {}),
      }
      const merged = {
        ...current,
        pagamento,
      }

      const { error: updateErr } = await supabase
        .from('candidaturas')
        .update({ dados_candidato: merged })
        .eq('id', candidatura_id)
        .eq('escola_id', head.escola_id)

      if (updateErr) throw updateErr
    }

    if (head.status === 'rascunho') {
      const { error: submitErr } = await supabase.rpc('admissao_submit', {
        p_escola_id: head.escola_id,
        p_candidatura_id: candidatura_id,
        p_source: 'walkin',
      })
      if (submitErr) throw submitErr
    }

    const { error } = await supabase.rpc('admissao_approve', {
      p_escola_id: head.escola_id,
      p_candidatura_id: candidatura_id,
      p_observacao: observacao ?? null,
    })

    if (error) throw error

    const { data: updated } = await supabase
      .from('candidaturas')
      .select('id, status, dados_candidato')
      .eq('id', candidatura_id)
      .eq('escola_id', head.escola_id)
      .maybeSingle()

    if (updated?.status === 'aguardando_pagamento') {
      const pagamento = (updated as any)?.dados_candidato?.pagamento || {}
      const metodo = pagamento?.metodo || 'não informado'
      const referencia = pagamento?.referencia || null
      const mensagemParts = [
        `Método: ${metodo}`,
        referencia ? `Ref: ${referencia}` : null,
      ].filter(Boolean)
      const mensagem = mensagemParts.join(' | ')

      try {
        await supabase.from('notifications').insert({
          escola_id: head.escola_id,
          target_role: 'financeiro' as any,
          tipo: 'candidatura_pagamento',
          titulo: 'Pagamento aguardando compensação',
          mensagem: mensagem || null,
          link_acao: `/financeiro/candidaturas?candidatura=${candidatura_id}`,
        })
      } catch {}
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('admissao approve error:', error)
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
