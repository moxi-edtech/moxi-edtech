import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAlunoContext } from '@/lib/alunoContext'
import type { DBWithRPC } from '@/types/supabase-augment'
import { resolveAnoLetivoScope } from '@/lib/financeiro/resolveAnoLetivoScope'
import { resolveOpenRematriculaWindow } from '@/lib/secretaria/rematricula-window'
import { resolveRematriculaSource } from '@/lib/alunoRematriculaSource'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'

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
  if (message.includes('ACADEMICO:')) {
    return NextResponse.json({ ok: false, error: 'A situação académica ainda não autoriza a rematrícula.' }, { status: 409 })
  }
  return NextResponse.json({ ok: false, error: 'Erro ao processar rematrícula' }, { status: 500 })
}

export async function POST() {
  try {
    const { supabase, ctx } = await getAlunoContext()
    if (!ctx?.escolaId || !ctx.alunoId) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    }

    const escolaId = await resolveEscolaIdForUser(supabase, ctx.userId, ctx.escolaId)
    if (!escolaId || escolaId !== ctx.escolaId) {
      return NextResponse.json({ ok: false, error: 'Sem acesso à escola do aluno.' }, { status: 403 })
    }

    const activeAno = await resolveAnoLetivoScope(supabase, escolaId)
    if (!activeAno) {
      return NextResponse.json({ ok: false, error: 'A escola ainda não configurou um ano letivo ativo.', code: 'ACTIVE_ACADEMIC_YEAR_UNAVAILABLE' }, { status: 409 })
    }
    const openWindow = await resolveOpenRematriculaWindow(supabase, escolaId, activeAno.ano)
    if (!openWindow) {
      return NextResponse.json({ ok: false, error: 'A janela de rematrícula ainda não está aberta.', code: 'REMATRICULA_WINDOW_CLOSED' }, { status: 409 })
    }
    const { data: source, error: sourceError } = await resolveRematriculaSource(supabase, escolaId, ctx.alunoId, openWindow.ano_letivo)
    if (sourceError || !source?.id) {
      return NextResponse.json({ ok: false, error: 'Não foi encontrada uma matrícula histórica elegível.', code: 'REMATRICULA_SOURCE_INVALID' }, { status: 409 })
    }

    const rpcClient = supabase as unknown as SupabaseClient<DBWithRPC>
    const { data, error } = await rpcClient.rpc('aluno_confirmar_rematricula', {
      p_matricula_id: source.id,
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
