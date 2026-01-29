// apps/web/src/app/api/financeiro/conciliacao/confirmar/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ConfirmPayloadSchema = z.object({
  transacaoId: z.string().uuid(),
  alunoId: z.string().uuid(),
  mensalidadeId: z.string().uuid().optional(), // Mensalidade is optional for general payments
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } = {} } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) {
      return NextResponse.json({ error: 'Escola não identificada' }, { status: 403 });
    }

    const body = await request.json();
    const parsedBody = ConfirmPayloadSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.issues }, { status: 400 });
    }

    const { transacaoId, alunoId, mensalidadeId } = parsedBody.data;

    // Start a database transaction
    const { error: rpcError } = await supabase.rpc('confirmar_conciliacao_transacao', {
        p_escola_id: escolaId,
        p_transacao_id: transacaoId,
        p_aluno_id: alunoId,
        p_mensalidade_id: mensalidadeId,
        p_user_id: user.id
    });

    if (rpcError) {
        console.error('Erro na RPC confirmar_conciliacao_transacao:', rpcError);
        throw rpcError;
    }

    return NextResponse.json({ ok: true, message: 'Transação conciliada com sucesso!' });

  } catch (e: any) {
    console.error('Erro na API de confirmação de conciliação:', e);
    return NextResponse.json({ error: e.message || 'Erro interno do servidor.' }, { status: 500 });
  }
}
