import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAlunoContext } from '@/lib/alunoContext'
import type { DBWithRPC } from '@/types/supabase-augment'

export const dynamic = 'force-dynamic'

const errorResponse = (message: string) => {
  if (message.includes('FINANCEIRO:')) {
    return NextResponse.json({ ok: false, error: 'Possui pendências financeiras.' }, { status: 403 })
  }
  if (message.includes('CONFLICT:')) {
    return NextResponse.json({ ok: false, error: 'A rematrícula já foi efetivada.' }, { status: 409 })
  }
  if (message.includes('DATA:')) {
    return NextResponse.json({ ok: false, error: message.replace('DATA: ', '') }, { status: 400 })
  }
  if (message.includes('AUTH:')) {
    return NextResponse.json({ ok: false, error: 'Sem permissão para solicitar rematrícula.' }, { status: 403 })
  }
  return NextResponse.json({ ok: false, error: 'Erro ao processar rematrícula' }, { status: 500 })
}

export async function POST() {
  try {
    const { supabase, ctx } = await getAlunoContext()
    if (!ctx?.matriculaId) {
      return NextResponse.json({ ok: false, error: 'Não autenticado ou sem matrícula' }, { status: 401 })
    }

    const rpcClient = supabase as unknown as SupabaseClient<DBWithRPC>
    const { data, error } = await rpcClient.rpc('aluno_confirmar_rematricula', {
      p_matricula_id: ctx.matriculaId,
    })

    if (error) {
      console.error('Confirm Rematricula RPC Error:', error)
      return errorResponse(error.message)
    }

    const result = data?.[0]
    if (!result) {
      return NextResponse.json({ ok: false, error: 'Resposta inválida ao processar rematrícula' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      candidaturaId: result.candidatura_id,
      nextAno: result.next_ano,
      reused: result.reused,
      message: result.reused
        ? 'O seu pedido de rematrícula já estava registado.'
        : 'Rematrícula solicitada com sucesso!',
    })
  } catch (err: unknown) {
    console.error('Confirm Rematricula Error:', err)
    return errorResponse(err instanceof Error ? err.message : '')
  }
}
