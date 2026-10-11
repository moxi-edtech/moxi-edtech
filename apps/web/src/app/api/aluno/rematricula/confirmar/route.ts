import { NextResponse } from 'next/server'
import { getAlunoContext } from '@/lib/alunoContext'
import { resolveAnoLetivoScope } from '@/lib/financeiro/resolveAnoLetivoScope'
import { resolveOpenRematriculaWindow } from '@/lib/secretaria/rematricula-window'
import { resolveRematriculaSource } from '@/lib/alunoRematriculaSource'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'

export const dynamic = 'force-dynamic'

const errorResponse = (message: string) => {
  if (message.includes('REMATRICULA_DEBT_REQUIRED') || message.includes('FINANCEIRO:')) {
    return NextResponse.json({ ok: false, error: 'Existem mensalidades vencidas por regularizar.', code: 'REMATRICULA_DEBT_REQUIRED' }, { status: 409 })
  }
  if (message.includes('REMATRICULA_ACADEMIC_BLOCKED') || message.includes('ACADEMICO:')) {
    return NextResponse.json({ ok: false, error: 'A situação académica ainda não autoriza esta rematrícula.', code: 'REMATRICULA_ACADEMIC_BLOCKED' }, { status: 409 })
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

    // Compatibilidade mobile/legacy: esta rota não mantém contrato próprio.
    // Ela delega no mesmo RPC canónico usado pelo fluxo atual do Portal.
    const { data, error } = await (supabase as any).rpc('aluno_iniciar_rematricula', {
      p_matricula_id: source.id,
      p_servicos_ids: [],
    })

    if (error) {
      console.error('Confirm Rematricula RPC Error:', error)
      return errorResponse(error.message)
    }

    if (!data?.ok || !data?.candidatura_id) {
      return NextResponse.json({ ok: false, error: 'Resposta inválida ao processar rematrícula' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      candidaturaId: data.candidatura_id,
      nextAno: data.next_ano,
      paymentIntentId: data.pagamento_intent_id ?? null,
      message: 'Rematrícula iniciada com sucesso.',
    })
  } catch (err: unknown) {
    console.error('Confirm Rematricula Error:', err)
    return errorResponse(err instanceof Error ? err.message : '')
  }
}
