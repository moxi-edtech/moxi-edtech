import { NextResponse } from 'next/server';
import { supabaseServerTyped } from '@/lib/supabaseServer';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import { z } from 'zod';
import type { Database } from '~types/supabase';

export const dynamic = 'force-dynamic';

const periodoSchema = z.object({
  id: z.string().uuid().optional(),
  ano_letivo_id: z.string().uuid(),
  tipo: z.enum(['TRIMESTRE', 'SEMESTRE', 'BIMESTRE']),
  numero: z.number().int().min(1).max(4),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  trava_notas_em: z.string().datetime().optional().nullable(),
});

const upsertBulkSchema = z.array(periodoSchema);

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const { id: requestedEscolaId } = await (params as any);
    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, requestedEscolaId);

    if (!userEscolaId || userEscolaId !== requestedEscolaId) {
      return NextResponse.json({ ok: false, error: 'Acesso negado a esta escola.' }, { status: 403 });
    }

    const { data: hasRole, error: rolesError } = await (supabase as any)
      .rpc('user_has_role_in_school', {
        p_escola_id: userEscolaId,
        p_roles: ['admin_escola', 'secretaria', 'admin'],
      });

    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
      return NextResponse.json({ ok: false, error: 'Erro ao verificar permissões.' }, { status: 500 });
    }

    if (!hasRole) {
      return NextResponse.json({ ok: false, error: 'Você não tem permissão para executar esta ação.' }, { status: 403 });
    }

    const body = await req.json();
    const parseResult = upsertBulkSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ ok: false, error: 'Dados inválidos.', issues: parseResult.error.issues }, { status: 400 });
    }

    const { data, error } = await (supabase as any).rpc('upsert_bulk_periodos_letivos', {
      p_escola_id: userEscolaId,
      p_periodos_data: parseResult.data,
    });

    if (error) {
      console.error('Error upserting periodos letivos:', error);
      return NextResponse.json({ ok: false, error: 'Erro ao salvar os períodos letivos.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data }, { status: 200 });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Error in periodos-letivos upsert-bulk API:', message);
    return NextResponse.json({ 
      ok: false, 
      error: message,
      stack: e instanceof Error ? e.stack : undefined 
    }, { status: 500 });
  }
}
