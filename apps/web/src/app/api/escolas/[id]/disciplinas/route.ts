import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { canManageEscolaResources } from "../permissions";
import { applyKf2ListInvariants } from "@/lib/kf2";

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

// GET /api/escolas/[id]/disciplinas
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;
  try {
    const url = new URL(_req.url);
    const cursoId = url.searchParams.get('curso_id');
    const classeId = url.searchParams.get('classe_id');
    const statusCompletude = url.searchParams.get('status_completude');
    const limitParam = url.searchParams.get('limit');
    const cursor = url.searchParams.get('cursor');
    const limit = limitParam ? Number(limitParam) : undefined;
    const supabase = await createRouteClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId);
    if (!userEscolaId || userEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const allowed = await canManageEscolaResources(supabase as any, escolaId, user.id);
    if (!allowed) return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });

    const rows = await (async () => {
      let query = (supabase as any)
        .from("curso_matriz")
        .select(
          `id, curso_id, classe_id, disciplina_id, carga_horaria, carga_horaria_semanal, obrigatoria, ordem,
           classificacao, periodos_ativos, entra_no_horario, avaliacao_mode, avaliacao_modelo_id, avaliacao_disciplina_id,
           conta_para_media_med,
           status_completude, curso_curriculo_id,
           disciplina:disciplinas_catalogo!curso_matriz_disciplina_id_fkey(id, nome, sigla, is_avaliavel, area),
           classe:classes(id, nome, turno, ano_letivo_id, carga_horaria_semanal, min_disciplinas_core),
           curso:cursos(id, nome),
           curriculo:curso_curriculos(status)
          `
        )
        .eq("escola_id", escolaId);

      if (cursoId) query = query.eq('curso_id', cursoId);
      if (classeId) query = query.eq('classe_id', classeId);
      if (statusCompletude) query = query.eq('status_completude', statusCompletude);

      if (cursor) {
        const [cursorClasse, cursorId] = cursor.split(',');
        if (cursorClasse && cursorId) {
          query = query.or(
            `classe_id.gt.${cursorClasse},and(classe_id.eq.${cursorClasse},id.gt.${cursorId})`
          );
        }
      }

      query = applyKf2ListInvariants(query, {
        limit,
        defaultLimit: limit ? undefined : 500,
        order: [
          { column: "classe_id", ascending: true },
          { column: "id", ascending: true },
        ],
      });

      const { data, error } = await query;
      if (error) {
        console.error("[disciplinas][GET] query error", error);
        throw error;
      }
      return data || [];
    })();

    const payload = rows.map((r: any) => ({
      id: r.id,
      nome: r.disciplina?.nome ?? '',
      sigla: r.disciplina?.sigla ?? undefined,
      tipo: r.obrigatoria === false ? 'eletivo' : 'core',
      curso_id: r.curso_id,
      classe_id: r.classe_id,
      classe_nome: r.classe?.nome ?? undefined,
      classe_turno: r.classe?.turno ?? undefined,
      classe_ano_letivo_id: r.classe?.ano_letivo_id ?? undefined,
      classe_carga_horaria_semanal: r.classe?.carga_horaria_semanal ?? undefined,
      classe_min_disciplinas_core: r.classe?.min_disciplinas_core ?? undefined,
      carga_horaria: r.carga_horaria ?? undefined,
      carga_horaria_semanal: r.carga_horaria_semanal ?? undefined,
      conta_para_media_med: r.conta_para_media_med ?? undefined,
      ordem: r.ordem ?? undefined,
      disciplina_id: r.disciplina_id,
      classificacao: r.classificacao ?? undefined,
      periodos_ativos: r.periodos_ativos ?? undefined,
      entra_no_horario: r.entra_no_horario ?? undefined,
      avaliacao_mode: r.avaliacao_mode ?? undefined,
      avaliacao_modelo_id: r.avaliacao_modelo_id ?? undefined,
      avaliacao_disciplina_id: r.avaliacao_disciplina_id ?? undefined,
      status_completude: r.status_completude ?? undefined,
      is_core: r.classificacao ? r.classificacao === 'core' : undefined,
      is_avaliavel: r.disciplina?.is_avaliavel ?? undefined,
      area: r.disciplina?.area ?? undefined,
      curriculo_status: r.curriculo?.status ?? undefined,
    }));

    const pageLimit = limit ?? 500;
    const last = rows[rows.length - 1];
    const nextCursor = rows.length === pageLimit && last
      ? `${last.classe_id},${last.id}`
      : null;
    return NextResponse.json({ ok: true, data: payload, next_cursor: nextCursor });
  } catch (e) {
    console.error("[disciplinas][GET] unexpected error", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// POST /api/escolas/[id]/disciplinas
// Cria uma disciplina (opcionalmente vinculada a curso e/ou classe)
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;
  try {
    const supabase = await createRouteClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId);
    if (!userEscolaId || userEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const allowed = await canManageEscolaResources(supabase as any, escolaId, user.id);
    if (!allowed) return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const schema = z.object({
      nome: z.string().trim().min(1),
      curso_id: z.string().uuid(),
      classe_id: z.string().uuid(),
      obrigatoria: z.boolean().optional().default(true),
      carga_horaria: z.number().int().nullable().optional(),
      carga_horaria_semanal: z.number().int().positive().nullable().optional(),
      ordem: z.number().int().nullable().optional(),
      sigla: z.string().trim().nullable().optional(),
      is_avaliavel: z.boolean().optional(),
      conta_para_media_med: z.boolean().nullable().optional(),
      area: z.string().trim().nullable().optional(),
      classificacao: z.enum(['core', 'complementar', 'optativa']).nullable().optional(),
      periodos_ativos: z.array(z.number().int()).nullable().optional(),
      entra_no_horario: z.boolean().nullable().optional(),
      avaliacao_mode: z.enum(['inherit_school', 'custom', 'inherit_disciplina']).nullable().optional(),
      avaliacao_modelo_id: z.string().uuid().nullable().optional(),
      avaliacao_disciplina_id: z.string().uuid().nullable().optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || "Dados inválidos";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    const isAvaliavel = parsed.data.is_avaliavel ?? true;

    // Resolve/insere disciplina no catálogo
    let disciplinaId: string | null = null;
    {
      const { data: exist } = await (supabase as any)
        .from('disciplinas_catalogo')
        .select('id')
        .eq('escola_id', escolaId)
        .eq('nome', parsed.data.nome)
        .maybeSingle();
      if (exist?.id) {
        disciplinaId = exist.id;
        const updatePayload: Record<string, any> = {};
        if (parsed.data.sigla !== undefined) updatePayload.sigla = parsed.data.sigla;
        if (parsed.data.is_avaliavel !== undefined) updatePayload.is_avaliavel = isAvaliavel;
        if (parsed.data.area !== undefined) updatePayload.area = parsed.data.area;
        if (Object.keys(updatePayload).length > 0) {
          const { error: updateErr } = await (supabase as any)
            .from('disciplinas_catalogo')
            .update(updatePayload)
            .eq('id', disciplinaId)
            .eq('escola_id', escolaId);
          if (updateErr) return NextResponse.json({ ok: false, error: updateErr.message }, { status: 400 });
        }
      }
      else {
        const { data: nova, error: discErr } = await (supabase as any)
          .from('disciplinas_catalogo')
          .insert({
            escola_id: escolaId,
            nome: parsed.data.nome,
            sigla: parsed.data.sigla ?? null,
            is_avaliavel: parsed.data.is_avaliavel ?? true,
            area: parsed.data.area ?? null,
          } as any)
          .select('id')
          .single();
        if (discErr) return NextResponse.json({ ok: false, error: discErr.message }, { status: 400 });
        disciplinaId = (nova as any)?.id ?? null;
      }
    }

    const classificacao = parsed.data.classificacao ?? (parsed.data.obrigatoria ? 'core' : 'complementar');
    const periodosAtivos = parsed.data.periodos_ativos ?? [1, 2, 3];
    const avaliacaoMode = parsed.data.avaliacao_mode ?? 'inherit_school';
    const statusCompletude = resolveStatusCompletude({
      carga_horaria_semanal: parsed.data.carga_horaria_semanal ?? null,
      classificacao,
      periodos_ativos: periodosAtivos,
      entra_no_horario: parsed.data.entra_no_horario ?? true,
      avaliacao_mode: avaliacaoMode,
      avaliacao_modelo_id: parsed.data.avaliacao_modelo_id ?? null,
      avaliacao_disciplina_id: parsed.data.avaliacao_disciplina_id ?? null,
    });

    const payload: any = {
      escola_id: escolaId,
      curso_id: parsed.data.curso_id,
      classe_id: parsed.data.classe_id,
      disciplina_id: disciplinaId,
      obrigatoria: classificacao === 'core',
      classificacao,
      periodos_ativos: periodosAtivos,
      entra_no_horario: parsed.data.entra_no_horario ?? true,
      avaliacao_mode: avaliacaoMode,
      avaliacao_modelo_id: parsed.data.avaliacao_modelo_id ?? null,
      avaliacao_disciplina_id: parsed.data.avaliacao_disciplina_id ?? null,
      status_completude: statusCompletude,
    };
    if (parsed.data.carga_horaria !== undefined) payload.carga_horaria = parsed.data.carga_horaria;
    if (parsed.data.carga_horaria_semanal !== undefined) {
      payload.carga_horaria_semanal = parsed.data.carga_horaria_semanal;
    }
    if (parsed.data.conta_para_media_med !== undefined) {
      payload.conta_para_media_med = parsed.data.conta_para_media_med;
    }
    if (parsed.data.ordem !== undefined) payload.ordem = parsed.data.ordem;

    const { data: ins, error } = await (supabase as any)
      .from("curso_matriz")
      .upsert(payload as any, { onConflict: 'escola_id,curso_id,classe_id,disciplina_id' } as any)
      .select("id, curso_id, classe_id, disciplina_id, obrigatoria, carga_horaria, ordem")
      .single();

    if (error) {
      // [BLINDAGEM] Tratamento de duplicidade
      if (error.code === '23505') {
        return NextResponse.json(
          { ok: false, error: `A disciplina "${parsed.data.nome}" já existe.` },
          { status: 409 } // Conflict
        );
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, data: ins });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
