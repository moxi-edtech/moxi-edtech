import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServerTyped } from '@/lib/supabaseServer';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import { applyCurriculumPreset, type CurriculumKey } from '@/lib/academico/curriculum-apply';
import type { Database } from '~types/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const bodySchema = z.object({
  presetKey: z.string().min(1),
  anoLetivoId: z.string().uuid().optional(),
  ano_letivo_id: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  anoLetivo: z.number().int().optional(),
  customData: z
    .object({
      label: z.string().min(1),
      associatedPreset: z.string().min(1),
      classes: z.array(z.string()).optional(),
      subjects: z.array(z.string()).optional(),
    })
    .optional(),
  advancedConfig: z
    .object({
      classes: z.array(z.string()),
      subjects: z.array(z.string()),
      matrix: z.record(z.boolean()),
      turnos: z.object({ manha: z.boolean(), tarde: z.boolean(), noite: z.boolean() }),
      cargaByClass: z.record(z.number()).optional(),
    })
    .optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: requestedEscolaId } = await params;
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado', message: 'Não autenticado.' }, { status: 401 });
    }

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, requestedEscolaId);

    if (!userEscolaId || userEscolaId !== requestedEscolaId) {
      return NextResponse.json({ ok: false, error: 'Acesso negado a esta escola.', message: 'Acesso negado a esta escola.' }, { status: 403 });
    }

    const { data: hasRole, error: rolesError } = await supabase
      .rpc('user_has_role_in_school', {
        p_escola_id: userEscolaId,
        p_roles: ['admin_escola', 'secretaria', 'admin'],
      });

    if (rolesError) {
      return NextResponse.json({ ok: false, error: 'Erro ao verificar permissões.', message: 'Erro ao verificar permissões.' }, { status: 500 });
    }

    if (!hasRole) {
      return NextResponse.json({ ok: false, error: 'Você não tem permissão para executar esta ação.', message: 'Você não tem permissão para executar esta ação.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Dados inválidos.', message: 'Dados inválidos.', issues: parsed.error.issues }, { status: 400 });
    }

    const anoLetivoId = parsed.data.anoLetivoId
      ?? parsed.data.ano_letivo_id
      ?? parsed.data.sessionId
      ?? null;
    const anoLetivoAno = parsed.data.anoLetivo ?? null;

    const { data: anoAtivo, error: anoError } = await (anoLetivoId
      ? supabase.from('anos_letivos')
          .select('id, ano')
          .eq('escola_id', userEscolaId)
          .eq('id', anoLetivoId)
          .maybeSingle()
      : anoLetivoAno
        ? supabase.from('anos_letivos')
            .select('id, ano')
            .eq('escola_id', userEscolaId)
            .eq('ano', anoLetivoAno)
            .maybeSingle()
        : supabase.from('anos_letivos')
            .select('id, ano')
            .eq('escola_id', userEscolaId)
            .eq('ativo', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle());

    if (anoError || !anoAtivo?.id) {
      return NextResponse.json({ ok: false, error: 'Ano letivo ativo não encontrado.', message: 'Ano letivo ativo não encontrado.' }, { status: 400 });
    }

    const result = await applyCurriculumPreset({
      supabase,
      escolaId: userEscolaId,
      presetKey: parsed.data.presetKey as CurriculumKey,
      customData: parsed.data.customData as any,
      advancedConfig: parsed.data.advancedConfig as any,
      createTurmas: false,
      createCurriculo: true,
      anoLetivoId: anoAtivo.id,
    });

    return NextResponse.json({
      ok: true,
      data: {
        curso_curriculo_id: result.curriculo?.id ?? null,
        version: result.curriculo?.version ?? null,
        status: result.curriculo?.status ?? null,
        curso_id: result.curso.id,
        ano_letivo_id: anoAtivo.id,
        classes_count: result.counts.classes,
        disciplinas_count: result.counts.subjects,
        matriz_count: result.stats.matriz_rows,
      },
      message: 'Currículo aplicado com sucesso.',
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message, message: 'Falha ao aplicar currículo.' }, { status: 500 });
  }
}
