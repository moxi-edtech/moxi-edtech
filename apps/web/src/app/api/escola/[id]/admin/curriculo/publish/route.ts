import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { supabaseServerTyped } from '@/lib/supabaseServer';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import type { Database } from '~types/supabase';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  cursoId: z.string().uuid(),
  anoLetivoId: z.string().uuid(),
  version: z.number().int().min(1),
  rebuildTurmas: z.boolean().optional().default(true),
});

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

    const { cursoId, anoLetivoId, version, rebuildTurmas } = parsed.data;
    const idempotencyKey = req.headers.get('Idempotency-Key') ?? randomUUID();

    const { data, error } = await supabase.rpc('curriculo_publish', {
      p_escola_id: userEscolaId,
      p_curso_id: cursoId,
      p_ano_letivo_id: anoLetivoId,
      p_version: version,
      p_rebuild_turmas: rebuildTurmas,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.ok) {
      return NextResponse.json({
        ok: false,
        error: result?.message || 'Falha ao publicar currículo.',
        pendencias: result?.pendencias ?? [],
        pendencias_count: result?.pendencias_count ?? 0,
      }, { status: 400 });
    }

    return NextResponse.json({ ok: true, data: result, idempotency_key: idempotencyKey });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
