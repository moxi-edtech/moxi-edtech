import { NextRequest, NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import { K12_ADMIN_SECRETARIA_ROLE_GROUP } from "@/lib/roles";
import { applyKf2ListInvariants } from "@/lib/kf2";
import type { Database } from "~types/supabase";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await ctx.params;
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const resolvedEscolaId = await resolveEscolaIdForUser(supabase, user.id, escolaId);
    if (!resolvedEscolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const { error: roleError } = await requireRoleInSchool({
      supabase,
      escolaId: resolvedEscolaId,
      roles: [...K12_ADMIN_SECRETARIA_ROLE_GROUP],
    });
    if (roleError) return roleError;

    const url = new URL(req.url);
    const limitParam = Number(url.searchParams.get("limit") || 100);
    const limit = Number.isFinite(limitParam) ? Math.min(limitParam, 200) : 100;

    let query = supabase
      .from("turmas")
      .select("id, nome, turma_codigo, ano_letivo, classe_id, turno, classes ( nome ), cursos ( nome )")
      .eq("escola_id", resolvedEscolaId);

    const ano = url.searchParams.get("ano");
    if (ano && /^\d{4}$/.test(ano)) query = query.eq("ano_letivo", Number(ano));

    query = applyKf2ListInvariants(query, {
      limit,
      order: [{ column: "nome", ascending: true }],
    });

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const items = (data ?? []).map((row) => {
      const curso = Array.isArray((row as any).cursos) ? (row as any).cursos[0] : (row as any).cursos;
      const classe = Array.isArray((row as any).classes) ? (row as any).classes[0] : (row as any).classes;
      return {
        id: (row as any).id,
        nome: (row as any).nome,
        turma_codigo: (row as any).turma_codigo ?? null,
        ano_letivo: (row as any).ano_letivo ?? null,
        curso: curso?.nome ?? null,
        classe_id: (row as any).classe_id ?? null,
        classe_nome: classe?.nome ?? null,
        turno: (row as any).turno ?? null,
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
