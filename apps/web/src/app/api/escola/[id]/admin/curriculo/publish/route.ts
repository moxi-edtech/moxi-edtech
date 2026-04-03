import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { supabaseServerTyped } from '@/lib/supabaseServer';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import { emitirEvento } from '@/lib/eventos/emitirEvento';
import { dispatchProfessorNotificacao } from '@/lib/notificacoes/dispatchProfessorNotificacao';
import { buildSyncTurmasSummary, requiresNoRebuildConfirmation } from '@/lib/academico/curriculo-operacao';
import type { Database } from '~types/supabase';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  cursoId: z.string().uuid(),
  anoLetivoId: z.string().uuid(),
  version: z.number().int().min(1),
  rebuildTurmas: z.boolean().optional().default(true),
  confirmNoRebuildWithExistingTurmas: z.boolean().optional().default(false),
  autoGenerateTurmas: z.boolean().optional().default(true),
  syncMode: z.enum(['additive', 'reconcile']).optional().default('additive'),
  confirmReconcileSync: z.boolean().optional().default(false),
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

type SyncMode = 'additive' | 'reconcile';

type ObsoleteTurmaDisciplinaRow = {
  id: string;
  turma_id: string;
  curso_matriz_id: string | null;
  disciplina_id: string | null;
};

type SyncExistingTurmasResult = {
  ok: boolean;
  executed: boolean;
  attempted: number;
  inserted: number;
  updated: number;
  skipped_duplicates: number;
  turmas_scanned: number;
  matriz_rows: number;
  sync_mode: SyncMode;
  reconcile_confirmed: boolean;
  obsolete_count: number;
  obsolete_sample: Array<{ turma_id: string; turma_disciplina_id: string; curso_matriz_id: string | null; disciplina_id: string | null }>;
  reconcile_removed: number;
  reconcile_blocked: number;
  reconcile_pending_confirmation: boolean;
  skipped_reason: string | null;
  error?: string | null;
};

