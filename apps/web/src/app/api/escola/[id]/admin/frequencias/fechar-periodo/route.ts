import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServerTyped } from '@/lib/supabaseServer';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import type { Database } from '~types/supabase';
import { enqueueOutboxEvent, markOutboxEventFailed, markOutboxEventProcessed } from '@/lib/outbox';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const Body = z.object({
  turma_id: z.string().uuid(),
  periodo_letivo_id: z.string().uuid(),
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
    const periodoLetivoId = searchParams.get('periodo_letivo_id');

    if (!turmaId || !periodoLetivoId) {
      return NextResponse.json({ ok: false, error: 'Parâmetros inválidos.' }, { status: 400 });
    }

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, requestedEscolaId);
    const effectiveEscolaId = userEscolaId ?? requestedEscolaId;

    if (userEscolaId && userEscolaId !== requestedEscolaId) {
      return NextResponse.json({ ok: false, error: 'Acesso negado a esta escola.' }, { status: 403 });
    }

    const { data: hasAdminRole, error: rolesError } = await supabase
      .rpc('user_has_role_in_school', {
        p_escola_id: requestedEscolaId,
        p_roles: ['admin_escola', 'secretaria', 'admin'],
      });

    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
      return NextResponse.json({ ok: false, error: 'Erro ao verificar permissões.' }, { status: 500 });
    }

    let isProfessorAssigned = false;
    if (!hasAdminRole) {
      const { data: professor } = await supabase
        .from('professores')
        .select('id')
        .eq('profile_id', user.id)
        .eq('escola_id', effectiveEscolaId)
        .maybeSingle();
      const professorId = (professor as any)?.id as string | undefined;
      if (!professorId) {
        return NextResponse.json({ ok: false, error: 'Você não tem permissão para executar esta ação.' }, { status: 403 });
      }

      const { data: turmaDisciplina } = await supabase
        .from('turma_disciplinas')
        .select('id')
        .eq('escola_id', effectiveEscolaId)
        .eq('turma_id', turmaId)
        .eq('professor_id', professorId)
        .maybeSingle();
      isProfessorAssigned = Boolean(turmaDisciplina);

      if (!isProfessorAssigned) {
        const { data: tdp } = await supabase
          .from('turma_disciplinas_professores')
          .select('id')
          .eq('escola_id', effectiveEscolaId)
          .eq('turma_id', turmaId)
          .eq('professor_id', professorId)
          .maybeSingle();
        isProfessorAssigned = Boolean(tdp);
      }

      if (!isProfessorAssigned) {
        return NextResponse.json({ ok: false, error: 'Você não tem permissão para executar esta ação.' }, { status: 403 });
      }
    }

    const { data: statusRow, error } = await supabase
      .from('frequencia_status_periodo')
      .select('id')
      .eq('escola_id', effectiveEscolaId)
      .eq('turma_id', turmaId)
      .eq('periodo_letivo_id', periodoLetivoId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error checking fechamento status:', error);
      return NextResponse.json({ ok: false, error: 'Erro ao verificar fechamento.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, closed: Boolean(statusRow) }, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Error in fechar-periodo GET API:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let supabase: any = null;
  let outboxEventId: string | null = null;
  try {
    const { id: requestedEscolaId } = await params;
    supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const parse = Body.safeParse(await req.json().catch(() => ({})));
    if (!parse.success) {
      return NextResponse.json({ ok: false, error: 'Dados inválidos.', issues: parse.error.issues }, { status: 400 });
    }

    const idempotencyKey = req.headers.get('idempotency-key');
    if (!idempotencyKey) {
      return NextResponse.json({ ok: false, error: 'Idempotency-Key header is required' }, { status: 400 });
    }

    const { turma_id, periodo_letivo_id } = parse.data;

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, requestedEscolaId);
    const effectiveEscolaId = userEscolaId ?? requestedEscolaId;

    if (userEscolaId && userEscolaId !== requestedEscolaId) {
      return NextResponse.json({ ok: false, error: 'Acesso negado a esta escola.' }, { status: 403 });
    }

    const { data: hasAdminRole, error: rolesError } = await supabase
      .rpc('user_has_role_in_school', {
        p_escola_id: requestedEscolaId,
        p_roles: ['admin_escola', 'secretaria', 'admin'],
      });

    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
      return NextResponse.json({ ok: false, error: 'Erro ao verificar permissões.' }, { status: 500 });
    }

    let isProfessorAssigned = false;
    if (!hasAdminRole) {
      const { data: professor } = await supabase
        .from('professores')
        .select('id')
        .eq('profile_id', user.id)
        .eq('escola_id', effectiveEscolaId)
        .maybeSingle();
      const professorId = (professor as any)?.id as string | undefined;
      if (!professorId) {
        return NextResponse.json({ ok: false, error: 'Você não tem permissão para executar esta ação.' }, { status: 403 });
      }

      const { data: turmaDisciplina } = await supabase
        .from('turma_disciplinas')
        .select('id')
        .eq('escola_id', effectiveEscolaId)
        .eq('turma_id', turma_id)
        .eq('professor_id', professorId)
        .maybeSingle();
      isProfessorAssigned = Boolean(turmaDisciplina);

      if (!isProfessorAssigned) {
      const { data: tdp } = await supabase
        .from('turma_disciplinas_professores')
        .select('id')
        .eq('escola_id', effectiveEscolaId)
          .eq('turma_id', turma_id)
          .eq('professor_id', professorId)
          .maybeSingle();
        isProfessorAssigned = Boolean(tdp);
      }

    if (!isProfessorAssigned) {
      return NextResponse.json({ ok: false, error: 'Você não tem permissão para executar esta ação.' }, { status: 403 });
    }
  }

    // A lógica de negócio foi movida para a RPC `fechar_periodo_academico`.
    // A RPC irá travar tanto as frequências quanto as notas de forma atômica e auditada.
    const { error } = await supabase.rpc('fechar_periodo_academico', {
      p_escola_id: effectiveEscolaId,
      p_turma_id: turma_id,
      p_periodo_letivo_id: periodo_letivo_id,
    });

    if (error) {
      console.error('Error calling fechar_periodo_academico RPC:', error);
      return NextResponse.json({ ok: false, error: 'Erro ao fechar o período.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Error in fechar-periodo frequencias API:', message);
    if (supabase) {
      await markOutboxEventFailed(supabase, outboxEventId, message).catch(() => null);
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
