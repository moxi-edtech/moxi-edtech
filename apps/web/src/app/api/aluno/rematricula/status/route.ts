import { NextResponse } from 'next/server'
import { getAlunoContext } from '@/lib/alunoContext'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { supabase, ctx } = await getAlunoContext()
    if (!ctx || !ctx.alunoId || !ctx.escolaId) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    }

    const { escolaId, alunoId, anoLetivo: currentAno } = ctx

    if (!currentAno) {
      return NextResponse.json({ ok: false, eligible: false, reason: 'Ano letivo atual não identificado' })
    }

    // 1. Buscar janela explícita de rematrícula aberta
    const nowIso = new Date().toISOString()
    const { data: nextAnoRow, error: nextAnoError } = await (supabase as any)
      .from('rematricula_janelas')
      .select('ano_letivo, data_inicio, data_fim')
      .eq('escola_id', escolaId)
      .eq('ativa', true)
      .gt('ano_letivo', currentAno)
      .lte('data_inicio', nowIso)
      .gte('data_fim', nowIso)
      .order('ano_letivo', { ascending: true })
      .order('data_inicio', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (nextAnoError) {
      throw new Error(`Falha ao consultar janela de rematrícula: ${nextAnoError.message}`)
    }

    if (!nextAnoRow) {
      return NextResponse.json({ ok: true, eligible: false, reason: 'Período de rematrícula não está aberto.' })
    }

    const nextAno = nextAnoRow.ano_letivo

    // 2. Verificar se já existe rematrícula (candidatura ou matrícula) para o próximo ano
    const [existingCandidatura, existingMatricula] = await Promise.all([
      supabase
        .from('candidaturas')
        .select('id, status')
        .eq('escola_id', escolaId)
        .eq('aluno_id', alunoId)
        .eq('ano_letivo', nextAno)
        .not('status', 'eq', 'rejeitada')
        .maybeSingle(),
      supabase
        .from('matriculas')
        .select('id, status')
        .eq('escola_id', escolaId)
        .eq('aluno_id', alunoId)
        .eq('ano_letivo', nextAno)
        .maybeSingle()
    ])

    if (existingCandidatura.error || existingMatricula.error) {
      throw new Error('Falha ao verificar rematrícula existente')
    }

    if (existingMatricula.data) {
      return NextResponse.json({ 
        ok: true, 
        eligible: false, 
        alreadyDone: true,
        reason: 'Rematrícula já efectivada para o próximo ano.' 
      })
    }

    if (existingCandidatura.data) {
      return NextResponse.json({ 
        ok: true, 
        eligible: false, 
        alreadyDone: true,
        status: existingCandidatura.data.status,
        reason: 'O seu pedido de rematrícula já está em análise pela secretaria.' 
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
      reason: hasDebt 
        ? 'Possui pendências financeiras que impedem a rematrícula automática.' 
        : 'Elegível para rematrícula.'
    })

  } catch (err: any) {
    console.error('Rematricula Status Error:', err)
    return NextResponse.json({ ok: false, error: 'Erro ao verificar elegibilidade' }, { status: 500 })
  }
}
