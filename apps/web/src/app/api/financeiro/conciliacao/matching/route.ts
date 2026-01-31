// apps/web/src/app/api/financeiro/conciliacao/matching/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';

export const dynamic = 'force-dynamic';

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

    const { searchParams } = new URL(request.url);
    const importId = searchParams.get('import_id') ?? undefined; // import_id é opcional para processar todos

    const { data: result, error: rpcError } = await supabase.rpc('conciliar_transacoes_auto_match', {
      p_escola_id: escolaId,
      p_import_id: importId,
    });

    if (rpcError) {
      console.error('Erro na RPC conciliar_transacoes_auto_match:', rpcError);
      throw rpcError;
    }

    return NextResponse.json(result);
  } catch (e: any) {
    console.error('Erro na API de matching:', e);
    return NextResponse.json({ error: e.message || 'Erro interno do servidor.' }, { status: 500 });
  }
}
