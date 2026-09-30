import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { applyKf2ListInvariants } from "@/lib/kf2";
import { ACTIVE_MATRICULA_STATUSES } from "@/lib/matriculas/status";
import type { Database } from "~types/supabase";
import { AcademicYearContextError, assertAcademicYearEntity, resolveAcademicYearContext } from "@/lib/academic-year/context";

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
    const searchParams = new URL(_req.url).searchParams
    const disciplinaId = searchParams.get("disciplina_id")
    const academicContext = await resolveAcademicYearContext(supabase, {
      userId: user.id,
      requestedAcademicYearId: searchParams.get("ano_letivo_id"),
      operation: "READ",
    });
    await assertAcademicYearEntity(supabase, {
      table: "turmas", entityId: turmaId, escolaId: academicContext.escolaId,
      anoLetivoId: academicContext.anoLetivoId,
    });

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

    let tdpQuery = supabase
      .from("turma_disciplinas_professores")
      .select("id")
      .eq("escola_id", escolaId)
      .eq("turma_id", turmaId)
      .eq("professor_id", professorId)
    if (disciplinaId) tdpQuery = tdpQuery.eq("disciplina_id", disciplinaId)
    const { data: tdp } = await tdpQuery.limit(1)

    let hasAccess = Boolean(tdp?.length)
    if (!hasAccess) {
      const { data: directAssignments } = await supabase
        .from("turma_disciplinas")
        .select("curso_matriz_id")
        .eq("escola_id", escolaId)
        .eq("turma_id", turmaId)
        .eq("professor_id", professorId)
      const matrizIds = (directAssignments ?? []).map((row: any) => row.curso_matriz_id).filter(Boolean)
      if (matrizIds.length > 0) {
        let matrizQuery = supabase
          .from("curso_matriz")
          .select("id")
          .eq("escola_id", escolaId)
          .in("id", matrizIds)
        if (disciplinaId) matrizQuery = matrizQuery.eq("disciplina_id", disciplinaId)
        const { data: matchingMatrizes } = await matrizQuery.limit(1)
        hasAccess = Boolean(matchingMatrizes?.length)
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    let query = supabase
      .from("matriculas")
      .select("id, aluno_id, alunos!inner(id, nome)")
      .eq("escola_id", escolaId)
      .eq("turma_id", turmaId)
      .eq("session_id", academicContext.anoLetivoId)
      .in("status", ACTIVE_MATRICULA_STATUSES)
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

    return NextResponse.json({ ok: true, context: academicContext, turmaId, items });
  } catch (e) {
    if (e instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: e.code, message: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
