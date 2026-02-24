import { NextResponse } from 'next/server';
import { supabaseServerTyped } from '@/lib/supabaseServer';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import { z } from 'zod';
import type { Database } from '~types/supabase';

export const dynamic = 'force-dynamic';

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  ano: z.number().int().min(2020).max(2050),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ativo: z.boolean(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const { id: requestedEscolaId } = params;
    const userEscolaId = await resolveEscolaIdForUser(supabase, user.id, requestedEscolaId);

    if (!userEscolaId || userEscolaId !== requestedEscolaId) {
      return NextResponse.json({ ok: false, error: 'Acesso negado a esta escola.' }, { status: 403 });
    }

    const { data: hasRole, error: rolesError } = await supabase
      .rpc('user_has_role_in_school', {
        p_escola_id: userEscolaId,
        p_roles: ['admin_escola', 'secretaria', 'admin'],
      });

    if (rolesError) {
      console.error('Error verifying user roles:', rolesError);
      return NextResponse.json({ ok: false, error: 'Erro ao verificar permissões.' }, { status: 500 });
    }

    if (!hasRole) {
      return NextResponse.json({ ok: false, error: 'Você não tem permissão para executar esta ação.' }, { status: 403 });
    }

    const body = await req.json();
    const parseResult = upsertSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ ok: false, error: 'Dados inválidos.', issues: parseResult.error.issues }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('setup_active_ano_letivo', {
      p_escola_id: userEscolaId,
      p_ano_data: parseResult.data,
    });

    if (error) {
      console.error('Error in RPC setup_active_ano_letivo:', error);
      return NextResponse.json({ ok: false, error: 'Erro ao salvar o ano letivo.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data }, { status: 200 });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro inesperado';
    console.error('Error in ano-letivo upsert API:', message);
    return NextResponse.json({ 
      ok: false, 
      error: message,
      stack: e instanceof Error ? e.stack : undefined 
    }, { status: 500 });
  }
}
