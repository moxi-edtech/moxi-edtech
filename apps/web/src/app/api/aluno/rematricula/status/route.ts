import { NextResponse } from 'next/server'
import { getAlunoContext } from '@/lib/alunoContext'
import { resolveAnoLetivoScope } from '@/lib/financeiro/resolveAnoLetivoScope'
import { resolveOpenRematriculaWindow } from '@/lib/secretaria/rematricula-window'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { supabase, ctx } = await getAlunoContext()
    if (!ctx || !ctx.alunoId || !ctx.escolaId) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    }

    const { escolaId, alunoId } = ctx
    const currentAno = ctx.anoLetivo

    if (!ctx.matriculaId || !currentAno) {
      return NextResponse.json({ ok: true, eligible: false, code: 'ACADEMIC_PROMOTION_PENDING', reason: 'A escola ainda está a concluir a sua situação académica.' })
    }

    const activeAno = await resolveAnoLetivoScope(supabase, escolaId)
    if (!activeAno) {
      return NextResponse.json({ ok: true, eligible: false, code: 'ACTIVE_ACADEMIC_YEAR_UNAVAILABLE', reason: 'A escola ainda não configurou um ano letivo ativo.' })
    }

    const openWindow = await resolveOpenRematriculaWindow(supabase, escolaId, currentAno)

    if (!openWindow) {
      const { data: nextWindow } = await (supabase as any)
        .from('rematricula_janelas')
        .select('ano_letivo, data_inicio, data_fim')
        .eq('escola_id', escolaId)
        .eq('ativa', true)
        .gte('ano_letivo', currentAno)
        .order('ano_letivo', { ascending: true })
        .order('data_inicio', { ascending: true })
        .limit(1)
        .maybeSingle()
      return NextResponse.json({
        ok: true,
        eligible: false,
        code: 'REMATRICULA_WINDOW_CLOSED',
        reason: 'A janela de rematrícula ainda não está aberta.',
        nextWindow: nextWindow ? { ano: Number(nextWindow.ano_letivo), data_inicio: nextWindow.data_inicio, data_fim: nextWindow.data_fim } : null,
      })
    }

    const nextAno = Number(openWindow.ano_letivo)

    const { data: sourceMatricula, error: sourceMatriculaError } = await (supabase as any)
      .from('matriculas')
      .select('id, ano_letivo, turma_id')
      .eq('escola_id', escolaId)
      .eq('aluno_id', alunoId)
      .lt('ano_letivo', nextAno)
      .in('status', ['ativo', 'ativa', 'active', 'transferido'])
      .order('ano_letivo', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (sourceMatriculaError) throw new Error('Falha ao verificar matrícula de origem')
    if (!sourceMatricula?.id) {
      return NextResponse.json({ ok: true, eligible: false, code: 'ACADEMIC_PROMOTION_PENDING', reason: 'A escola ainda está a concluir a sua situação académica.' })
    }

    // Uma matrícula do ano destino pode ter sido criada pela virada/promoção
    // em lote. Ela não representa, por si só, uma rematrícula paga pelo portal.
    const { data: existingCandidaturas, error: candidaturaError } = await supabase
      .from('candidaturas')
      .select('id, status')
      .eq('escola_id', escolaId)
      .eq('aluno_id', alunoId)
      .eq('ano_letivo', nextAno)
      .eq('source', 'PORTAL_ALUNO_REMATRICULA')
      .not('status', 'eq', 'rejeitada')
      .order('created_at', { ascending: false })
      .limit(1)

    if (candidaturaError) throw new Error('Falha ao verificar rematrícula existente')
    const existingCandidatura = existingCandidaturas?.[0] ?? null

    const [{ data: servicosRows, error: servicosError }, { data: escolaRow }] = await Promise.all([
      (supabase as any)
        .from('servicos_escola')
        .select('id, codigo, nome, descricao, valor_base, ativo')
        .eq('escola_id', escolaId)
        .eq('ativo', true)
        .gt('valor_base', 0)
        .order('nome', { ascending: true }),
      (supabase as any).from('escolas').select('dados_pagamento').eq('id', escolaId).maybeSingle(),
    ])
    if (servicosError) throw new Error(`Falha ao carregar serviços de rematrícula: ${servicosError.message}`)

    const rematriculaService = (servicosRows ?? []).find((service: { codigo?: string }) => service.codigo === 'SERV_REMATRICULA') ?? null
    const availableServices = (servicosRows ?? [])
      .filter((service: { codigo?: string }) => service.codigo !== 'SERV_REMATRICULA')
      .map((service: { id: string; codigo: string; nome: string; descricao?: string | null; valor_base: number }) => ({
        id: service.id,
        codigo: service.codigo,
        nome: service.nome,
        descricao: service.descricao,
        valor: Number(service.valor_base ?? 0),
      }))
    const rawPaymentData = escolaRow?.dados_pagamento && typeof escolaRow.dados_pagamento === 'object' ? escolaRow.dados_pagamento as Record<string, unknown> : {}
    const dadosPagamento = {
      iban: typeof rawPaymentData.iban === 'string' ? rawPaymentData.iban : undefined,
      banco: typeof rawPaymentData.banco === 'string' ? rawPaymentData.banco : undefined,
      titular: typeof rawPaymentData.titular === 'string' ? rawPaymentData.titular : typeof rawPaymentData.titular_conta === 'string' ? rawPaymentData.titular_conta : undefined,
      kwik_chave: typeof rawPaymentData.kwik_chave === 'string' ? rawPaymentData.kwik_chave : undefined,
    }

    const { data: rematriculaPedidos, error: pedidoError } = await (supabase as any)
      .from('servico_pedidos')
      .select('id, status, valor_cobrado, contexto, created_at')
      .eq('escola_id', escolaId)
      .eq('aluno_id', alunoId)
      .eq('servico_codigo', 'SERV_REMATRICULA')
      .in('status', ['pending_payment', 'granted'])
      .order('created_at', { ascending: false })
      .limit(20)
    if (pedidoError) throw new Error(`Falha ao verificar pagamento de rematrícula: ${pedidoError.message}`)
    const rematriculaPedido = (rematriculaPedidos ?? []).find((pedido: { contexto?: Record<string, unknown> | null }) => {
      const contexto = pedido.contexto ?? {}
      return contexto.origem === 'portal_rematricula'
        || (existingCandidatura?.id && contexto.candidatura_id === existingCandidatura.id)
    }) ?? null
    let paymentIntent: Record<string, unknown> | null = null
    if (rematriculaPedido?.id) {
      const { data: intent, error: intentError } = await (supabase as any)
        .from('pagamento_intents')
        .select('id, status, amount, reference, evidence_url, meta')
        .eq('servico_pedido_id', rematriculaPedido.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (intentError) throw new Error(`Falha ao consultar transação de rematrícula: ${intentError.message}`)
      if (intent) {
        const { data: receipt, error: receiptError } = await (supabase as any)
          .from('documentos_emitidos')
          .select('id')
          .eq('tipo', 'recibo')
          .eq('aluno_id', alunoId)
          .contains('dados_snapshot', { pagamento_intent_id: intent.id })
          .maybeSingle()
        if (receiptError) throw new Error(`Falha ao consultar recibo financeiro: ${receiptError.message}`)
        paymentIntent = {
          id: intent.id,
          status: intent.status,
          amount: Number(intent.amount ?? 0),
          reference: intent.reference ?? null,
          has_evidence: Boolean(intent.evidence_url),
          receipt_pending: intent.status === 'settled' && !receipt?.id,
          receipt_url: receipt?.id ? `/aluno/documentos/${receipt.id}/recibo/print` : null,
        }
      }
    }
    const rematriculaData = {
      service: rematriculaService ? { id: rematriculaService.id, nome: rematriculaService.nome, valor: Number(rematriculaService.valor_base ?? 0) } : null,
      services: availableServices,
      dadosPagamento,
      paymentIntent,
    }

    if (!rematriculaService) {
      return NextResponse.json({
        ok: true,
        eligible: false,
        code: 'SERVICE_NOT_CONFIGURED',
        reason: 'A taxa de rematrícula ainda não foi configurada pela escola.',
        rematricula: rematriculaData,
      })
    }

    // A matrícula do ano destino é deliberadamente ignorada aqui: a virada
    // pode criá-la antes do pagamento. A candidatura do portal é a evidência
    // de que o aluno já iniciou/concluiu a rematrícula neste canal.
    if (existingCandidatura) {
      return NextResponse.json({ 
        ok: true, 
        eligible: false, 
        alreadyDone: true,
        status: existingCandidatura.status,
        reason: 'O seu pedido de rematrícula já está em análise pela secretaria.',
        rematricula: rematriculaData,
      })
    }

    // 3. Verificação Financeira (Dívidas)
    const { data: mens, error: mensalidadesError } = await supabase
      .from('mensalidades')
      .select('id')
      .eq('escola_id', escolaId)
      .eq('aluno_id', alunoId)
      .in('status', ['pendente', 'atrasado'])
      .limit(1)

    if (mensalidadesError) {
      throw new Error(`Falha ao verificar situação financeira: ${mensalidadesError.message}`)
    }

    const hasDebt = (mens?.length ?? 0) > 0

    return NextResponse.json({
      ok: true,
      eligible: true,
      nextAno,
      hasDebt,
      rematricula: rematriculaData,
      reason: hasDebt 
        ? 'Possui pendências financeiras que impedem a rematrícula automática.' 
        : 'Elegível para rematrícula.'
    })

  } catch (err: any) {
    console.error('Rematricula Status Error:', err)
    return NextResponse.json({ ok: false, error: 'Erro ao verificar elegibilidade' }, { status: 500 })
  }
}
