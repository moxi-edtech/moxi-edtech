import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { applyKf2ListInvariants } from "@/lib/kf2";
import type { Database } from "~types/supabase";

type MatriculaAlunoRow = {
  aluno_id: string | null;
  alunos?: { id?: string | null; nome?: string | null } | null;
}

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: true, turmaId: null, items: [] });
    }

    const { id: turmaId } = await params;

    const { data: professor } = await supabase
      .from("professores")
      .select("id")
      .eq("profile_id", user.id)
      .eq("escola_id", escolaId)
      .maybeSingle();
    const professorId = (professor as { id?: string } | null)?.id;
    if (!professorId) {
      return NextResponse.json({ ok: false, error: "Professor não encontrado" }, { status: 403 });
    }

    const { data: assignment } = await supabase
      .from("turma_disciplinas")
      .select("id")
      .eq("escola_id", escolaId)
      .eq("turma_id", turmaId)
      .eq("professor_id", professorId)
      .maybeSingle();

    let hasAccess = Boolean(assignment);
    if (!hasAccess) {
      const { data: tdp } = await supabase
        .from("turma_disciplinas_professores")
        .select("id")
        .eq("escola_id", escolaId)
        .eq("turma_id", turmaId)
        .eq("professor_id", professorId)
        .maybeSingle();
      hasAccess = Boolean(tdp);
    }

    if (!hasAccess) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    let query = supabase
      .from("matriculas")
      .select("id, aluno_id, alunos!inner(id, nome)")
      .eq("escola_id", escolaId)
      .eq("turma_id", turmaId)
      .in("status", ["ativo", "ativa", "active"])
      .order("created_at", { ascending: true });

    query = applyKf2ListInvariants(query);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const items = (data || []).map((row: MatriculaAlunoRow) => ({
      id: row.aluno_id ?? row?.alunos?.id ?? null,
      nome: row?.alunos?.nome ?? null,
    }));

    return NextResponse.json({ ok: true, turmaId, items });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
