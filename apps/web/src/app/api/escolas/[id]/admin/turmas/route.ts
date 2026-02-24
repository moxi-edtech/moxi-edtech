import { NextRequest, NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
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
    if (!resolvedEscolaId || resolvedEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const url = new URL(req.url);
    const limitParam = Number(url.searchParams.get("limit") || 100);
    const limit = Number.isFinite(limitParam) ? Math.min(limitParam, 200) : 100;

    let query = supabase
      .from("turmas")
      .select("id, nome, turma_codigo, ano_letivo, cursos ( nome )")
      .eq("escola_id", escolaId);

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
      return {
        id: (row as any).id,
        nome: (row as any).nome,
        turma_codigo: (row as any).turma_codigo ?? null,
        ano_letivo: (row as any).ano_letivo ?? null,
        curso: curso?.nome ?? null,
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
