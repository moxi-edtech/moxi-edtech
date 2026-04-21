import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

const bodySchema = z.object({
  professor_id: z.string().uuid().nullable().optional(),
});

async function assertManagePermission(supabase: any, requestedEscolaId: string, userId: string) {
  const resolvedEscolaId = await resolveEscolaIdForUser(supabase, userId, requestedEscolaId);
  if (!resolvedEscolaId) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 }) };
  }

  const authz = await authorizeEscolaAction(
    supabase,
    resolvedEscolaId,
    userId,
    ["configurar_escola", "gerenciar_disciplinas"]
  );

  if (!authz.allowed) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 }),
    };
  }

  return { ok: true as const, resolvedEscolaId };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string; cursoId: string }> }
) {
  const { id: escolaId, cursoId } = await context.params;

  try {
    const supabase = await createRouteClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const perm = await assertManagePermission(supabase as any, escolaId, user.id);
    if (!perm.ok) return perm.response;
    const resolvedEscolaId = perm.resolvedEscolaId;

    const { data: mapRows, error: mapErr } = await (supabase as any).rpc(
      "get_curso_professor_responsavel_map",
      {
        p_escola_id: resolvedEscolaId,
        p_curso_ids: [cursoId],
      }
    );

    if (mapErr) {
      return NextResponse.json({ ok: false, error: mapErr.message }, { status: 400 });
    }

    const linked = (Array.isArray(mapRows) ? mapRows[0] : null) as
      | { curso_id?: string; professor_id?: string | null }
      | null;

    if (!linked?.professor_id) {
      return NextResponse.json({ ok: true, data: { curso_id: cursoId, professor_id: null, professor: null } });
    }

    const { data: professorRow } = await (supabase as any)
      .from("professores")
      .select("id, profile_id, profiles!professores_profile_id_fkey ( nome, email )")
      .eq("escola_id", resolvedEscolaId)
      .eq("id", linked.professor_id)
      .maybeSingle();

    const profile = Array.isArray((professorRow as any)?.profiles)
      ? (professorRow as any)?.profiles?.[0]
      : (professorRow as any)?.profiles;

    return NextResponse.json({
      ok: true,
      data: {
        curso_id: cursoId,
        professor_id: linked.professor_id,
        professor: professorRow
          ? {
              id: (professorRow as any).id,
              profile_id: (professorRow as any).profile_id,
              nome: profile?.nome ?? null,
              email: profile?.email ?? null,
            }
          : null,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string; cursoId: string }> }
) {
  const { id: escolaId, cursoId } = await context.params;

  try {
    const supabase = await createRouteClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const perm = await assertManagePermission(supabase as any, escolaId, user.id);
    if (!perm.ok) return perm.response;
    const resolvedEscolaId = perm.resolvedEscolaId;

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues?.[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const professorId = parsed.data.professor_id ?? null;

    const { data: rpcRows, error: rpcErr } = await (supabase as any).rpc(
      "set_curso_professor_responsavel",
      {
        p_escola_id: resolvedEscolaId,
        p_curso_id: cursoId,
        p_professor_id: professorId,
        p_actor_id: user.id,
      }
    );

    if (rpcErr) {
      const msg = rpcErr.message || "Falha ao atualizar professor responsável do curso";
      const status =
        msg.includes("CURSO_PROF_CURSO_NOT_FOUND") || msg.includes("CURSO_PROF_PROFESSOR_NOT_FOUND")
          ? 404
          : msg.includes("CURSO_PROF_INVALID_INPUT")
            ? 400
            : 409;
      return NextResponse.json({ ok: false, error: msg }, { status });
    }

    const row = (Array.isArray(rpcRows) ? rpcRows[0] : rpcRows) as
      | { curso_id?: string; professor_id?: string | null; professor_profile_id?: string | null; updated_at?: string | null }
      | null;

    return NextResponse.json({
      ok: true,
      data: {
        id: cursoId,
        professor_id: row?.professor_id ?? null,
        professor_profile_id: row?.professor_profile_id ?? null,
        updated_at: row?.updated_at ?? null,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
