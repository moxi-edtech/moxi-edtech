import { NextResponse } from 'next/server'
import { getAlunoContext } from '@/lib/alunoContext'
import { resolveAnoLetivoScope } from '@/lib/financeiro/resolveAnoLetivoScope'
import { resolveOpenRematriculaWindow } from '@/lib/secretaria/rematricula-window'
import { resolveRematriculaSource } from '@/lib/alunoRematriculaSource'
import { resolveRaaProgressionForMatricula, RaaProgressionUnavailableError } from '@/lib/academico/raa-progression-server'
import { resolveValorConfirmacao } from '@/lib/financeiro/resolve-confirmacao'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'

export const dynamic = 'force-dynamic'

function resolveClassNumber(value: { numero?: number | null; nome?: string | null } | null | undefined) {
  const explicit = Number(value?.numero ?? 0)
  if (Number.isInteger(explicit) && explicit > 0) return explicit
  const match = String(value?.nome ?? '').match(/\d{1,2}/)
  return match ? Number(match[0]) : null
}

export async function GET() {
  try {
    const { supabase, ctx } = await getAlunoContext()
    if (!ctx || !ctx.alunoId || !ctx.escolaId) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    }

    const { alunoId } = ctx
    const escolaId = await resolveEscolaIdForUser(supabase, ctx.userId, ctx.escolaId)
    if (!escolaId || escolaId !== ctx.escolaId) {
      return NextResponse.json({ ok: false, error: 'Sem acesso à escola do aluno.' }, { status: 403 })
    }
    const activeAno = await resolveAnoLetivoScope(supabase, escolaId)
    if (!activeAno) {
      return NextResponse.json({ ok: true, eligible: false, code: 'ACTIVE_ACADEMIC_YEAR_UNAVAILABLE', reason: 'A escola ainda não configurou um ano letivo ativo.' })
    }

    const openWindow = await resolveOpenRematriculaWindow(supabase, escolaId, activeAno.ano)

    if (!openWindow) {
      const { data: nextWindow } = await (supabase as any)
        .from('rematricula_janelas')
        .select('id, ano_letivo, data_inicio, data_fim')
        .eq('escola_id', escolaId)
        .eq('ativa', true)
        .gte('ano_letivo', activeAno.ano)
        .order('ano_letivo', { ascending: true })
        .order('data_inicio', { ascending: true })
        .order('id', { ascending: true })
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

    const { data: sourceMatricula, error: sourceMatriculaError } = await resolveRematriculaSource(
      supabase,
      escolaId,
      alunoId,
      nextAno,
    )
    if (sourceMatriculaError) throw new Error('Falha ao verificar matrícula de origem')
    if (!sourceMatricula?.id) {
      return NextResponse.json({ ok: true, eligible: false, code: 'ACADEMIC_PROMOTION_PENDING', reason: 'A escola ainda está a concluir a sua situação académica.' })
    }

    let academic: Awaited<ReturnType<typeof resolveRaaProgressionForMatricula>> | null = null
    if (sourceMatricula.turma_id) {
      try {
        academic = await resolveRaaProgressionForMatricula(supabase, escolaId, {
          id: sourceMatricula.id,
          aluno_id: sourceMatricula.aluno_id,
          turma_id: sourceMatricula.turma_id,
        })
      } catch (error) {
        if (error instanceof RaaProgressionUnavailableError) {
          return NextResponse.json({
            ok: true,
            eligible: false,
            code: 'ACADEMIC_PROMOTION_PENDING',
            reason: error.message,
            academic: { decision: 'pendente', disciplinaIdsPendentes: [] },
          })
        }
        throw error
      }
    }

    const academicDecision = academic?.progression.decision ?? 'pendente'
    const conditionalEnrollmentBlocked = academicDecision === 'inscricao_condicional'
      && academic?.progression.destino !== 'proxima_etapa'
    if (academicDecision === 'pendente' || academicDecision === 'recurso' || conditionalEnrollmentBlocked) {
      return NextResponse.json({
        ok: true,
        eligible: false,
        code: 'ACADEMIC_PROMOTION_PENDING',
        reason: conditionalEnrollmentBlocked
          ? 'A inscrição condicional ainda não autoriza a matrícula na classe seguinte.'
          : academicDecision === 'recurso'
          ? 'Existem disciplinas em recurso antes da rematrícula.'
          : 'A escola ainda está a concluir a sua situação académica.',
        academic: {
          decision: academicDecision,
          disciplinaIdsPendentes: academic?.progression.disciplinaIdsPendentes ?? [],
        },
      })
    }

    if (academicDecision === 'concluiu') {
      return NextResponse.json({
        ok: true,
        eligible: false,
        code: 'ACADEMIC_CYCLE_COMPLETED',
        reason: 'O ciclo académico foi concluído e não existe uma classe seguinte para rematrícula.',
        academic: { decision: academicDecision, disciplinaIdsPendentes: [] },
      })
    }

    const { data: sourceTurma, error: sourceTurmaError } = await (supabase as any)
      .from('turmas')
      .select('id, curso_id, classe_id, classe:classes(id, nome, numero)')
      .eq('escola_id', escolaId)
      .eq('id', sourceMatricula.turma_id)
      .maybeSingle()
    if (sourceTurmaError || !sourceTurma?.curso_id || !sourceTurma?.classe_id) {
      return NextResponse.json({
        ok: true,
        eligible: false,
        code: 'DESTINATION_CLASS_NOT_CONFIGURED',
        reason: 'A turma de origem ainda não possui curso e classe configurados para calcular a rematrícula.',
      })
    }

    const sourceClassNumber = academic?.regime.classe_num ?? resolveClassNumber(sourceTurma.classe)
    const targetClassNumber = academic?.progression.destino === 'mesma_etapa'
      ? sourceClassNumber
      : academic?.progression.destino === 'proxima_etapa' && sourceClassNumber
        ? sourceClassNumber + 1
        : null
    if (!targetClassNumber) {
      return NextResponse.json({
        ok: true,
        eligible: false,
        code: 'DESTINATION_CLASS_NOT_CONFIGURED',
        reason: 'A classe destino ainda não foi resolvida para esta rematrícula.',
      })
    }

    const { data: courseClasses, error: courseClassesError } = await (supabase as any)
      .from('classes')
      .select('id, nome, numero, curso_id')
      .eq('escola_id', escolaId)
      .eq('curso_id', sourceTurma.curso_id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (courseClassesError) throw new Error(`Falha ao resolver classe destino: ${courseClassesError.message}`)
    const targetClass = (courseClasses ?? []).find(
      (row: { numero?: number | null; nome?: string | null }) => resolveClassNumber(row) === targetClassNumber,
    ) ?? null
    if (!targetClass?.id) {
      return NextResponse.json({
        ok: true,
        eligible: false,
        code: 'DESTINATION_CLASS_NOT_CONFIGURED',
        reason: `A ${targetClassNumber}.ª classe ainda não está configurada no curso de destino.`,
      })
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
      .order('id', { ascending: false })
      .limit(1)

    if (candidaturaError) throw new Error('Falha ao verificar rematrícula existente')
    const existingCandidatura = existingCandidaturas?.[0] ?? null

    const [{ data: servicosRows, error: servicosError }, { data: escolaRow }] = await Promise.all([
      (supabase as any)
        .from('servicos_escola')
        .select('id, codigo, nome, descricao, valor_base, ativo')
        .eq('escola_id', escolaId)
        .eq('ativo', true)
        .order('nome', { ascending: true })
        .order('id', { ascending: true }),
      (supabase as any).from('escolas').select('dados_pagamento').eq('id', escolaId).maybeSingle(),
    ])
    if (servicosError) throw new Error(`Falha ao carregar serviços de rematrícula: ${servicosError.message}`)

    const rematriculaService = (servicosRows ?? []).find((service: { codigo?: string }) => service.codigo === 'SERV_REMATRICULA') ?? null
    const availableServices = (servicosRows ?? [])
      .filter((service: { codigo?: string; valor_base?: number | null }) => service.codigo !== 'SERV_REMATRICULA' && Number(service.valor_base ?? 0) > 0)
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
    const targetPricing = rematriculaService
      ? await resolveValorConfirmacao(supabase, {
          escolaId,
          anoLetivo: nextAno,
          cursoId: sourceTurma.curso_id,
          classeId: targetClass.id,
          valorGlobal: rematriculaService.valor_base,
        })
      : null

    const { data: rematriculaPedidos, error: pedidoError } = await (supabase as any)
      .from('servico_pedidos')
      .select('id, status, valor_cobrado, contexto, created_at')
      .eq('escola_id', escolaId)
      .eq('aluno_id', alunoId)
      .eq('servico_codigo', 'SERV_REMATRICULA')
      .in('status', ['pending_payment', 'granted'])
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(20)
    if (pedidoError) throw new Error(`Falha ao verificar pagamento de rematrícula: ${pedidoError.message}`)
    const rematriculaPedido = (rematriculaPedidos ?? []).find((pedido: { contexto?: Record<string, unknown> | null }) => {
      const contexto = pedido.contexto ?? {}
      const matchesCandidatura = Boolean(existingCandidatura?.id && contexto.candidatura_id === existingCandidatura.id)
      const matchesTargetYear = contexto.origem === 'portal_rematricula' && Number(contexto.ano_letivo) === nextAno
      const matchesBalcaoReconciliado = contexto.origem === 'rematricula_balcao'
        && contexto.origem_matricula_id === sourceMatricula.id
        && typeof contexto.matricula_destino_id === 'string'
      return matchesCandidatura || matchesTargetYear || matchesBalcaoReconciliado
    }) ?? null
    const matriculaDestinoId = typeof rematriculaPedido?.contexto?.matricula_destino_id === 'string'
      ? rematriculaPedido.contexto.matricula_destino_id
      : null
    let rematriculaBalcaoConcluida = false
    if (rematriculaPedido?.status === 'granted' && matriculaDestinoId) {
      const { data: matriculaDestino, error: matriculaDestinoError } = await supabase
        .from('matriculas')
        .select('id, ano_letivo, status, numero_matricula')
        .eq('escola_id', escolaId)
        .eq('id', matriculaDestinoId)
        .eq('aluno_id', alunoId)
        .maybeSingle()
      if (matriculaDestinoError) throw new Error(`Falha ao confirmar matrícula de destino: ${matriculaDestinoError.message}`)
      rematriculaBalcaoConcluida = Number(matriculaDestino?.ano_letivo) === nextAno
        && ['ativo', 'ativa', 'active'].includes(String(matriculaDestino?.status ?? '').toLowerCase())
        && Boolean(matriculaDestino?.numero_matricula)
    }
    let paymentIntent: Record<string, unknown> | null = null
    if (rematriculaPedido?.id) {
      const { data: intent, error: intentError } = await (supabase as any)
        .from('pagamento_intents')
        // `updated_at` não faz parte do contrato mínimo histórico da tabela.
        // O estado do portal usa created_at/meta e continua funcional enquanto
        // a migration de enriquecimento do schema ainda não estiver disponível.
        .select('id, status, amount, reference, evidence_url, meta')
        .eq('servico_pedido_id', rematriculaPedido.id)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
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
          submitted_at: intent.meta?.submitted_at ?? null,
          mensagem_aluno: intent.meta?.mensagem_aluno ?? null,
          itens_pagamento: intent.meta?.itens_pagamento ?? rematriculaPedido?.contexto?.itens_pagamento ?? [],
          rejection_reason: intent.meta?.reject_reason ?? null,
          receipt_pending: intent.status === 'settled' && !receipt?.id,
          receipt_url: receipt?.id ? `/aluno/documentos/${receipt.id}/recibo/print` : null,
        }
      }
    }
    const rematriculaData = {
      service: rematriculaService && targetPricing && targetPricing.valor > 0 ? {
        id: rematriculaService.id,
        nome: rematriculaService.nome,
        valor: targetPricing.valor,
        pricing_origin: targetPricing.origem,
        tabela_preco_id: targetPricing.tabela?.id ?? null,
      } : null,
      services: availableServices,
      dadosPagamento,
      paymentIntent,
      destination: {
        curso_id: sourceTurma.curso_id,
        classe_id: targetClass.id,
        classe_nome: targetClass.nome ?? `${targetClassNumber}.ª classe`,
        classe_numero: targetClassNumber,
      },
    }

    if (!rematriculaService || !targetPricing || targetPricing.valor <= 0) {
      return NextResponse.json({
        ok: true,
        eligible: false,
        code: 'SERVICE_NOT_CONFIGURED',
        reason: `A taxa de rematrícula ainda não foi configurada para a ${targetClassNumber}.ª classe.`,
        rematricula: rematriculaData,
      })
    }

    // A dívida que bloqueia esta transição pertence à matrícula/ano de origem;
    // cobranças do novo ano não podem retroativamente invalidar a origem.
    const { data: mens, error: mensalidadesError } = await supabase
      .from('mensalidades')
      .select('id')
      .eq('escola_id', escolaId)
      .eq('aluno_id', alunoId)
      .or(`matricula_id.eq.${sourceMatricula.id},ano_referencia.eq.${sourceMatricula.ano_letivo}`)
      .in('status', ['pendente', 'atrasado', 'pago_parcial'])
      .limit(1)

    if (mensalidadesError) {
      throw new Error(`Falha ao verificar situação financeira: ${mensalidadesError.message}`)
    }

    const hasDebt = (mens?.length ?? 0) > 0

    // A reserva criada pela virada, isoladamente, não conclui a rematrícula.
    // Já um pedido concedido que aponta para uma matrícula destino activa é
    // a confirmação canónica, inclusive quando o atendimento foi no Balcão.
    if (existingCandidatura || rematriculaBalcaoConcluida) {
      return NextResponse.json({
        ok: true,
        eligible: false,
        alreadyDone: true,
        nextAno,
        hasDebt,
        status: rematriculaBalcaoConcluida ? 'matriculada' : existingCandidatura?.status,
        reason: rematriculaBalcaoConcluida
          ? 'A sua rematrícula já foi confirmada pela secretaria.'
          : 'O seu pedido de rematrícula já está em análise pela secretaria.',
        academic: academic ? {
          decision: academicDecision,
          destino: academic.progression.destino,
          disciplinaIdsPendentes: academic.progression.disciplinaIdsPendentes,
        } : null,
        rematricula: rematriculaData,
      })
    }

    return NextResponse.json({
      ok: true,
      eligible: true,
      nextAno,
      hasDebt,
      academic: academic ? {
        decision: academicDecision,
        destino: academic.progression.destino,
        disciplinaIdsPendentes: academic.progression.disciplinaIdsPendentes,
      } : null,
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
