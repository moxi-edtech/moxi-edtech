import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { supabaseServerTyped } from '@/lib/supabaseServer';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import { emitirEvento } from '@/lib/eventos/emitirEvento';
import type { Database } from '~types/supabase';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  cursoId: z.string().uuid(),
  anoLetivoId: z.string().uuid(),
  version: z.number().int().min(1),
  rebuildTurmas: z.boolean().optional().default(true),
  autoGenerateTurmas: z.boolean().optional().default(true),
  classeId: z.string().uuid().optional().nullable(),
  bulk: z.boolean().optional().default(false),
});

const pendenciaMessages: Record<string, string> = {
  carga_horaria_semanal: "A carga horária semanal está faltando na disciplina",
  classificacao: "A classificação (core/complementar) está faltando na disciplina",
  periodos_ativos: "Os períodos ativos (1º/2º/3º) estão faltando na disciplina",
  entra_no_horario: "O campo 'entra no horário' está faltando na disciplina",
  avaliacao_mode: "O modo de avaliação está faltando na disciplina",
  avaliacao_modelo_id: "Selecione um modelo de avaliação personalizado para a disciplina",
  avaliacao_disciplina_id: "Selecione a disciplina base para herdar avaliação",
  avaliacao_pesos: "Os pesos do modelo de avaliação não somam 100%",
};

