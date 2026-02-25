import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServerTyped } from '@/lib/supabaseServer';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import { emitirEvento } from '@/lib/eventos/emitirEvento';
import type { Database } from '~types/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const Body = z.object({
  status: z.enum(['ABERTO', 'FECHADO']),
  reason: z.string().min(1).max(500).optional(),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string; turmaId: string }> }) {
  try {
    const { id: requestedEscolaId, turmaId } = await params;
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, requestedEscolaId);
    const effectiveEscolaId = userEscolaId ?? requestedEscolaId;

    if (userEscolaId && userEscolaId !== requestedEscolaId) {
      return NextResponse.json({ ok: false, error: 'Acesso negado a esta escola.' }, { status: 403 });
    }

    const { data: hasAdminRole, error: roleError } = await supabase
      .rpc('user_has_role_in_school', {
        p_escola_id: effectiveEscolaId,
        p_roles: ['admin_escola', 'admin'],
      });

    if (roleError) {
      console.error('Error checking user role:', roleError);
      return NextResponse.json({ ok: false, error: 'Erro ao verificar permissões.' }, { status: 500 });
    }

    if (!hasAdminRole) {
      const { data: hasSecretariaRole, error: secretariaError } = await supabase
        .rpc('user_has_role_in_school', {
          p_escola_id: effectiveEscolaId,
          p_roles: ['secretaria'],
        });

      if (secretariaError) {
        console.error('Error checking secretaria role:', secretariaError);
        return NextResponse.json({ ok: false, error: 'Erro ao verificar permissões.' }, { status: 500 });
      }

      if (!hasSecretariaRole) {
        return NextResponse.json({ ok: false, error: 'Você não tem permissão para executar esta ação.' }, { status: 403 });
      }
    }

    const { data, error } = await supabase
      .from('turmas')
      .select('id, status_fecho')
      .eq('escola_id', effectiveEscolaId)
      .eq('id', turmaId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching turma status_fecho:', error);
      return NextResponse.json({ ok: false, error: 'Erro ao carregar status de fecho.' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ ok: false, error: 'Turma não encontrada.' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      status: data.status_fecho ?? 'ABERTO',
      can_manage: Boolean(hasAdminRole),
    }, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Error in turma fecho GET API:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string; turmaId: string }> }) {
  try {
    const { id: requestedEscolaId, turmaId } = await params;
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const parse = Body.safeParse(await req.json().catch(() => ({})));
    if (!parse.success) {
      return NextResponse.json({ ok: false, error: 'Dados inválidos.', issues: parse.error.issues }, { status: 400 });
    }

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, requestedEscolaId);
    const effectiveEscolaId = userEscolaId ?? requestedEscolaId;

    if (userEscolaId && userEscolaId !== requestedEscolaId) {
      return NextResponse.json({ ok: false, error: 'Acesso negado a esta escola.' }, { status: 403 });
    }

    const { data: hasRole, error: roleError } = await supabase
      .rpc('user_has_role_in_school', {
        p_escola_id: effectiveEscolaId,
        p_roles: ['admin_escola', 'admin'],
      });

    if (roleError) {
      console.error('Error checking user role:', roleError);
      return NextResponse.json({ ok: false, error: 'Erro ao verificar permissões.' }, { status: 500 });
    }

    if (!hasRole) {
      return NextResponse.json({ ok: false, error: 'Você não tem permissão para executar esta ação.' }, { status: 403 });
    }

    const { data, error } = await supabase.rpc('turma_set_status_fecho', {
      p_escola_id: effectiveEscolaId,
      p_turma_id: turmaId,
      p_status: parse.data.status,
      p_reason: parse.data.reason ?? undefined,
    });

    if (error) {
      console.error('Error updating status_fecho:', error);
      return NextResponse.json({ ok: false, error: 'Erro ao atualizar status de fecho.' }, { status: 500 });
    }

    emitirEvento(supabase, {
      escola_id: effectiveEscolaId,
      tipo: parse.data.status === 'FECHADO' ? 'turma.fechada' : 'turma.reaberta',
      payload: {
        turma_id: turmaId,
        status_fecho: parse.data.status,
        reason: parse.data.reason ?? null,
      },
      actor_id: user.id,
      actor_role: 'admin',
      entidade_tipo: 'turma',
      entidade_id: turmaId,
    }).catch(() => null);

    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Error in turma fecho API:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
