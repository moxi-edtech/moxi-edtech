import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServerTyped } from '@/lib/supabaseServer';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import type { Database } from '~types/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const Query = z.object({
  turma_id: z.string().uuid(),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: requestedEscolaId } = await params;
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const turmaId = searchParams.get('turma_id');
    const parsed = Query.safeParse({ turma_id: turmaId });
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Parâmetros inválidos.' }, { status: 400 });
    }

    const userEscolaId = await resolveEscolaIdForUser(supabase, user.id, requestedEscolaId);
    const effectiveEscolaId = userEscolaId ?? requestedEscolaId;

    if (userEscolaId && userEscolaId !== requestedEscolaId) {
      return NextResponse.json({ ok: false, error: 'Acesso negado a esta escola.' }, { status: 403 });
    }

    const { data: hasRole, error: rolesError } = await supabase
      .rpc('user_has_role_in_school', {
        p_escola_id: requestedEscolaId,
        p_roles: ['admin_escola', 'secretaria', 'admin'],
      });

    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
      return NextResponse.json({ ok: false, error: 'Erro ao verificar permissões.' }, { status: 500 });
    }

    if (!hasRole) {
      return NextResponse.json({ ok: false, error: 'Você não tem permissão para executar esta ação.' }, { status: 403 });
    }

    const { data: turma } = await supabase
      .from('turmas')
      .select('id, ano_letivo')
      .eq('escola_id', effectiveEscolaId)
      .eq('id', parsed.data.turma_id)
      .maybeSingle();

    if (!turma) {
      return NextResponse.json({ ok: false, error: 'Turma não encontrada.' }, { status: 404 });
    }

    if (turma.ano_letivo == null) {
      return NextResponse.json({ ok: true, items: [] });
    }

    const { data: anoLetivo } = await supabase
      .from('anos_letivos')
      .select('id')
      .eq('escola_id', effectiveEscolaId)
      .eq('ano', Number(turma.ano_letivo))
      .maybeSingle();

    if (!anoLetivo?.id) {
      return NextResponse.json({ ok: true, items: [] });
    }

    const { data: periodos, error: periodosError } = await supabase
      .from('periodos_letivos')
      .select('id, numero, tipo, data_inicio, data_fim')
      .eq('escola_id', effectiveEscolaId)
      .eq('ano_letivo_id', anoLetivo.id)
      .eq('tipo', 'TRIMESTRE')
      .order('numero', { ascending: true });

    if (periodosError) {
      return NextResponse.json({ ok: false, error: periodosError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, items: periodos || [] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