const buildPendenciasMessage = (args: {
  pendencias: Array<{
    disciplina_id?: string | null;
    classe_id?: string | null;
    curso_matriz_id?: string | null;
    disciplina_nome?: string | null;
    classe_nome?: string | null;
    pendencias?: string[];
  }>;
  disciplinaById: Map<string, string>;
  classeById: Map<string, string>;
  matrizById: Map<string, { disciplinaId?: string | null; classeId?: string | null; disciplinaNome?: string | null; classeNome?: string | null }>;
}) => {
  const { pendencias, disciplinaById, classeById, matrizById } = args;
  const first = pendencias.find((p) => p?.pendencias && p.pendencias.length > 0);
  if (!first) return null;
  const pendenciaKey = first.pendencias?.[0];
  if (!pendenciaKey) return null;
  const base = pendenciaMessages[pendenciaKey] ?? "Metadados obrigatórios estão faltando na disciplina";
  const matriz = first.curso_matriz_id ? matrizById.get(first.curso_matriz_id) : null;
  const disciplinaId = first.disciplina_id ?? matriz?.disciplinaId ?? null;
  const classeId = first.classe_id ?? matriz?.classeId ?? null;
  const disciplina =
    first.disciplina_nome ??
    (disciplinaId
      ? disciplinaById.get(disciplinaId) ?? matriz?.disciplinaNome ?? null
      : matriz?.disciplinaNome ?? null);
  const classe =
    first.classe_nome ??
    (classeId
      ? classeById.get(classeId) ?? matriz?.classeNome ?? null
      : matriz?.classeNome ?? null);
  if (disciplina && classe) {
    return `${base} (${disciplina} · ${classe}). Por favor, adicione para continuar.`;
  }
  if (disciplina) {
    return `${base} (${disciplina}). Por favor, adicione para continuar.`;
  }
  if (classe) {
    return `${base} (na classe ${classe}). Por favor, adicione para continuar.`;
  }
  return `${base}. Por favor, adicione para continuar.`;
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

    const { cursoId, anoLetivoId, version, rebuildTurmas, autoGenerateTurmas, classeId, bulk } = parsed.data;
    const idempotencyKey = req.headers.get('Idempotency-Key') ?? randomUUID();

    const { data, error } = await supabase.rpc('curriculo_publish', {
      p_escola_id: userEscolaId,
      p_curso_id: cursoId,
      p_ano_letivo_id: anoLetivoId,
      p_version: version,
      p_rebuild_turmas: rebuildTurmas,
      p_classe_id: bulk ? null : (classeId ?? null),
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.ok) {
      const pendencias = (result?.pendencias ?? []) as Array<{
        curso_matriz_id?: string | null;
        disciplina_id?: string | null;
        classe_id?: string | null;
        pendencias?: string[];
      }>;
      const disciplinaIds = Array.from(
        new Set(pendencias.map((p) => p.disciplina_id).filter(Boolean) as string[])
      );
      const classeIds = Array.from(
        new Set(pendencias.map((p) => p.classe_id).filter(Boolean) as string[])
      );
      const matrizIds = Array.from(
        new Set(pendencias.map((p) => p.curso_matriz_id).filter(Boolean) as string[])
      );

      const { data: matrizRows } = matrizIds.length
        ? await supabase
            .from('curso_matriz')
            .select('id, disciplina_id, classe_id, disciplinas_catalogo!curso_matriz_disciplina_id_fkey(nome), classes!curso_matriz_classe_id_fkey(nome)')
            .in('id', matrizIds)
        : { data: [] };

      const matrizDisciplinaIds = Array.from(
        new Set((matrizRows ?? []).map((row: any) => row?.disciplina_id).filter(Boolean))
      ) as string[];
      const matrizClasseIds = Array.from(
        new Set((matrizRows ?? []).map((row: any) => row?.classe_id).filter(Boolean))
      ) as string[];

      const disciplinaIdsResolved = disciplinaIds.length > 0
        ? disciplinaIds
        : matrizDisciplinaIds;
      const classeIdsResolved = classeIds.length > 0
        ? classeIds
        : matrizClasseIds;

      const { data: disciplinasRows } = disciplinaIdsResolved.length
        ? await supabase
            .from('disciplinas_catalogo')
            .select('id, nome')
            .in('id', disciplinaIdsResolved)
        : { data: [] };
      const { data: classesRows } = classeIdsResolved.length
        ? await supabase
            .from('classes')
            .select('id, nome')
            .in('id', classeIdsResolved)
        : { data: [] };

      const disciplinaById = new Map(
        (disciplinasRows ?? []).map((row: any) => [row.id, row.nome])
      );
      const classeById = new Map(
        (classesRows ?? []).map((row: any) => [row.id, row.nome])
      );
      const matrizById = new Map<
        string,
        {
          disciplinaId?: string | null;
          classeId?: string | null;
          disciplinaNome?: string | null;
          classeNome?: string | null;
        }
      >();

      (matrizRows ?? []).forEach((row: any) => {
        matrizById.set(row.id, {
          disciplinaId: row.disciplina_id ?? null,
          classeId: row.classe_id ?? null,
          disciplinaNome: row.disciplinas_catalogo?.nome ?? null,
          classeNome: row.classes?.nome ?? null,
        });

        if (row?.disciplina_id && row?.disciplinas_catalogo?.nome) {
          if (!disciplinaById.has(row.disciplina_id)) {
            disciplinaById.set(row.disciplina_id, row.disciplinas_catalogo.nome);
          }
        }
        if (row?.classe_id && row?.classes?.nome) {
          if (!classeById.has(row.classe_id)) {
            classeById.set(row.classe_id, row.classes.nome);
          }
        }
      });

      (matrizRows ?? []).forEach((row: any) => {
        if (row?.classe_id && row?.classe_id && row?.classe_id && row?.classe_id) {
          return;
        }
      });

      (matrizRows ?? []).forEach((row: any) => {
        if (!row?.classe_id || classeById.has(row.classe_id)) return;
        classeById.set(row.classe_id, row.classe_id);
      });
      const firstPendencia = pendencias.find((p) => p?.pendencias && p.pendencias.length > 0);
      if (firstPendencia?.curso_matriz_id) {
        const matrizInfo = matrizById.get(firstPendencia.curso_matriz_id);
        const disciplinaId = firstPendencia.disciplina_id ?? matrizInfo?.disciplinaId ?? null;
        const classeId = firstPendencia.classe_id ?? matrizInfo?.classeId ?? null;
        const missingDisciplina = disciplinaId && !disciplinaById.has(disciplinaId);
        const missingClasse = classeId && !classeById.has(classeId);

        if (missingDisciplina || missingClasse || !matrizInfo) {
          const { data: matrizSingle } = await supabase
            .from('curso_matriz')
            .select('id, disciplina_id, classe_id, disciplinas_catalogo!curso_matriz_disciplina_id_fkey(nome), classes!curso_matriz_classe_id_fkey(nome)')
            .eq('id', firstPendencia.curso_matriz_id)
            .maybeSingle();
          if (matrizSingle?.disciplina_id && matrizSingle?.disciplinas_catalogo?.nome) {
            disciplinaById.set(matrizSingle.disciplina_id, matrizSingle.disciplinas_catalogo.nome);
          }
          if (matrizSingle?.classe_id && matrizSingle?.classes?.nome) {
            classeById.set(matrizSingle.classe_id, matrizSingle.classes.nome);
          }
          matrizById.set(firstPendencia.curso_matriz_id, {
            disciplinaId: matrizSingle?.disciplina_id ?? null,
            classeId: matrizSingle?.classe_id ?? null,
            disciplinaNome: matrizSingle?.disciplinas_catalogo?.nome ?? null,
            classeNome: matrizSingle?.classes?.nome ?? null,
          });
        }

        if (disciplinaId && !disciplinaById.has(disciplinaId)) {
          const { data: disciplinaSingle } = await supabase
            .from('disciplinas_catalogo')
            .select('id, nome')
            .eq('id', disciplinaId)
            .maybeSingle();
          if (disciplinaSingle?.id && disciplinaSingle?.nome) {
            disciplinaById.set(disciplinaSingle.id, disciplinaSingle.nome);
          }
        }

        if (classeId && !classeById.has(classeId)) {
          const { data: classeSingle } = await supabase
            .from('classes')
            .select('id, nome')
            .eq('id', classeId)
            .maybeSingle();
          if (classeSingle?.id && classeSingle?.nome) {
            classeById.set(classeSingle.id, classeSingle.nome);
          }
        }
      }

      const pendenciasDetalhadas = pendencias.map((item) => {
        const matriz = item.curso_matriz_id ? matrizById.get(item.curso_matriz_id) : null;
        const disciplinaId = item.disciplina_id ?? matriz?.disciplinaId ?? null;
        const classeId = item.classe_id ?? matriz?.classeId ?? null;
        const disciplinaNome = disciplinaId
          ? disciplinaById.get(disciplinaId) ?? matriz?.disciplinaNome ?? null
          : matriz?.disciplinaNome ?? null;
        const classeNome = classeId
          ? classeById.get(classeId) ?? matriz?.classeNome ?? null
          : matriz?.classeNome ?? null;

        return {
          ...item,
          disciplina_nome: disciplinaNome,
          classe_nome: classeNome,
        };
      });

      const friendlyMessage = buildPendenciasMessage({
        pendencias: pendenciasDetalhadas,
        disciplinaById,
        classeById,
        matrizById,
      });

      emitirEvento(supabase, {
        escola_id: userEscolaId,
        tipo: 'curriculo.publish_failed',
        payload: {
          curso_id: cursoId,
          ano_letivo_id: anoLetivoId,
          version,
          classe_id: bulk ? null : (classeId ?? null),
          message: friendlyMessage || result?.message || 'Falha ao publicar currículo.',
          pendencias: pendenciasDetalhadas,
          pendencias_count: result?.pendencias_count ?? 0,
        },
        actor_id: user.id,
        actor_role: 'admin',
        entidade_tipo: 'curriculo',
        entidade_id: null,
      }).catch(() => null);
      return NextResponse.json({
        ok: false,
        error: friendlyMessage || result?.message || 'Falha ao publicar currículo.',
        pendencias: pendenciasDetalhadas,
        pendencias_count: result?.pendencias_count ?? 0,
      }, { status: 400 });
    }

    emitirEvento(supabase, {
      escola_id: userEscolaId,
      tipo: 'curriculo.published',
      payload: {
        curso_id: cursoId,
        ano_letivo_id: anoLetivoId,
        version,
        classe_id: bulk ? null : (classeId ?? null),
        rebuild_turmas: rebuildTurmas,
        pendencias_count: result?.pendencias_count ?? 0,
      },
      actor_id: user.id,
      actor_role: 'admin',
      entidade_tipo: 'curriculo',
      entidade_id: result?.published_curriculo_id ?? null,
    }).catch(() => null);

    const shouldGenerateTurmas = rebuildTurmas || autoGenerateTurmas;

    if (shouldGenerateTurmas) {
      const { count: turmasCount } = await supabase
        .from('turmas')
        .select('id', { count: 'estimated', head: true })
        .eq('escola_id', userEscolaId)
        .eq('curso_id', cursoId)
        .eq('ano_letivo_id', anoLetivoId);

      if (!turmasCount || turmasCount === 0) {
        const { data: anoLetivoRow } = await supabase
          .from('anos_letivos')
          .select('ano')
          .eq('escola_id', userEscolaId)
          .eq('id', anoLetivoId)
          .maybeSingle();
        if (anoLetivoRow?.ano) {
          const { data: classes } = await supabase
            .from('classes')
            .select('id, turno')
            .eq('escola_id', userEscolaId)
            .eq('curso_id', cursoId);
          const resolvedClasses = (classes || []).map((row: any) => ({
            classeId: row.id,
            quantidade: 1,
          }));
          const classTurnos = (classes || [])
            .map((row: any) => (row.turno || '').toString().trim().toUpperCase())
            .filter(Boolean);
          const resolvedTurnos = classTurnos.length > 0
            ? Array.from(new Set(classTurnos))
            : ['M'];

          const { error: genError } = await supabase.rpc('gerar_turmas_from_curriculo', {
            p_escola_id: userEscolaId,
            p_curso_id: cursoId,
            p_ano_letivo: anoLetivoRow.ano,
            p_generation_params: {
              cursoId,
              anoLetivo: anoLetivoRow.ano,
              classes: resolvedClasses,
              turnos: resolvedTurnos,
            },
            p_idempotency_key: idempotencyKey,
          });

          if (!genError) {
            try {
              await (supabase as any).rpc('refresh_mv_turmas_para_matricula');
            } catch (refreshErr) {
              console.warn('Falha ao atualizar mv_turmas_para_matricula:', refreshErr);
            }
          }
        }
      }
    }

    return NextResponse.json({ ok: true, data: result, idempotency_key: idempotencyKey });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
