import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { canManageEscolaResources } from "../permissions";
import { applyKf2ListInvariants } from "@/lib/kf2";

// GET /api/escolas/[id]/disciplinas
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;
  try {
    const url = new URL(_req.url);
    const cursoId = url.searchParams.get('curso_id');
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
          `id, curso_id, classe_id, disciplina_id, carga_horaria, obrigatoria, ordem,
           disciplina:disciplinas_catalogo(id, nome, sigla),
           classe:classes(id, nome),
           curso:cursos(id, nome)
          `
        )
        .eq("escola_id", escolaId);

      if (cursoId) query = query.eq('curso_id', cursoId);

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
      if (error) throw error;
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
      carga_horaria: r.carga_horaria ?? undefined,
      ordem: r.ordem ?? undefined,
      disciplina_id: r.disciplina_id,
    }));

    const pageLimit = limit ?? 500;
    const last = rows[rows.length - 1];
    const nextCursor = rows.length === pageLimit && last
      ? `${last.classe_id},${last.id}`
      : null;
    return NextResponse.json({ ok: true, data: payload, next_cursor: nextCursor });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
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
      ordem: z.number().int().nullable().optional(),
      sigla: z.string().trim().nullable().optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || "Dados inválidos";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    // Resolve/insere disciplina no catálogo
    let disciplinaId: string | null = null;
    {
      const { data: exist } = await (supabase as any)
        .from('disciplinas_catalogo')
        .select('id')
        .eq('escola_id', escolaId)
        .eq('nome', parsed.data.nome)
        .maybeSingle();
      if (exist?.id) disciplinaId = exist.id;
      else {
        const { data: nova, error: discErr } = await (supabase as any)
          .from('disciplinas_catalogo')
          .insert({ escola_id: escolaId, nome: parsed.data.nome, sigla: parsed.data.sigla ?? null } as any)
          .select('id')
          .single();
        if (discErr) return NextResponse.json({ ok: false, error: discErr.message }, { status: 400 });
        disciplinaId = (nova as any)?.id ?? null;
      }
    }

    const payload: any = {
      escola_id: escolaId,
      curso_id: parsed.data.curso_id,
      classe_id: parsed.data.classe_id,
      disciplina_id: disciplinaId,
      obrigatoria: parsed.data.obrigatoria,
    };
    if (parsed.data.carga_horaria !== undefined) payload.carga_horaria = parsed.data.carga_horaria;
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
