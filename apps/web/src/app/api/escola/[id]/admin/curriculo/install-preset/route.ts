import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServerTyped } from '@/lib/supabaseServer';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import { applyCurriculumPreset, type CurriculumKey } from '@/lib/academico/curriculum-apply';
import { CURRICULUM_PRESETS, CURRICULUM_PRESETS_META } from '@/lib/academico/curriculum-presets';
import type { Database } from '~types/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const bodySchema = z.object({
  presetKey: z.string().min(1),
  ano_letivo_id: z.string().uuid().optional(),
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
    })
    .optional(),
  options: z
    .object({
      autoPublish: z.boolean().default(true),
      generateTurmas: z.boolean().default(true),
    })
    .optional()
    .default({ autoPublish: true, generateTurmas: true }),
});

const buildDefaultConfig = (presetKey: string) => {
  const meta = CURRICULUM_PRESETS_META[presetKey as CurriculumKey];
  const classes = (meta?.classes ?? []).filter(Boolean);
  const subjects = Array.from(
    new Set(
      (CURRICULUM_PRESETS[presetKey as CurriculumKey] ?? [])
        .map((d: any) => String(d?.nome ?? '').trim())
        .filter(Boolean)
    )
  );
  const turnos = { manha: true, tarde: false, noite: false };
  const matrix: Record<string, boolean> = {};
  for (const subject of subjects) {
    for (const cls of classes) {
      matrix[`${subject}::${cls}::M`] = true;
    }
  }

  return { classes, subjects, turnos, matrix };
};

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

    const { presetKey, ano_letivo_id, customData, advancedConfig, options } = parsed.data;
    const effectiveAnoLetivoId = ano_letivo_id ?? null;

    const { data: anoLetivo, error: anoError } = await (effectiveAnoLetivoId
      ? supabase
          .from('anos_letivos')
          .select('id, ano, ativo')
          .eq('escola_id', userEscolaId)
          .eq('id', effectiveAnoLetivoId)
          .maybeSingle()
      : supabase
          .from('anos_letivos')
          .select('id, ano, ativo')
          .eq('escola_id', userEscolaId)
          .order('ativo', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle());

    if (anoError || !anoLetivo?.id) {
      return NextResponse.json({ ok: false, error: 'Ano letivo não encontrado.', message: 'Ano letivo não encontrado.' }, { status: 400 });
    }

    const presetMeta = CURRICULUM_PRESETS_META[presetKey as CurriculumKey];
    if (!presetMeta?.course_code) {
      return NextResponse.json({ ok: false, error: 'Preset inválido.', message: 'Preset inválido.' }, { status: 400 });
    }

    const { error: lockError } = await supabase
      .rpc('lock_curriculo_install', {
        p_escola_id: userEscolaId,
        p_preset_key: presetKey,
        p_ano_letivo_id: anoLetivo.id,
      });

    if (lockError) {
      return NextResponse.json({ ok: false, error: 'Falha ao iniciar instalação.', message: 'Falha ao iniciar instalação.' }, { status: 500 });
    }

    const courseCode = presetMeta.course_code.trim().toUpperCase();
    const { data: cursoExistente } = await supabase
      .from('cursos')
      .select('id, nome')
      .eq('escola_id', userEscolaId)
      .or(`codigo.eq.${courseCode},course_code.eq.${courseCode}`)
      .maybeSingle();

    let publishedExists = false;
    if (cursoExistente?.id) {
      const { data: published } = await supabase
        .from('curso_curriculos')
        .select('id')
        .eq('escola_id', userEscolaId)
        .eq('curso_id', cursoExistente.id)
        .eq('ano_letivo_id', effectiveAnoLetivoId ?? anoLetivo.id)
        .eq('status', 'published')
        .limit(1);
      publishedExists = Boolean(published && published.length > 0);
    }

    let applyResult = null as Awaited<ReturnType<typeof applyCurriculumPreset>> | null;
    if (!publishedExists) {
      try {
        applyResult = await applyCurriculumPreset({
          supabase,
          escolaId: userEscolaId,
          presetKey: presetKey as CurriculumKey,
          customData: customData as any,
          advancedConfig: advancedConfig ?? buildDefaultConfig(presetKey),
          createTurmas: false,
          createCurriculo: true,
          anoLetivoId: anoLetivo.id,
          anoLetivo: anoLetivo.ano,
        });
      } catch (applyError) {
        const message = applyError instanceof Error ? applyError.message : String(applyError);
        return NextResponse.json({
          ok: false,
          step: 'apply',
          error: message,
          message,
        }, { status: 400 });
      }
    }

    const cursoId = applyResult?.curso.id ?? cursoExistente?.id ?? null;
    if (!cursoId) {
      return NextResponse.json({ ok: false, error: 'Curso não resolvido.', message: 'Curso não resolvido.' }, { status: 500 });
    }

    let publishResult: any = null;
    if (options.autoPublish && applyResult?.curriculo) {
      const { data: publishData, error: publishError } = await supabase
        .rpc('curriculo_publish', {
          p_escola_id: userEscolaId,
          p_curso_id: cursoId,
          p_ano_letivo_id: anoLetivo.id,
          p_version: applyResult.curriculo.version,
          p_rebuild_turmas: false,
        });

      if (publishError) {
        return NextResponse.json({
          ok: false,
          step: 'publish',
          error: publishError.message,
          message: 'Falha ao publicar currículo.',
        }, { status: 409 });
      }

      publishResult = Array.isArray(publishData) ? publishData[0] : publishData;
      if (!publishResult?.ok) {
        return NextResponse.json({
          ok: false,
          step: 'publish',
          error: publishResult?.message || 'Falha ao publicar currículo.',
          message: 'Falha ao publicar currículo.',
        }, { status: 409 });
      }
    }

    let turmasResult: any = null;
    if (options.generateTurmas) {
      const { count: turmasExistentes } = await supabase
        .from('turmas')
        .select('id', { count: 'exact', head: true })
        .eq('escola_id', userEscolaId)
        .eq('curso_id', cursoId)
        .eq('ano_letivo', anoLetivo.ano);

      if (!turmasExistentes || turmasExistentes === 0) {
        const configToUse = advancedConfig ?? buildDefaultConfig(presetKey);
        const { data: classesRows } = await supabase
          .from('classes')
          .select('id, nome')
          .eq('escola_id', userEscolaId)
          .eq('curso_id', cursoId)
          .in('nome', configToUse.classes);

        const classesPayload = (classesRows || []).map((cls) => ({
          classeId: cls.id,
          quantidade: 1,
        }));
        const turnosPayload = [
          configToUse.turnos.manha ? 'M' : null,
          configToUse.turnos.tarde ? 'T' : null,
          configToUse.turnos.noite ? 'N' : null,
        ].filter(Boolean);

        const origin = new URL(req.url).origin;
        const res = await fetch(`${origin}/api/escola/${userEscolaId}/admin/turmas/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            cookie: req.headers.get('cookie') ?? '',
          },
          body: JSON.stringify({
            cursoId: cursoId,
            anoLetivo: anoLetivo.ano,
            classes: classesPayload,
            turnos: turnosPayload,
          }),
        });

        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          return NextResponse.json({
            ok: false,
            step: 'generate_turmas',
            error: json?.error || 'Falha ao gerar turmas.',
            message: 'Falha ao gerar turmas.',
          }, { status: 409 });
        }
        turmasResult = json;
      } else {
        turmasResult = { ok: true, skipped: true, message: 'Turmas já existentes.' };
      }
    }

    return NextResponse.json({
      ok: true,
      presetKey,
      ano_letivo_id: anoLetivo.id,
      applied: applyResult ? {
        curso_id: applyResult.curso.id,
        curso_curriculo_id: applyResult.curriculo?.id ?? null,
        version: applyResult.curriculo?.version ?? null,
        status: applyResult.curriculo?.status ?? null,
      } : { skipped: true, reason: 'already_published' },
      publish: publishResult,
      turmas: turmasResult,
      message: 'Instalação concluída com sucesso.',
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
