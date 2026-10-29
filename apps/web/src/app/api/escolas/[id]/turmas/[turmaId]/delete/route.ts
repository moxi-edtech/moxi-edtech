import { NextRequest, NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/supabase/route-client';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import { authorizeTurmasManage } from '@/lib/escola/disciplinas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const headers = { 'Cache-Control': 'no-store' };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string; turmaId: string }> }) {
  try {
    const { id: escolaId, turmaId } = await context.params;
    const supabase = await createRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return json({ ok: false, error: 'Não autenticado' }, 401);
    const school = await resolveEscolaIdForUser(supabase, user.id, escolaId);
    if (!school) return json({ ok: false, error: 'Sem permissão' }, 403);
    const allowed = await authorizeTurmasManage(supabase, school, user.id);
    if (!allowed.allowed) return json({ ok: false, error: 'Sem permissão' }, 403);
    const { data: profile, error: profileError } = await supabase.from('profiles').select('escola_id').eq('user_id', user.id).maybeSingle();
    if (profileError || profile?.escola_id !== school) return json({ ok: false, error: 'Perfil não vinculado à escola' }, 403);
    const { data: turma, error: turmaError } = await supabase.from('turmas').select('id').eq('id', turmaId).eq('escola_id', school).maybeSingle();
    if (turmaError) return json({ ok: false, error: 'Não foi possível consultar a turma' }, 503);
    if (!turma) return json({ ok: true, already_deleted: true });
    // Foreign keys cascade into academic and billing records. Until an atomic,
    // dependency-aware operation exists, do not perform destructive deletion.
    return json({ ok: false, error: 'A exclusão de turmas está temporariamente indisponível para proteger os registos académicos. Contacte a administração.' }, 409);
  } catch {
    return json({ ok: false, error: 'Não foi possível excluir a turma' }, 503);
  }
}
