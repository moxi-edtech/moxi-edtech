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

    const requestedEscolaId = params.id;
    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, requestedEscolaId);

    if (!userEscolaId || userEscolaId !== requestedEscolaId) {
      return NextResponse.json({ ok: false, error: 'Acesso negado a esta escola.' }, { status: 403 });
    }

    const { data: roles, error: rolesError } = await supabase
      .rpc('get_my_roles', { p_escola_id: userEscolaId });

    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
      return NextResponse.json({ ok: false, error: 'Erro ao verificar permissões.' }, { status: 500 });
    }

    const isAdminOrSecretaria = roles.includes('admin_escola') || roles.includes('secretaria');

    if (!isAdminOrSecretaria) {
      return NextResponse.json({ ok: false, error: 'Você não tem permissão para executar esta ação.' }, { status: 403 });
    }

    const body = await req.json();
    const parseResult = upsertSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ ok: false, error: 'Dados inválidos.', issues: parseResult.error.issues }, { status: 400 });
    }

    const { id, ano, data_inicio, data_fim, ativo } = parseResult.data;

    // Se um ano letivo for ativado, desativar todos os outros da mesma escola
    if (ativo) {
      const { error: deactivateError } = await supabase
        .from('anos_letivos')
        .update({ ativo: false })
        .eq('escola_id', userEscolaId)
        .neq('id', id || '00000000-0000-0000-0000-000000000000'); // Exclui o atual se já existir
      
      if (deactivateError) {
        console.error('Error deactivating other anos letivos:', deactivateError);
        return NextResponse.json({ ok: false, error: 'Erro ao desativar outros anos letivos.' }, { status: 500 });
      }
    }

    const upsertData = {
      id: id,
      escola_id: userEscolaId,
      ano,
      data_inicio,
      data_fim,
      ativo,
    };

    const { data, error } = await supabase
      .from('anos_letivos')
      .upsert(upsertData, { onConflict: 'escola_id,ano' })
      .select()
      .single();

    if (error) {
      console.error('Error upserting ano letivo:', error);
      return NextResponse.json({ ok: false, error: 'Erro ao salvar o ano letivo.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data }, { status: 200 });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Error in ano-letivo upsert API:', message);
    return NextResponse.json({ 
      ok: false, 
      error: message,
      stack: e instanceof Error ? e.stack : undefined 
    }, { status: 500 });
  }
}
