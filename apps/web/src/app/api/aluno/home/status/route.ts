import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
import { resolveAuthorizedStudentIds, resolveSelectedStudentId } from "@/lib/portalAlunoAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx?.userId || !ctx.escolaId) {
      return NextResponse.json({ ok: true, status: null });
    }

    const { data: userRes } = await supabase.auth.getUser();
    const authUser = userRes?.user;
    const authorizedIds = await resolveAuthorizedStudentIds({
      supabase,
      userId: ctx.userId,
      escolaId: ctx.escolaId,
      userEmail: authUser?.email,
    });

    const selectedId = new URL(request.url).searchParams.get("studentId");
    const alunoId = resolveSelectedStudentId({ selectedId, authorizedIds, fallbackId: ctx.alunoId });
    if (!alunoId) return NextResponse.json({ ok: true, status: null });

    const [{ data: aluno }, { data: matricula }] = await Promise.all([
      supabase.from("alunos").select("id, nome").eq("id", alunoId).eq("escola_id", ctx.escolaId).maybeSingle(),
      supabase
        .from("matriculas")
        .select("id, status, turma_id")
        .eq("aluno_id", alunoId)
        .eq("escola_id", ctx.escolaId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    let turmaNome: string | null = null;
    let classeNome: string | null = null;

    if (matricula?.turma_id) {
      const { data: turma } = await supabase
        .from("turmas")
        .select("nome, classe_id")
        .eq("id", matricula.turma_id)
        .eq("escola_id", ctx.escolaId)
        .maybeSingle();
      turmaNome = turma?.nome ?? null;

      if (turma?.classe_id) {
        const { data: classe } = await supabase
          .from("classes")
          .select("nome")
          .eq("id", turma.classe_id)
          .eq("escola_id", ctx.escolaId)
          .maybeSingle();
        classeNome = classe?.nome ?? null;
      }
    }

    const estadoAcademico = ["ativo", "ativa", "active"].includes(matricula?.status ?? "")
      ? "Em curso"
      : matricula?.status
        ? "Com pendências"
        : "Sem matrícula ativa";

    return NextResponse.json({ ok: true, status: { nome: aluno?.nome ?? "Aluno", turma: turmaNome, classe: classeNome, estadoAcademico } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
