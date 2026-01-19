// apps/web/src/app/api/secretaria/admissoes/convert/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { recordAuditServer } from '@/lib/audit'
import { requireRoleInSchool } from '@/lib/authz';
// import { enqueueOutboxEvent } from '@/lib/outbox';

const convertPayloadSchema = z.object({
  candidatura_id: z.string().uuid(),
  turma_id: z.string().uuid(),
  metodo_pagamento: z.enum(['TPA', 'CASH', 'TRANSFERENCIA']),
  comprovativo_url: z.string().url().optional(),
  amount: z.number().positive().optional(),
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
  
  const { candidatura_id, turma_id, metodo_pagamento, comprovativo_url, amount } = validation.data

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
  const { error: authError } = await requireRoleInSchool({
    supabase,
    escolaId: candidatura.escola_id,
    roles: ['secretaria', 'admin', 'admin_escola', 'staff_admin']
  });
  if (authError) return authError;

    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (user) {
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
      }
    } catch {}

    // 3. Chamada do RPC Blindado
    const { data, error } = await supabase.rpc('admissao_convert_to_matricula', {
      p_escola_id: candidatura.escola_id,
      p_candidatura_id: candidatura_id,
      p_metadata: {
        metodo_pagamento,
        comprovativo_url,
        amount,
        idempotency_key: idempotencyKey
      }
    })

    if (error) throw error

    return NextResponse.json({ ok: true, matricula_id: data })
  } catch (error: any) {
    console.error('Error converting admission:', error)
    if (error.code === '23505') { // unique_violation, could be our idempotency key
        return NextResponse.json({ error: 'This request has already been processed.' }, { status: 409 });
    }
    if (error?.code === '42883') {
      const message = String(error?.message ?? '')
      const missingFunction = /confirmar_matricula_core/i.test(message)
      return NextResponse.json(
        {
          error: missingFunction
            ? 'Banco desatualizado: função confirmar_matricula_core não encontrada.'
            : 'Erro de compatibilidade no banco ao converter matrícula.',
          details: missingFunction
            ? 'Execute as migrations locais (ex: pnpm db:push ou pnpm db:reset) para criar a função.'
            : error?.message ?? null,
          hint: missingFunction ? null : error?.hint ?? null,
          code: error?.code ?? null,
        },
        { status: 500 }
      )
    }
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error?.message ?? null,
        code: error?.code ?? null,
      },
      { status: 500 }
    )
  }
}
