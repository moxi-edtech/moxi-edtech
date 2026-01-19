import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabaseServer'
import { recordAuditServer } from '@/lib/audit'

const BodySchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome'),
  primeiro_nome: z.string().trim().optional().nullable(),
  sobrenome: z.string().trim().optional().nullable(),
  email: z.string().email('Email inválido').optional().nullable(),
  telefone: z.string().trim().optional().nullable(),
  endereco: z.string().trim().optional().nullable(),
  data_nascimento: z.string().optional().nullable(),
  sexo: z.enum(['M', 'F', 'O', 'N']).optional().nullable(),
  bi_numero: z.string().optional().nullable(),
  nif: z.string().optional().nullable(),
  naturalidade: z.string().optional().nullable(),
  provincia: z.string().optional().nullable(),
  responsavel_nome: z.string().optional().nullable(),
  responsavel_contato: z.string().trim().optional().nullable(),
  encarregado_relacao: z.string().optional().nullable(),
  encarregado_email: z.string().email().optional().nullable(),
  curso_id: z.string().uuid({ message: 'Curso obrigatório' }),
  classe_id: z.string().uuid().optional().nullable(),
  ano_letivo: z.coerce.number().int().optional(),
  turno: z.string().trim().optional().nullable(),
  turma_preferencial_id: z.string().uuid().optional().nullable(),
  pagamento_metodo: z.string().trim().optional().nullable(),
  pagamento_referencia: z.string().trim().optional().nullable(),
  pagamento_comprovativo_url: z.string().url().optional().nullable(),
})

// Removi o segundo argumento 'context' pois a rota não tem [id]
export async function POST(req: Request) {
  let escolaId: string | null = null

  try {
    const bodyRaw = await req.json()
    const parsed = BodySchema.safeParse(bodyRaw)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Dados inválidos' }, { status: 400 })
    }
    const body = parsed.data

    // 1. Validar Sessão e Descobrir Escola
    const s = await supabaseServer()
    const { data: userRes } = await s.auth.getUser()
    const user = userRes?.user
    
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })
    
    // --- CORREÇÃO: Buscar escolaId do perfil do usuário logado ---
    const { data: prof } = await s
      .from('profiles' as any)
      .select('escola_id, current_escola_id')
      .eq('user_id', user.id)
      .maybeSingle()

    // Tenta pegar current_escola_id (se tiver troca de contexto) ou escola_id fixo
    escolaId = (prof as any)?.current_escola_id || (prof as any)?.escola_id

    // Fallback: Checar tabela de vínculos
    if (!escolaId) {
       const { data: vinc } = await s
         .from('escola_users')
         .select('escola_id')
         .eq('user_id', user.id)
         .limit(1)
         .maybeSingle()
       escolaId = vinc?.escola_id || null
    }

    if (!escolaId) {
      return NextResponse.json({ ok: false, error: 'Usuário não vinculado a nenhuma escola.' }, { status: 403 })
    }
    
    const nomeCompleto = `${body.primeiro_nome || ''} ${body.sobrenome || ''}`.replace(/\s+/g, ' ').trim() || body.nome.trim()
    const anoLetivo = body.ano_letivo ?? new Date().getFullYear()

    const dadosCandidato = {
      nome: nomeCompleto,
      nome_completo: nomeCompleto,
      primeiro_nome: body.primeiro_nome,
      sobrenome: body.sobrenome,
      email: body.email,
      telefone: body.telefone ?? null,
      endereco: body.endereco ?? null,
      data_nascimento: body.data_nascimento ?? null,
      sexo: body.sexo ?? null,
      bi_numero: body.bi_numero ?? null,
      nif: body.nif ?? body.bi_numero ?? null,
      responsavel_nome: body.responsavel_nome ?? null,
      responsavel_contato: body.responsavel_contato ?? null,
      encarregado_email: body.encarregado_email ?? null,
      curso_id: body.curso_id,
      classe_id: body.classe_id ?? null,
      ano_letivo: anoLetivo,
      turno: body.turno ?? null,
      turma_preferencial_id: body.turma_preferencial_id ?? null,
      origem_portal: 'secretaria',
      registrado_por_user_id: user.id,
      registrado_por_email: user.email ?? (user as any)?.user_metadata?.email ?? null,
      registrado_por_nome: (user as any)?.user_metadata?.nome || user.email || null,
      pagamento: {
        metodo: body.pagamento_metodo ?? null,
        referencia: body.pagamento_referencia ?? null,
        comprovativo_url: body.pagamento_comprovativo_url ?? null,
      },
    }

    const { data: candidatura, error: candErr } = await s
      .from('candidaturas')
      .insert({
        escola_id: escolaId,
        aluno_id: null,
        curso_id: body.curso_id,
        ano_letivo: anoLetivo,
        status: 'pendente',
        turma_preferencial_id: body.turma_preferencial_id ?? null,
        dados_candidato: dadosCandidato as any,
        nome_candidato: nomeCompleto,
        classe_id: body.classe_id ?? null,
        turno: body.turno ?? null,
      })
      .select('id')
      .single()

    if (candErr) {
      throw new Error(`Erro ao salvar candidatura: ${candErr.message}`)
    }

    recordAuditServer({
      escolaId,
      portal: 'secretaria',
      acao: 'CANDIDATURA_CRIADA',
      entity: 'candidaturas',
      entityId: String(candidatura?.id),
      details: { email: body.email, nome: nomeCompleto, registrado_por: user.id, portal: 'secretaria' },
    }).catch(() => null)

    // Notifica Financeiro se houver informação de pagamento anexada
    const hasPagamentoInfo = body.pagamento_metodo || body.pagamento_referencia || body.pagamento_comprovativo_url
    if (hasPagamentoInfo) {
      const titulo = 'Nova candidatura com pagamento informado'
      const mensagemParts = [
        `Método: ${body.pagamento_metodo || 'não informado'}`,
        body.pagamento_referencia ? `Ref: ${body.pagamento_referencia}` : null,
      ].filter(Boolean)
      const mensagem = mensagemParts.join(' | ')

      try {
        await s.from('notifications').insert({
          escola_id: escolaId,
          target_role: 'financeiro' as any,
          tipo: 'candidatura_pagamento',
          titulo,
          mensagem: mensagem || null,
          link_acao: `/financeiro/candidaturas?candidatura=${candidatura?.id ?? ''}`,
        })
      } catch (_) {
        /* ignore */
      }
    }

    return NextResponse.json({ ok: true, candidatura_id: candidatura?.id }, { status: 200 })

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
