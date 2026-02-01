import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { supabaseServerTyped } from '@/lib/supabaseServer';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import type { Database } from '~types/supabase';

export const dynamic = 'force-dynamic';

const turmaSchema = z.object({
  classeId: z.string().uuid(),
  quantidade: z.number().int().min(1).max(10).optional().default(1),
});

const turmaTurnoSchema = z.object({
  classeId: z.string().uuid(),
  turno: z.enum(['M', 'T', 'N']),
  quantidade: z.number().int().min(1).max(10).optional().default(1),
});

const bodySchema = z.object({
  cursoId: z.string().uuid(),
  anoLetivo: z.number().int().min(2020).max(2050),
  turnos: z.array(z.enum(['M', 'T', 'N'])).optional(),
  classes: z.array(turmaSchema).optional(),
  turmas: z.array(turmaTurnoSchema).optional(),
  capacidadeMaxima: z.number().int().min(1).max(80).optional(),
});

const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: requestedEscolaId } = await params;
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, requestedEscolaId);

    if (!userEscolaId || userEscolaId !== requestedEscolaId) {
      return NextResponse.json({ ok: false, error: 'Acesso negado a esta escola.' }, { status: 403 });
    }

    const { data: hasRole, error: rolesError } = await supabase
      .rpc('user_has_role_in_school', {
        p_escola_id: userEscolaId,
        p_roles: ['admin_escola', 'secretaria', 'admin'],
      });

    if (rolesError) {
      return NextResponse.json({ ok: false, error: 'Erro ao verificar permissões.' }, { status: 500 });
    }

    if (!hasRole) {
      return NextResponse.json({ ok: false, error: 'Você não tem permissão para executar esta ação.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Dados inválidos.', issues: parsed.error.issues }, { status: 400 });
    }

    const { cursoId, anoLetivo, turnos, classes, turmas, capacidadeMaxima } = parsed.data;
    const idempotencyKey = req.headers.get('Idempotency-Key') ?? randomUUID();

    const { data: anoLetivoRow } = await supabase
      .from('anos_letivos')
      .select('id')
      .eq('escola_id', userEscolaId)
      .eq('ano', anoLetivo)
      .maybeSingle();

    if (!anoLetivoRow?.id) {
      return NextResponse.json({ ok: false, error: 'Ano letivo não encontrado.' }, { status: 400 });
    }

    const { data: published } = await supabase
      .from('curso_curriculos')
      .select('id')
      .eq('escola_id', userEscolaId)
      .eq('curso_id', cursoId)
      .eq('ano_letivo_id', anoLetivoRow.id)
      .eq('status', 'published')
      .limit(1);

    if (!published || published.length === 0) {
      return NextResponse.json({ ok: false, error: 'Currículo publicado não encontrado.' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('gerar_turmas_from_curriculo', {
      p_escola_id: userEscolaId,
      p_curso_id: cursoId,
      p_ano_letivo: anoLetivo,
      p_generation_params: JSON.parse(JSON.stringify(parsed.data)), // Pass generation params as JSONB
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      console.error('Error calling gerar_turmas_from_curriculo RPC:', error);
      return NextResponse.json({ ok: false, error: 'Erro ao gerar turmas.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data, idempotency_key: idempotencyKey });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
