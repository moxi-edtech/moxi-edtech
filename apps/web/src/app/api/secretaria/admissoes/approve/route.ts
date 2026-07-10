import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRoleInSchool } from '@/lib/authz'
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { recordAuditServer } from '@/lib/audit'
import { K12_SECRETARIA_OPERACIONAL_ROLE_GROUP } from '@/lib/roles'
import type { Json } from '~types/supabase'

type JsonObject = { [key: string]: Json | undefined }

function isJsonObject(value: Json | null | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getString(value: Json | undefined) {
  return typeof value === 'string' && value.trim() ? value : null
}

const payloadSchema = z.object({
  candidatura_id: z.string().uuid(),
  turma_id: z.string().uuid().optional(),
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

  const { candidatura_id, turma_id, observacao, metodo_pagamento, comprovativo_url, amount, referencia } = parsed.data

  try {
  const { data: head, error: headErr } = await supabase
      .from('candidaturas')
      .select('id, escola_id, status, dados_candidato, curso_id, classe_id, turma_preferencial_id')
      .eq('id', candidatura_id)
      .single()

    if (headErr || !head) {
      return NextResponse.json({ error: 'Candidatura not found' }, { status: 404 })
    }

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const resolvedEscolaId = await resolveEscolaIdForUser(
      supabase,
      user.id,
      head.escola_id
    );
    if (!resolvedEscolaId || resolvedEscolaId !== head.escola_id) {
      return NextResponse.json({ error: 'Sem vínculo com a escola' }, { status: 403 });
    }

    const { error: authError } = await requireRoleInSchool({
      supabase,
      escolaId: head.escola_id,
      roles: [...K12_SECRETARIA_OPERACIONAL_ROLE_GROUP],
    })
    if (authError) return authError

    if (head.status === 'rascunho' && (metodo_pagamento || comprovativo_url || amount || referencia)) {
      const current = isJsonObject(head.dados_candidato) ? head.dados_candidato : {}
      const currentPagamento = isJsonObject(current.pagamento) ? current.pagamento : {}
      const pagamento: JsonObject = {
        ...currentPagamento,
        ...(metodo_pagamento ? { metodo: metodo_pagamento } : {}),
        ...(comprovativo_url ? { comprovativo_url } : {}),
        ...(amount ? { amount } : {}),
        ...(referencia ? { referencia } : {}),
      }
      const merged: JsonObject = {
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

    if (head.status === 'pre_candidatura') {
      return NextResponse.json(
        { error: 'Pré-candidatura não pode ser aprovada como matrícula. Aguarde a preparação do próximo ano letivo e converta-a para candidatura formal.' },
        { status: 400 }
      )
    }

    if (head.status === 'rascunho') {
      const turmaId = turma_id ?? head.turma_preferencial_id
      if (!turmaId) {
        return NextResponse.json(
          { error: 'Defina curso e turma preferencial antes de aprovar/finalizar esta candidatura.' },
          { status: 400 }
        )
      }

      const { data: turma, error: turmaErr } = await supabase
        .from('turmas')
        .select('id, curso_id, classe_id, ano_letivo, turno')
        .eq('id', turmaId)
        .eq('escola_id', head.escola_id)
        .maybeSingle()

      if (turmaErr) throw turmaErr
      if (!turma?.curso_id || !turma?.ano_letivo) {
        return NextResponse.json(
          { error: 'Turma preferencial incompleta: curso ou ano letivo não configurado.' },
          { status: 400 }
        )
      }

      const current = isJsonObject(head.dados_candidato) ? head.dados_candidato : {}
      const merged: JsonObject = {
        ...current,
        curso_id: turma.curso_id,
        classe_id: turma.classe_id ?? head.classe_id ?? null,
        turma_preferencial_id: turma.id,
        ano_letivo: turma.ano_letivo,
        turno: turma.turno ?? null,
      }

      const { error: syncErr } = await supabase
        .from('candidaturas')
        .update({
          curso_id: turma.curso_id,
          classe_id: turma.classe_id ?? head.classe_id ?? null,
          turma_preferencial_id: turma.id,
          ano_letivo: turma.ano_letivo,
          turno: turma.turno ?? null,
          dados_candidato: merged,
        })
        .eq('id', candidatura_id)
        .eq('escola_id', head.escola_id)

      if (syncErr) throw syncErr
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
      p_observacao: observacao ?? undefined,
    })

    if (error) throw error

    const { data: updated } = await supabase
      .from('candidaturas')
      .select('id, status, dados_candidato')
      .eq('id', candidatura_id)
      .eq('escola_id', head.escola_id)
      .maybeSingle()

    if (updated?.status === 'aguardando_pagamento') {
      const dados = isJsonObject(updated.dados_candidato) ? updated.dados_candidato : {}
      const pagamento = isJsonObject(dados.pagamento) ? dados.pagamento : {}
      const metodo = getString(pagamento.metodo) || 'não informado'
      const referencia = getString(pagamento.referencia)
      const mensagemParts = [
        `Método: ${metodo}`,
        referencia ? `Ref: ${referencia}` : null,
      ].filter(Boolean)
      const mensagem = mensagemParts.join(' | ')

      try {
	        await supabase.from('notifications').insert({
	          escola_id: head.escola_id,
	          target_role: 'financeiro',
          tipo: 'candidatura_pagamento',
          titulo: 'Pagamento aguardando compensação',
          mensagem: mensagem || null,
          link_acao: `/financeiro/candidaturas?candidatura=${candidatura_id}`,
        })
      } catch {}
    }

    recordAuditServer({
      escolaId: head.escola_id,
      portal: 'secretaria',
      acao: 'ADMISSAO_APROVADA',
      entity: 'candidaturas',
      entityId: candidatura_id,
      details: { observacao: observacao ?? null, status: updated?.status ?? null },
    }).catch(() => null)

    return NextResponse.json({ ok: true, status: updated?.status ?? null })
  } catch (error: unknown) {
    console.error('admissao approve error:', error)
    const message = error instanceof Error ? error.message : null
    const code =
      typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
        ? error.code
        : null
    if (code === 'P0001') {
      return NextResponse.json(
        { error: message ?? 'Falha de validação da candidatura.', code },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: message,
        code,
      },
      { status: 500 }
    )
  }
}
