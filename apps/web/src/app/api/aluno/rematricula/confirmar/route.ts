import { NextResponse } from 'next/server'
import { getAlunoContext } from '@/lib/alunoContext'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const { supabase, ctx } = await getAlunoContext()
    if (!ctx || !ctx.alunoId || !ctx.escolaId || !ctx.matriculaId) {
      return NextResponse.json({ ok: false, error: 'Não autenticado ou sem matrícula' }, { status: 401 })
    }

    const { escolaId, alunoId, matriculaId, anoLetivo: currentAno } = ctx

    if (!currentAno) {
      return NextResponse.json({ ok: false, error: 'Ano letivo atual não identificado' }, { status: 400 })
    }

    // 1. Validar elegibilidade novamente (Segurança)
    const { data: nextAnoRow } = await supabase
      .from('anos_letivos')
      .select('id, ano')
      .eq('escola_id', escolaId)
      .gt('ano', currentAno)
      .order('ano', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!nextAnoRow) {
      return NextResponse.json({ ok: false, error: 'Próximo ano letivo não configurado' }, { status: 400 })
    }

    const nextAno = nextAnoRow.ano

    // 2. Verificação Financeira
    const { data: mens } = await supabase
      .from('mensalidades')
      .select('id')
      .eq('aluno_id', alunoId)
      .in('status', ['pendente', 'atrasado'])
      .limit(1)

    if ((mens?.length ?? 0) > 0) {
      return NextResponse.json({ ok: false, error: 'Possui pendências financeiras.' }, { status: 403 })
    }

    // 3. Buscar dados atuais do aluno para clonar
    const { data: currentMatRaw, error: matErr } = await supabase
      .from('matriculas')
      .select('curso_id, aluno:alunos(nome, bi_numero, telefone, responsavel_nome, responsavel_contato)')
      .eq('id', matriculaId)
      .single()

    if (matErr || !currentMatRaw) {
      return NextResponse.json({ ok: false, error: 'Matrícula atual não encontrada' }, { status: 404 })
    }

    interface AlunoData {
      nome: string
      bi_numero: string | null
      telefone: string | null
      responsavel_nome: string | null
      responsavel_contato: string | null
    }

    interface CurrentMatResult {
      curso_id: string
      aluno: AlunoData | AlunoData[] | null
    }

    const currentMat = currentMatRaw as unknown as CurrentMatResult
    const aluno = (Array.isArray(currentMat.aluno) ? currentMat.aluno[0] : currentMat.aluno) as AlunoData

    if (!aluno) {
      return NextResponse.json({ ok: false, error: 'Dados do aluno não encontrados' }, { status: 404 })
    }

    // 4. Criar Candidatura de Rematrícula
    const { data: candidaturaRaw, error: insErr } = await supabase
      .from('candidaturas')
      .insert({
        escola_id: escolaId,
        aluno_id: alunoId,
        curso_id: currentMat.curso_id,
        ano_letivo: nextAno,
        status: 'submetida',
        nome_candidato: aluno.nome,
        source: 'PORTAL_ALUNO_REMATRICULA',
        dados_candidato: {
          nome_completo: aluno.nome,
          bi_numero: aluno.bi_numero,
          telefone: aluno.telefone,
          responsavel_nome: aluno.responsavel_nome,
          responsavel_contato: aluno.responsavel_contato,
          tipo: 'rematricula'
        }
      })
      .select('id')
      .single()

    if (insErr) {
      if (insErr.code === '23505') {
        return NextResponse.json({ ok: false, error: 'Já existe um pedido de rematrícula para este ano.' }, { status: 409 })
      }
      throw insErr
    }

    const candidatura = candidaturaRaw as { id: string }

    // 5. Audit Log
    await supabase.from('audit_logs').insert({
      escola_id: escolaId,
      user_id: ctx.userId,
      action: 'REMATRICULA_SOLICITADA_PORTAL',
      entity: 'candidaturas',
      entity_id: candidatura.id,
      portal: 'aluno',
      details: { aluno_id: alunoId, next_ano: nextAno }
    })

    return NextResponse.json({ ok: true, message: 'Rematrícula solicitada com sucesso!' })

  } catch (err: any) {
    console.error('Confirm Rematricula Error:', err)
    return NextResponse.json({ ok: false, error: 'Erro ao processar rematrícula' }, { status: 500 })
  }
}
