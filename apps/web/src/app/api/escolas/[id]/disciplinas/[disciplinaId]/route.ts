import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeDisciplinaManage } from "@/lib/escola/disciplinas";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

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
      carga_horaria_semana: z.number().int().positive().nullable().optional(),
      is_core: z.boolean().optional(),
      is_avaliavel: z.boolean().optional(),
      area: z.string().trim().nullable().optional(),
      aplica_modelo_avaliacao_id: z.string().uuid().nullable().optional(),
      herda_de_disciplina_id: z.string().uuid().nullable().optional(),
      carga_horaria: z.number().int().nullable().optional(),
      ordem: z.number().int().nullable().optional(),
    });
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || 'Dados inválidos';
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    const { data: cmRow } = await (supabase as any)
      .from('curso_matriz')
      .select('id, disciplina_id, obrigatoria, carga_horaria, ordem, curso_curriculo_id, curriculo:curso_curriculos(status)')
      .eq('escola_id', escolaId)
      .eq('id', disciplinaId)
      .maybeSingle();

    const disciplinaCatalogoId = cmRow?.disciplina_id ?? disciplinaId;

    // Check if the discipline is part of a published curriculum
    if (cmRow?.curriculo?.status === 'published') {
      return NextResponse.json({ ok: false, error: 'Disciplina publicada não pode ser alterada.' }, { status: 409 });
    }
    // Fallback check if the provided ID was a catalog ID and not a matrix ID
    if (!cmRow?.id) {
      const { data: linkedCurriculos } = await (supabase as any)
        .from('curso_matriz')
        .select('id, curriculo:curso_curriculos(status)')
        .eq('escola_id', escolaId)
        .eq('disciplina_id', disciplinaCatalogoId)
        .limit(25);
      const hasPublished = (linkedCurriculos || []).some((row: any) => row.curriculo?.status === 'published');
      if (hasPublished) {
        return NextResponse.json({ ok: false, error: 'Disciplina publicada não pode ser alterada.' }, { status: 409 });
      }
    }
    const isAvaliavel = parsed.data.is_avaliavel ?? undefined;
    let modeloAvaliacaoId = parsed.data.aplica_modelo_avaliacao_id ?? null;
    if (isAvaliavel && !modeloAvaliacaoId) {
      const { data: defaultModel } = await (supabase as any)
        .from('modelos_avaliacao')
        .select('id')
        .eq('escola_id', escolaId)
        .eq('is_default', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      modeloAvaliacaoId = defaultModel?.id ?? null;
    }
    if (isAvaliavel && !modeloAvaliacaoId) {
      return NextResponse.json({ ok: false, error: 'Modelo de avaliação obrigatório.' }, { status: 400 });
    }

    const catalogUpdates: Record<string, any> = {};
    if (parsed.data.nome !== undefined) catalogUpdates.nome = parsed.data.nome;
    if (parsed.data.sigla !== undefined) catalogUpdates.sigla = parsed.data.sigla;
    if (parsed.data.carga_horaria_semana !== undefined) catalogUpdates.carga_horaria_semana = parsed.data.carga_horaria_semana;
    if (parsed.data.is_core !== undefined) catalogUpdates.is_core = parsed.data.is_core;
    if (parsed.data.is_avaliavel !== undefined) catalogUpdates.is_avaliavel = parsed.data.is_avaliavel;
    if (parsed.data.area !== undefined) catalogUpdates.area = parsed.data.area;
    if (parsed.data.aplica_modelo_avaliacao_id !== undefined || modeloAvaliacaoId) {
      catalogUpdates.aplica_modelo_avaliacao_id = modeloAvaliacaoId;
    }
    if (parsed.data.herda_de_disciplina_id !== undefined) catalogUpdates.herda_de_disciplina_id = parsed.data.herda_de_disciplina_id;

    if (Object.keys(catalogUpdates).length > 0) {
      const { error: catalogErr } = await (supabase as any)
        .from('disciplinas_catalogo')
        .update(catalogUpdates)
        .eq('id', disciplinaCatalogoId)
        .eq('escola_id', escolaId);
      if (catalogErr) return NextResponse.json({ ok: false, error: catalogErr.message }, { status: 400 });
    }

    if (cmRow?.id) {
      const matrizUpdates: Record<string, any> = {};
      if (parsed.data.tipo !== undefined) matrizUpdates.obrigatoria = parsed.data.tipo === 'core';
      if (parsed.data.carga_horaria !== undefined) matrizUpdates.carga_horaria = parsed.data.carga_horaria;
      if (parsed.data.ordem !== undefined) matrizUpdates.ordem = parsed.data.ordem;
      if (Object.keys(matrizUpdates).length > 0) {
        const { error: matrizErr } = await (supabase as any)
          .from('curso_matriz')
          .update(matrizUpdates)
          .eq('id', cmRow.id)
          .eq('escola_id', escolaId);
        if (matrizErr) return NextResponse.json({ ok: false, error: matrizErr.message }, { status: 400 });
      }
    }

    const { data, error } = await (supabase as any)
      .from('disciplinas_catalogo')
      .select('id, nome, sigla, carga_horaria_semana, is_core, is_avaliavel, area, aplica_modelo_avaliacao_id, herda_de_disciplina_id')
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
