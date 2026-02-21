import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeDisciplinaManage } from "@/lib/escola/disciplinas";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

const resolveStatusCompletude = (payload: {
  carga_horaria_semanal?: number | null;
  classificacao?: string | null;
  periodos_ativos?: number[] | null;
  entra_no_horario?: boolean | null;
  avaliacao_mode?: string | null;
  avaliacao_modelo_id?: string | null;
  avaliacao_disciplina_id?: string | null;
}) => {
  const hasCarga = Number(payload.carga_horaria_semanal ?? 0) > 0;
  const hasClassificacao = Boolean(payload.classificacao);
  const hasPeriodos = Array.isArray(payload.periodos_ativos) && payload.periodos_ativos.length > 0;
  const hasHorario = payload.entra_no_horario !== null && payload.entra_no_horario !== undefined;
  const hasAvaliacao =
    payload.avaliacao_mode === "inherit_school" ||
    (payload.avaliacao_mode === "custom" && Boolean(payload.avaliacao_modelo_id)) ||
    (payload.avaliacao_mode === "inherit_disciplina" && Boolean(payload.avaliacao_disciplina_id));

  return hasCarga && hasClassificacao && hasPeriodos && hasHorario && hasAvaliacao
    ? "completo"
    : "incompleto";
};

async function authorize(escolaId: string) {
  const supabase = await createRouteClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return { ok: false as const, status: 401, error: "Não autenticado" };

  const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId);
  if (!userEscolaId || userEscolaId !== escolaId) {
    return { ok: false as const, status: 403, error: "Sem permissão" };
  }

  const authz = await authorizeDisciplinaManage(supabase as any, escolaId, user.id);
  if (!authz.allowed) return { ok: false as const, status: 403, error: authz.reason || 'Sem permissão' };
  return { ok: true as const, supabase };
}

