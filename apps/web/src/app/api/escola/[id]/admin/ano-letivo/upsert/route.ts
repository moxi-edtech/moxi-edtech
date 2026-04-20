import { NextResponse } from 'next/server';
import { supabaseServerTyped } from '@/lib/supabaseServer';
import { assertEscolaAccessAndPermissions } from '@/lib/api/assertEscolaAccessAndPermissions';
import { PAPEL_GROUP_ESCOLA_ADMIN_SETUP } from '@/lib/permissions';
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

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const { id: requestedEscolaId } = await params;
    const access = await assertEscolaAccessAndPermissions({
      client: supabase as any,
      userId: user.id,
      requestedEscolaId,
      allowedPapels: PAPEL_GROUP_ESCOLA_ADMIN_SETUP,
      route: '/api/escola/[id]/admin/ano-letivo/upsert',
    });
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.error, code: access.code }, { status: access.status });
    }
    const userEscolaId = access.escolaId;

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
