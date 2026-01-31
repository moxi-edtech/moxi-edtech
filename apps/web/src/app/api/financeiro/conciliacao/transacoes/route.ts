// apps/web/src/app/api/financeiro/conciliacao/transacoes/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'pendente'; // Default to pending

    let query = (supabase as any)
      .from('financeiro_transacoes_importadas')
      .select('id, data, descricao, referencia, valor, tipo, banco, conta, status, match_confianca, aluno_match_details')
      .eq('escola_id', escolaId);

    if (statusFilter !== 'todos') {
      query = query.eq('status', statusFilter);
    }
    
    const { data: transactions, error } = await query;

    if (error) {
      console.error('Erro ao buscar transações importadas:', error);
      throw error;
    }

    const formattedTransactions = transactions.map((t: any) => {
      const details = t.aluno_match_details as
        | { alunoMatch?: unknown; mensalidadesPendentes?: unknown[] }
        | null
        | undefined;
      return ({
        id: t.id,
        data: new Date(t.data), // Convert date string to Date object
        descricao: t.descricao,
        referencia: t.referencia,
        valor: t.valor,
        tipo: t.tipo,
        banco: t.banco,
        conta: t.conta,
        status: t.status,
        matchConfianca: t.match_confianca,
        // alunoMatch and mensalidadesPendentes will be populated by matching logic later
        alunoMatch: details?.alunoMatch || null,
        mensalidadesPendentes: details?.mensalidadesPendentes || [],
      });
    });

    return NextResponse.json({ ok: true, transactions: formattedTransactions });
  } catch (e: any) {
    console.error('Erro na API de listagem de transações:', e);
    return NextResponse.json({ error: e.message || 'Erro interno do servidor.' }, { status: 500 });
  }
}