// PUT /api/escolas/[id]/disciplinas/[disciplinaId]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; disciplinaId: string }> }
) {
  const { id: escolaId, disciplinaId } = await params;
  const authz = await authorize(escolaId);
  if (!authz.ok) return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status });
  const { supabase } = authz;

  try {
    const raw = await req.json();
    const schema = z.object({
      nome: z.string().trim().min(1).optional(),
      tipo: z.enum(['core','eletivo']).optional(),
      curso_id: z.string().uuid().nullable().optional(),
      classe_id: z.string().uuid().nullable().optional(),
      descricao: z.string().trim().nullable().optional(),
      sigla: z.string().trim().nullable().optional(),
      is_avaliavel: z.boolean().optional(),
      area: z.string().trim().nullable().optional(),
      carga_horaria: z.number().int().nullable().optional(),
      ordem: z.number().int().nullable().optional(),
      carga_horaria_semanal: z.number().int().positive().nullable().optional(),
      classificacao: z.enum(['core', 'complementar', 'optativa']).nullable().optional(),
      periodos_ativos: z.array(z.number().int()).nullable().optional(),
      entra_no_horario: z.boolean().nullable().optional(),
      avaliacao_mode: z.enum(['inherit_school', 'custom', 'inherit_disciplina']).nullable().optional(),
      avaliacao_modelo_id: z.string().uuid().nullable().optional(),
      avaliacao_disciplina_id: z.string().uuid().nullable().optional(),
    });
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || 'Dados inválidos';
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    const { data: cmRow } = await (supabase as any)
      .from('curso_matriz')
      .select('id, disciplina_id, classe_id, curso_id, obrigatoria, carga_horaria, ordem, curso_curriculo_id, curriculo:curso_curriculos(id,status,curso_id,ano_letivo_id,version), carga_horaria_semanal, classificacao, periodos_ativos, entra_no_horario, avaliacao_mode, avaliacao_modelo_id, avaliacao_disciplina_id')
      .eq('escola_id', escolaId)
      .eq('id', disciplinaId)
      .maybeSingle();

    const disciplinaCatalogoId = cmRow?.disciplina_id ?? disciplinaId;

    let targetMatrizId = cmRow?.id ?? null;
    if (cmRow?.curriculo?.status === 'published') {
      const curriculo = cmRow.curriculo;
      const { data: draftCurriculo } = await (supabase as any)
        .from('curso_curriculos')
        .select('id, version')
        .eq('escola_id', escolaId)
        .eq('curso_id', curriculo.curso_id)
        .eq('ano_letivo_id', curriculo.ano_letivo_id)
        .eq('classe_id', cmRow.classe_id)
        .eq('status', 'draft')
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      let draftId = draftCurriculo?.id ?? null;
      if (!draftId) {
        const { data: last } = await (supabase as any)
          .from('curso_curriculos')
          .select('version')
          .eq('escola_id', escolaId)
          .eq('curso_id', curriculo.curso_id)
          .eq('ano_letivo_id', curriculo.ano_letivo_id)
          .eq('classe_id', cmRow.classe_id)
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle();
        const nextVersion = (last?.version ?? curriculo.version ?? 0) + 1;
        const { data: createdDraft, error: draftErr } = await (supabase as any)
          .from('curso_curriculos')
          .insert({
            escola_id: escolaId,
            curso_id: curriculo.curso_id,
            ano_letivo_id: curriculo.ano_letivo_id,
            version: nextVersion,
            status: 'draft',
            classe_id: cmRow.classe_id,
          })
          .select('id')
          .single();
        if (draftErr) {
          return NextResponse.json({ ok: false, error: draftErr.message }, { status: 400 });
        }
        draftId = createdDraft?.id ?? null;
      }

      if (draftId) {
        const { data: publishedRows, error: publishedErr } = await (supabase as any)
          .from('curso_matriz')
          .select('disciplina_id, classe_id, curso_id, obrigatoria, ordem, ativo, carga_horaria, carga_horaria_semanal, classificacao, periodos_ativos, entra_no_horario, avaliacao_mode, avaliacao_modelo_id, avaliacao_disciplina_id, status_completude')
          .eq('escola_id', escolaId)
          .eq('curso_curriculo_id', curriculo.id)
          .eq('classe_id', cmRow.classe_id);
        if (publishedErr) {
          return NextResponse.json({ ok: false, error: publishedErr.message }, { status: 400 });
        }

        if ((publishedRows || []).length > 0) {
          const inserts = (publishedRows || []).map((row: any) => ({
            ...row,
            escola_id: escolaId,
            curso_curriculo_id: draftId,
          }));
          const { error: copyErr } = await (supabase as any)
            .from('curso_matriz')
            .insert(inserts);
          if (copyErr && copyErr.code !== '23505') {
            return NextResponse.json({ ok: false, error: copyErr.message }, { status: 400 });
          }
        }

        const { data: draftRow } = await (supabase as any)
          .from('curso_matriz')
          .select('id')
          .eq('escola_id', escolaId)
          .eq('curso_curriculo_id', draftId)
          .eq('disciplina_id', cmRow.disciplina_id)
          .eq('classe_id', cmRow.classe_id)
          .maybeSingle();
        targetMatrizId = draftRow?.id ?? targetMatrizId;
      }
    }
    // Fallback check if the provided ID was a catalog ID and not a matrix ID
    if (!cmRow?.id) {
      const { data: linkedCurriculos } = await (supabase as any)
        .from('curso_matriz')
        .select('id, curriculo:curso_curriculos(status)')
        .eq('escola_id', escolaId)
        .eq('disciplina_id', disciplinaCatalogoId)
        .eq('classe_id', cmRow?.classe_id)
        .limit(25);
      const hasPublished = (linkedCurriculos || []).some((row: any) => row.curriculo?.status === 'published');
      if (hasPublished) {
        return NextResponse.json({ ok: false, error: 'Disciplina publicada não pode ser alterada.' }, { status: 409 });
      }
    }
    const catalogUpdates: Record<string, any> = {};
    if (parsed.data.nome !== undefined) catalogUpdates.nome = parsed.data.nome;
    if (parsed.data.sigla !== undefined) catalogUpdates.sigla = parsed.data.sigla;
    if (parsed.data.is_avaliavel !== undefined) catalogUpdates.is_avaliavel = parsed.data.is_avaliavel;
    if (parsed.data.area !== undefined) catalogUpdates.area = parsed.data.area;

    if (Object.keys(catalogUpdates).length > 0) {
      const { error: catalogErr } = await (supabase as any)
        .from('disciplinas_catalogo')
        .update(catalogUpdates)
        .eq('id', disciplinaCatalogoId)
        .eq('escola_id', escolaId);
      if (catalogErr) return NextResponse.json({ ok: false, error: catalogErr.message }, { status: 400 });
    }

    if (targetMatrizId) {
      const matrizUpdates: Record<string, any> = {};
      if (parsed.data.tipo !== undefined) {
        matrizUpdates.obrigatoria = parsed.data.tipo === 'core';
        if (parsed.data.classificacao === undefined) {
          matrizUpdates.classificacao = parsed.data.tipo === 'core' ? 'core' : 'complementar';
        }
      }
      if (parsed.data.carga_horaria !== undefined) matrizUpdates.carga_horaria = parsed.data.carga_horaria;
      if (parsed.data.ordem !== undefined) matrizUpdates.ordem = parsed.data.ordem;
      if (parsed.data.carga_horaria_semanal !== undefined) {
        matrizUpdates.carga_horaria_semanal = parsed.data.carga_horaria_semanal;
      }
      if (parsed.data.classificacao !== undefined) matrizUpdates.classificacao = parsed.data.classificacao;
      if (parsed.data.periodos_ativos !== undefined) matrizUpdates.periodos_ativos = parsed.data.periodos_ativos;
      if (parsed.data.entra_no_horario !== undefined) matrizUpdates.entra_no_horario = parsed.data.entra_no_horario;
      if (parsed.data.avaliacao_mode !== undefined) matrizUpdates.avaliacao_mode = parsed.data.avaliacao_mode;
      if (parsed.data.avaliacao_modelo_id !== undefined) matrizUpdates.avaliacao_modelo_id = parsed.data.avaliacao_modelo_id;
      if (parsed.data.avaliacao_disciplina_id !== undefined) {
        matrizUpdates.avaliacao_disciplina_id = parsed.data.avaliacao_disciplina_id;
      }

      const statusCompletude = resolveStatusCompletude({
        carga_horaria_semanal:
          parsed.data.carga_horaria_semanal ?? cmRow?.carga_horaria_semanal ?? null,
        classificacao: parsed.data.classificacao ?? cmRow?.classificacao ?? null,
        periodos_ativos: parsed.data.periodos_ativos ?? cmRow?.periodos_ativos ?? null,
        entra_no_horario: parsed.data.entra_no_horario ?? cmRow?.entra_no_horario ?? null,
        avaliacao_mode: parsed.data.avaliacao_mode ?? cmRow?.avaliacao_mode ?? null,
        avaliacao_modelo_id: parsed.data.avaliacao_modelo_id ?? cmRow?.avaliacao_modelo_id ?? null,
        avaliacao_disciplina_id:
          parsed.data.avaliacao_disciplina_id ?? cmRow?.avaliacao_disciplina_id ?? null,
      });
      matrizUpdates.status_completude = statusCompletude;

      if (Object.keys(matrizUpdates).length > 0) {
        const { error: matrizErr } = await (supabase as any)
          .from('curso_matriz')
          .update(matrizUpdates)
          .eq('id', targetMatrizId)
          .eq('escola_id', escolaId);
        if (matrizErr) return NextResponse.json({ ok: false, error: matrizErr.message }, { status: 400 });
      }
    }

    const turmaUpdates: Record<string, any> = {};
    if (parsed.data.carga_horaria_semanal !== undefined) {
      turmaUpdates.carga_horaria_semanal = parsed.data.carga_horaria_semanal;
    }
    if (parsed.data.classificacao !== undefined) turmaUpdates.classificacao = parsed.data.classificacao;
    if (parsed.data.periodos_ativos !== undefined) turmaUpdates.periodos_ativos = parsed.data.periodos_ativos;
    if (parsed.data.entra_no_horario !== undefined) turmaUpdates.entra_no_horario = parsed.data.entra_no_horario;
    if (parsed.data.avaliacao_mode !== undefined) turmaUpdates.avaliacao_mode = parsed.data.avaliacao_mode;
    if (parsed.data.avaliacao_modelo_id !== undefined) {
      turmaUpdates.modelo_avaliacao_id = parsed.data.avaliacao_modelo_id;
    }
    if (parsed.data.avaliacao_disciplina_id !== undefined) {
      turmaUpdates.avaliacao_disciplina_id = parsed.data.avaliacao_disciplina_id;
    }

    const turmaMatrizIds = Array.from(
      new Set([cmRow?.id, targetMatrizId].filter((id): id is string => Boolean(id)))
    );
    if (turmaMatrizIds.length > 0 && Object.keys(turmaUpdates).length > 0) {
      const { error: turmaErr } = await (supabase as any)
        .from('turma_disciplinas')
        .update(turmaUpdates)
        .eq('escola_id', escolaId)
        .in('curso_matriz_id', turmaMatrizIds);
      if (turmaErr) return NextResponse.json({ ok: false, error: turmaErr.message }, { status: 400 });
    }

    const { data, error } = await (supabase as any)
      .from('disciplinas_catalogo')
      .select('id, nome, sigla, is_avaliavel, area')
      .eq('id', disciplinaCatalogoId)
      .eq('escola_id', escolaId)
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    const payload = {
      ...(data || {}),
      tipo: parsed.data.tipo ?? (cmRow ? (cmRow.obrigatoria ? 'core' : 'eletivo') : undefined),
      carga_horaria: parsed.data.carga_horaria ?? cmRow?.carga_horaria ?? undefined,
      ordem: parsed.data.ordem ?? cmRow?.ordem ?? undefined,
    };
    return NextResponse.json({ ok: true, data: payload });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// DELETE /api/escolas/[id]/disciplinas/[disciplinaId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; disciplinaId: string }> }
) {
  const { id: escolaId, disciplinaId } = await params;
  const authz = await authorize(escolaId);
  if (!authz.ok) {
    return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status });
  }
  const { supabase } = authz;

  try {
    const { data: cmRow } = await (supabase as any)
      .from('curso_matriz')
      .select('id, disciplina_id, curriculo:curso_curriculos(status)')
      .eq('escola_id', escolaId)
      .eq('id', disciplinaId)
      .maybeSingle();

    if (cmRow?.id) {
      if (cmRow?.curriculo?.status === 'published') {
        return NextResponse.json({ ok: false, error: 'Disciplina publicada não pode ser removida.' }, { status: 409 });
      }
      const { error } = await (supabase as any)
        .from('curso_matriz')
        .delete()
        .eq('id', cmRow.id)
        .eq('escola_id', escolaId);
      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    }

    const { data: links } = await (supabase as any)
      .from('curso_matriz')
      .select('id, curriculo:curso_curriculos(status)')
      .eq('escola_id', escolaId)
      .eq('disciplina_id', disciplinaId)
      .limit(25);

    const hasPublished = (links || []).some((row: any) => row.curriculo?.status === 'published');
    if ((links || []).length > 0) {
      if (hasPublished) {
        return NextResponse.json({ ok: false, error: 'Disciplina publicada não pode ser removida.' }, { status: 409 });
      }
      return NextResponse.json({ ok: false, error: 'Disciplina vinculada a currículos ativos.' }, { status: 409 });
    }

    const { error } = await (supabase as any)
      .from('disciplinas_catalogo')
      .delete()
      .eq('id', disciplinaId)
      .eq('escola_id', escolaId);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
