// apps/web/src/app/api/financeiro/mensalidades/gerar/route.ts

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServerTyped } from '@/lib/supabaseServer'
import { resolveEscolaIdForUser } from '@/lib/escola/disciplinas'
import type { Database } from '~types/supabase'

const BodySchema = z.object({
  ano_letivo: z.number().min(2020).max(2050),
  mes_referencia: z.number().min(1).max(12),
  dia_vencimento: z.number().min(1).max(31).optional(),
})

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id)
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: 'Escola não identificada' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const parsed = BodySchema.safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json({ 
        ok: false, 
        error: parsed.error.issues[0]?.message || 'Dados inválidos' 
      }, { status: 400 })
    }

    const { ano_letivo, mes_referencia, dia_vencimento } = parsed.data

    // Chama a RPC Blindada (com Escudo Financeiro)
    const { data, error } = await supabase.rpc('gerar_mensalidades_lote', {
      p_escola_id: escolaId,
      p_ano_letivo: ano_letivo,
      p_mes_referencia: mes_referencia,
      p_dia_vencimento_default: dia_vencimento || 10
    })

    if (error) {
      console.error('Erro RPC:', error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      ok: true, 
      stats: data // Retorna { geradas: N }
    })

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}