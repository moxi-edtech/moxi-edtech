// apps/web/src/app/api/secretaria/admissoes/convert/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { requireRoleInSchool } from '@/lib/authz';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import { recordAuditServer } from '@/lib/audit';
import { emitirComprovanteMatricula } from '@/lib/documentos/emitirComprovanteMatricula';
// import { enqueueOutboxEvent } from '@/lib/outbox';

const convertPayloadSchema = z.object({
  candidatura_id: z.string().uuid(),
  turma_id: z.string().uuid(),
  metodo_pagamento: z.enum(['TPA', 'CASH', 'TRANSFERENCIA']),
  comprovativo_url: z.string().url().optional(),
  amount: z.number().positive().optional(),
  parcial: z.boolean().optional(),
  referencia: z.string().trim().optional(),
  // ... other payment details
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const idempotencyKey = request.headers.get('idempotency-key');
  if (!idempotencyKey) {
    return NextResponse.json({ error: 'Idempotency-Key header is required' }, { status: 400 });
  }

  const body = await request.json()
  const validation = convertPayloadSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json({ error: validation.error.format() }, { status: 400 })
  }
  
  const { candidatura_id, turma_id, metodo_pagamento, comprovativo_url, amount, parcial, referencia } = validation.data

  try {
    const { data: candidatura, error: candError } = await supabase
        .from('candidaturas')
        .select('escola_id')
        .eq('id', candidatura_id)
        .single();

    if (candError || !candidatura) {
        return NextResponse.json({ error: 'Candidatura not found' }, { status: 404 });
    }

  // 2. Authorize
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const escolaId = await resolveEscolaIdForUser(supabase as any, user.id, candidatura.escola_id);
  if (!escolaId || escolaId !== candidatura.escola_id) {
    return NextResponse.json({ error: 'Sem vínculo com a escola' }, { status: 403 });
  }

  const { error: authError } = await requireRoleInSchool({
    supabase,
    escolaId: candidatura.escola_id,
    roles: ['secretaria', 'admin', 'admin_escola', 'staff_admin', 'financeiro']
  });
  if (authError) return authError;

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("current_escola_id, escola_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile?.current_escola_id || !profile?.escola_id) {
        await supabase
          .from("profiles")
          .update({
            current_escola_id: profile?.current_escola_id ?? candidatura.escola_id,
            escola_id: profile?.escola_id ?? candidatura.escola_id,
          })
          .eq("user_id", user.id);
      }
    } catch {}

    // 3. Chamada canónica: valida turma/preço e faz rascunho -> submetida -> aprovada -> matriculado numa transação.
    const { data, error } = await (supabase as any).rpc('admissao_finalizar_matricula', {
      p_escola_id: candidatura.escola_id,
      p_candidatura_id: candidatura_id,
      p_turma_id: turma_id,
      p_pagamento: {
        metodo_pagamento,
        comprovativo_url,
        amount,
        parcial,
        referencia,
      },
      p_idempotency_key: idempotencyKey,
      p_observacao: 'Finalização via Nova Admissão',
    })

    if (error) throw error

    const result = (data && typeof data === 'object' ? data : {}) as {
      matricula_id?: string | null
      numero_matricula?: string | null
      valor_matricula?: number | null
      valor_pago?: number | null
      status?: string | null
    }
    const matriculaId = typeof result.matricula_id === 'string' ? result.matricula_id : null

    recordAuditServer({
      escolaId: candidatura.escola_id,
      portal: 'secretaria',
      acao: 'ADMISSAO_CONVERTIDA_MATRICULA',
      entity: 'matriculas',
      entityId: matriculaId,
      details: { candidatura_id, turma_id, metodo_pagamento, referencia: referencia ?? null },
    }).catch(() => null)

    try {
      await (supabase as any).rpc('refresh_mv_turmas_para_matricula')
    } catch (refreshError) {
      console.warn('[admissoes/convert] refresh_mv_turmas_para_matricula failed:', refreshError)
    }
    let comprovante: { ok: boolean; printUrl?: string; error?: string } | null = null
    if (matriculaId) {
      const comprovanteResult = await emitirComprovanteMatricula({
        supabase,
        escolaId: candidatura.escola_id,
        matriculaId,
        dataHoraEfetivacao: new Date().toISOString(),
        createdBy: user.id,
        audit: {
          portal: "secretaria",
          acao: "COMPROVANTE_MATRICULA_AUTOEMITIDO",
        },
      })
      if (comprovanteResult.ok) {
        comprovante = { ok: true, printUrl: comprovanteResult.printUrl }
      } else {
        comprovante = { ok: false, error: comprovanteResult.error }
        console.warn('[admissoes/convert] comprovante não emitido:', comprovanteResult.error)
      }
    }

    return NextResponse.json({ ok: true, ...result, matricula_id: matriculaId, comprovante })
  } catch (error: unknown) {
    console.error('Error converting admission:', error)
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') { // unique_violation
        return NextResponse.json({ error: 'This request has already been processed.' }, { status: 409 });
    }
    if (typeof error === 'object' && error && 'code' in error && error.code === '42883') {
      const message = String((error as { message?: string }).message ?? '')
      const missingFunction = /confirmar_matricula_core/i.test(message)
      return NextResponse.json(
        {
          error: missingFunction
            ? 'Banco desatualizado: função confirmar_matricula_core não encontrada.'
            : 'Erro de compatibilidade no banco ao converter matrícula.',
          details: missingFunction
            ? 'Execute as migrations locais (ex: pnpm db:push ou pnpm db:reset) para criar a função.'
            : (error as { message?: string }).message ?? null,
          hint: missingFunction ? null : (error as { hint?: string }).hint ?? null,
          code: (error as { code?: string }).code ?? null,
        },
        { status: 500 }
      )
    }
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : null,
        code: typeof error === 'object' && error && 'code' in error ? (error as { code?: string }).code ?? null : null,
      },
      { status: 500 }
    )
  }
}