async function syncPublishedMatrizToExistingTurmas(args: {
  supabase: any;
  escolaId: string;
  cursoId: string;
  anoLetivoId: string;
  syncMode: SyncMode;
  confirmReconcileSync: boolean;
}): Promise<SyncExistingTurmasResult> {
  const { supabase, escolaId, cursoId, anoLetivoId, syncMode, confirmReconcileSync } = args;

  const { data: turmasRows, error: turmasErr } = await supabase
    .from('turmas')
    .select('id, classe_id')
    .eq('escola_id', escolaId)
    .eq('curso_id', cursoId)
    .eq('ano_letivo_id', anoLetivoId);
  if (turmasErr) throw new Error(turmasErr.message || 'Falha ao carregar turmas para sincronização.');

  const turmas = (turmasRows || [])
    .filter((row: any) => row?.id && row?.classe_id)
    .map((row: any) => ({ id: String(row.id), classe_id: String(row.classe_id) }));
  if (turmas.length === 0) {
    return {
      ok: true,
      executed: false,
      attempted: 0,
      inserted: 0,
      updated: 0,
      skipped_duplicates: 0,
      turmas_scanned: 0,
      matriz_rows: 0,
      sync_mode: syncMode,
      reconcile_confirmed: confirmReconcileSync,
      obsolete_count: 0,
      obsolete_sample: [],
      reconcile_removed: 0,
      reconcile_blocked: 0,
      reconcile_pending_confirmation: false,
      skipped_reason: 'no_existing_turmas',
    };
  }

  const { data: publishedCurriculos, error: currErr } = await supabase
    .from('curso_curriculos')
    .select('id, classe_id')
    .eq('escola_id', escolaId)
    .eq('curso_id', cursoId)
    .eq('ano_letivo_id', anoLetivoId)
    .eq('status', 'published');
  if (currErr) throw new Error(currErr.message || 'Falha ao carregar currículos publicados.');

  const publishedByClasse = new Map<string, string[]>();
  for (const row of publishedCurriculos || []) {
    if (!row?.id || !row?.classe_id) continue;
    const key = String(row.classe_id);
    const arr = publishedByClasse.get(key) ?? [];
    arr.push(String(row.id));
    publishedByClasse.set(key, arr);
  }
  if (publishedByClasse.size === 0) {
    return {
      ok: true,
      executed: false,
      attempted: 0,
      inserted: 0,
      updated: 0,
      skipped_duplicates: 0,
      turmas_scanned: turmas.length,
      matriz_rows: 0,
      sync_mode: syncMode,
      reconcile_confirmed: confirmReconcileSync,
      obsolete_count: 0,
      obsolete_sample: [],
      reconcile_removed: 0,
      reconcile_blocked: 0,
      reconcile_pending_confirmation: false,
      skipped_reason: 'no_published_curriculo',
    };
  }

  const curriculoIds = Array.from(new Set(Array.from(publishedByClasse.values()).flat()));
  const { data: matrizRows, error: matrizErr } = await supabase
    .from('curso_matriz')
    .select('id, classe_id')
    .eq('escola_id', escolaId)
    .eq('curso_id', cursoId)
    .eq('ativo', true)
    .in('curso_curriculo_id', curriculoIds);
  if (matrizErr) throw new Error(matrizErr.message || 'Falha ao carregar matriz publicada.');

  const matrizByClasse = new Map<string, string[]>();
  for (const row of matrizRows || []) {
    if (!row?.id || !row?.classe_id) continue;
    const key = String(row.classe_id);
    const arr = matrizByClasse.get(key) ?? [];
    arr.push(String(row.id));
    matrizByClasse.set(key, arr);
  }

  const insertsRaw: Array<{ escola_id: string; turma_id: string; curso_matriz_id: string; professor_id: null }> = [];
  for (const turma of turmas) {
    const matrizIds = matrizByClasse.get(turma.classe_id) ?? [];
    for (const cursoMatrizId of matrizIds) {
      insertsRaw.push({
        escola_id: escolaId,
        turma_id: turma.id,
        curso_matriz_id: cursoMatrizId,
        professor_id: null,
      });
    }
  }

  const dedupMap = new Map<string, { escola_id: string; turma_id: string; curso_matriz_id: string; professor_id: null }>();
  for (const row of insertsRaw) {
    dedupMap.set(`${row.escola_id}:${row.turma_id}:${row.curso_matriz_id}`, row);
  }
  const inserts = Array.from(dedupMap.values());
  const skippedDuplicates = Math.max(0, insertsRaw.length - inserts.length);

  if (inserts.length === 0) {
    return {
      ok: true,
      executed: false,
      attempted: 0,
      inserted: 0,
      updated: 0,
      skipped_duplicates: skippedDuplicates,
      turmas_scanned: turmas.length,
      matriz_rows: (matrizRows || []).length,
      sync_mode: syncMode,
      reconcile_confirmed: confirmReconcileSync,
      obsolete_count: 0,
      obsolete_sample: [],
      reconcile_removed: 0,
      reconcile_blocked: 0,
      reconcile_pending_confirmation: false,
      skipped_reason: 'no_matriz_rows_for_existing_classes',
    };
  }

  const desiredKeySet = new Set(inserts.map((row) => `${row.escola_id}:${row.turma_id}:${row.curso_matriz_id}`));
  const turmaIds = Array.from(new Set(inserts.map((row) => row.turma_id)));
  const cursoMatrizIds = Array.from(new Set(inserts.map((row) => row.curso_matriz_id)));
  const { data: existingRows, error: existingErr } = await supabase
    .from('turma_disciplinas')
    .select('turma_id, curso_matriz_id')
    .eq('escola_id', escolaId)
    .in('turma_id', turmaIds)
    .in('curso_matriz_id', cursoMatrizIds);
  if (existingErr) throw new Error(existingErr.message || 'Falha ao mapear vínculos existentes de turma_disciplinas.');

  const existingKeySet = new Set<string>();
  for (const row of existingRows || []) {
    if (!row?.turma_id || !row?.curso_matriz_id) continue;
    existingKeySet.add(`${escolaId}:${row.turma_id}:${row.curso_matriz_id}`);
  }

  const { data: existingTurmaDisciplinasRows, error: existingTdErr } = await supabase
    .from('turma_disciplinas')
    .select('id, turma_id, curso_matriz_id, disciplina_id')
    .eq('escola_id', escolaId)
    .in('turma_id', turmaIds);
  if (existingTdErr) throw new Error(existingTdErr.message || 'Falha ao carregar turma_disciplinas para detectar obsoletas.');

  const obsoleteCandidates = (existingTurmaDisciplinasRows || [])
    .filter((row: any) => row?.id && row?.turma_id && !desiredKeySet.has(`${escolaId}:${row.turma_id}:${row.curso_matriz_id}`))
    .map((row: any) => ({
      id: String(row.id),
      turma_id: String(row.turma_id),
      curso_matriz_id: row?.curso_matriz_id ? String(row.curso_matriz_id) : null,
      disciplina_id: row?.disciplina_id ? String(row.disciplina_id) : null,
    })) as ObsoleteTurmaDisciplinaRow[];

  const obsoleteSample = obsoleteCandidates.slice(0, 20).map((row) => ({
    turma_id: row.turma_id,
    turma_disciplina_id: row.id,
    curso_matriz_id: row.curso_matriz_id,
    disciplina_id: row.disciplina_id,
  }));

  const attempted = inserts.length;
  const updated = inserts.reduce((acc, row) => acc + (existingKeySet.has(`${row.escola_id}:${row.turma_id}:${row.curso_matriz_id}`) ? 1 : 0), 0);
  const inserted = Math.max(0, attempted - updated);

  const { error: upErr } = await supabase
    .from('turma_disciplinas')
    .upsert(inserts, {
      onConflict: 'escola_id,turma_id,curso_matriz_id',
      ignoreDuplicates: true,
    });
  if (upErr) throw new Error(upErr.message || 'Falha ao sincronizar turma_disciplinas.');

  let reconcileRemoved = 0;
  let reconcileBlocked = 0;
  let reconcilePendingConfirmation = false;
  if (syncMode === 'reconcile' && obsoleteCandidates.length > 0) {
    if (!confirmReconcileSync) {
      reconcilePendingConfirmation = true;
    } else {
      const obsoleteIds = obsoleteCandidates.map((row) => row.id);
      const { data: avaliacaoRows, error: avalErr } = await supabase
        .from('avaliacoes')
        .select('turma_disciplina_id')
        .eq('escola_id', escolaId)
        .in('turma_disciplina_id', obsoleteIds);
      if (avalErr) throw new Error(avalErr.message || 'Falha ao verificar dependências de avaliações.');
      const avalBlocked = new Set((avaliacaoRows || []).map((row: any) => String(row.turma_disciplina_id)));

      const { data: aulaRows, error: aulaErr } = await supabase
        .from('aulas')
        .select('turma_disciplina_id')
        .eq('escola_id', escolaId)
        .in('turma_disciplina_id', obsoleteIds);
      if (aulaErr) throw new Error(aulaErr.message || 'Falha ao verificar dependências de aulas.');
      const aulaBlocked = new Set((aulaRows || []).map((row: any) => String(row.turma_disciplina_id)));

      const obsoleteDisciplinaIds = Array.from(new Set(obsoleteCandidates.map((row) => row.disciplina_id).filter(Boolean))) as string[];
      let alocacaoBlocked = new Set<string>();
      if (obsoleteDisciplinaIds.length > 0) {
        const { data: tdpRows, error: tdpErr } = await supabase
          .from('turma_disciplinas_professores')
          .select('turma_id, disciplina_id')
          .eq('escola_id', escolaId)
          .in('turma_id', turmaIds)
          .in('disciplina_id', obsoleteDisciplinaIds);
        if (tdpErr) throw new Error(tdpErr.message || 'Falha ao verificar dependências de alocação docente.');

        const blockedPairs = new Set((tdpRows || []).map((row: any) => `${row.turma_id}:${row.disciplina_id}`));
        alocacaoBlocked = new Set(
          obsoleteCandidates
            .filter((row) => row.disciplina_id && blockedPairs.has(`${row.turma_id}:${row.disciplina_id}`))
            .map((row) => row.id)
        );
      }

      const safeToDeleteIds = obsoleteCandidates
        .filter((row) => !avalBlocked.has(row.id) && !aulaBlocked.has(row.id) && !alocacaoBlocked.has(row.id))
        .map((row) => row.id);
      reconcileBlocked = Math.max(0, obsoleteCandidates.length - safeToDeleteIds.length);

      if (safeToDeleteIds.length > 0) {
        const { error: delErr } = await supabase
          .from('turma_disciplinas')
          .delete()
          .eq('escola_id', escolaId)
          .in('id', safeToDeleteIds);
        if (delErr) throw new Error(delErr.message || 'Falha ao remover vínculos obsoletos no modo reconcile.');
        reconcileRemoved = safeToDeleteIds.length;
      }
    }
  }

  return {
    ok: true,
    executed: true,
    attempted,
    inserted,
    updated,
    skipped_duplicates: skippedDuplicates,
    turmas_scanned: turmas.length,
    matriz_rows: (matrizRows || []).length,
    sync_mode: syncMode,
    reconcile_confirmed: confirmReconcileSync,
    obsolete_count: obsoleteCandidates.length,
    obsolete_sample: obsoleteSample,
    reconcile_removed: reconcileRemoved,
    reconcile_blocked: reconcileBlocked,
    reconcile_pending_confirmation: reconcilePendingConfirmation,
    skipped_reason: null,
  };
}

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
        p_roles: ['admin_escola'],
      });

    if (rolesError) {
      return NextResponse.json({ ok: false, error: 'Erro ao verificar permissões.' }, { status: 500 });
    }

    if (!hasRole) {
      return NextResponse.json({
        ok: false,
        error: 'Permissão insuficiente para publicar currículo.',
        message: 'A publicação de currículo requer papel admin_escola nesta escola.',
        code: 'ADMIN_ESCOLA_REQUIRED',
      }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Dados inválidos.', issues: parsed.error.issues }, { status: 400 });
    }

    const {
      cursoId,
      anoLetivoId,
      version,
      rebuildTurmas,
      confirmNoRebuildWithExistingTurmas,
      autoGenerateTurmas,
      syncMode,
      confirmReconcileSync,
      classeId,
      bulk,
    } = parsed.data;
    const idempotencyKey = req.headers.get('Idempotency-Key') ?? randomUUID();

    const { count: turmasExistentesAntes } = await supabase
      .from('turmas')
      .select('id', { count: 'estimated', head: true })
      .eq('escola_id', userEscolaId)
      .eq('curso_id', cursoId)
      .eq('ano_letivo_id', anoLetivoId);

    const existingTurmasCount = Number(turmasExistentesAntes ?? 0);
    if (requiresNoRebuildConfirmation({
      rebuildTurmas,
      existingTurmasCount,
      confirmNoRebuildWithExistingTurmas,
    })) {
      return NextResponse.json({
        ok: false,
        code: 'CURRICULO_REBUILD_CONFIRM_REQUIRED',
        error: 'Existem turmas já criadas. Confirme publicação sem reconstrução para continuar.',
        details: {
          existing_turmas: existingTurmasCount,
          requested_rebuild: rebuildTurmas,
          action_required: 'confirmNoRebuildWithExistingTurmas=true',
        },
      }, { status: 409 });
    }

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
        existing_turmas_before_publish: existingTurmasCount,
        pendencias_count: result?.pendencias_count ?? 0,
      },
      actor_id: user.id,
      actor_role: 'admin',
      entidade_tipo: 'curriculo',
      entidade_id: result?.published_curriculo_id ?? null,
    }).catch(() => null);

    await dispatchProfessorNotificacao({
      escolaId: userEscolaId,
      key: 'CURRICULO_PUBLICADO',
      actorId: user.id,
      actorRole: 'admin',
      agrupamentoTTLHoras: 24,
    });

    const shouldGenerateTurmas = rebuildTurmas || autoGenerateTurmas;
    let autoGenerateExecuted = false;
    let autoGenerateSkippedReason: string | null = null;
    let syncExistingTurmas: SyncExistingTurmasResult = {
      ok: true,
      executed: false,
      attempted: 0,
      inserted: 0,
      updated: 0,
      skipped_duplicates: 0,
      turmas_scanned: existingTurmasCount,
      matriz_rows: 0,
      sync_mode: syncMode,
      reconcile_confirmed: confirmReconcileSync,
      obsolete_count: 0,
      obsolete_sample: [],
      reconcile_removed: 0,
      reconcile_blocked: 0,
      reconcile_pending_confirmation: false,
      skipped_reason: rebuildTurmas ? 'rebuild_requested' : 'not_required',
    };

    if (!rebuildTurmas && existingTurmasCount > 0) {
      try {
        syncExistingTurmas = await syncPublishedMatrizToExistingTurmas({
          supabase: supabase as any,
          escolaId: userEscolaId,
          cursoId,
          anoLetivoId,
          syncMode,
          confirmReconcileSync,
        });
      } catch (syncErr) {
        const message = syncErr instanceof Error ? syncErr.message : String(syncErr);
        syncExistingTurmas = {
          ok: false,
          executed: false,
          attempted: 0,
          inserted: 0,
          updated: 0,
          skipped_duplicates: 0,
          turmas_scanned: existingTurmasCount,
          matriz_rows: 0,
          sync_mode: syncMode,
          reconcile_confirmed: confirmReconcileSync,
          obsolete_count: 0,
          obsolete_sample: [],
          reconcile_removed: 0,
          reconcile_blocked: 0,
          reconcile_pending_confirmation: false,
          skipped_reason: 'sync_error',
          error: message,
        };
      }
    }

    if (syncExistingTurmas.reconcile_pending_confirmation) {
      return NextResponse.json({
        ok: false,
        code: 'CURRICULO_SYNC_RECONCILE_CONFIRM_REQUIRED',
        error: 'Modo reconcile detectou vínculos obsoletos. Confirme para remover os vínculos seguros.',
        details: {
          sync_mode: syncMode,
          obsolete_count: syncExistingTurmas.obsolete_count,
          action_required: 'confirmReconcileSync=true',
        },
        sync_existing_turmas: syncExistingTurmas,
      }, { status: 409 });
    }

    if (!syncExistingTurmas.ok) {
      return NextResponse.json({
        ok: false,
        error: syncExistingTurmas.error || 'Falha ao sincronizar turmas existentes.',
        code: 'SYNC_EXISTING_TURMAS_FAILED',
        sync_existing_turmas: syncExistingTurmas,
      }, { status: 409 });
    }

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
            autoGenerateExecuted = true;
            try {
              await (supabase as any).rpc('refresh_mv_turmas_para_matricula');
            } catch (refreshErr) {
              console.warn('Falha ao atualizar mv_turmas_para_matricula:', refreshErr);
            }
          }
        }
      } else {
        autoGenerateSkippedReason = 'turmas_already_exist'
      }
    } else {
      autoGenerateSkippedReason = 'not_requested'
    }

    const { count: turmasDepoisPublish } = await supabase
      .from('turmas')
      .select('id', { count: 'estimated', head: true })
      .eq('escola_id', userEscolaId)
      .eq('curso_id', cursoId)
      .eq('ano_letivo_id', anoLetivoId);

    const turmasCountAfter = Number(turmasDepoisPublish ?? existingTurmasCount);
    const syncTurmas = buildSyncTurmasSummary({
      rebuildTurmas,
      existingTurmasCount,
      turmasCountAfter,
      shouldGenerateTurmas,
      autoGenerateExecuted,
      autoGenerateSkippedReason,
      confirmNoRebuildWithExistingTurmas,
    });

    return NextResponse.json({
      ok: true,
      data: result,
      idempotency_key: idempotencyKey,
      sync_turmas: syncTurmas,
      sync_existing_turmas: syncExistingTurmas,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
