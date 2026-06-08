import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
import { resolveAuthorizedStudentIds, resolveSelectedStudentId } from "@/lib/portalAlunoAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx?.userId || !ctx.escolaId) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
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
      supabase.from("alunos").select("id, nome, foto_url").eq("id", alunoId).eq("escola_id", ctx.escolaId).maybeSingle(),
      supabase
        .from("matriculas")
        .select("id, status, turma:turmas(nome, classe:classes(nome)), percentagem_presencas")
        .eq("aluno_id", alunoId)
        .eq("escola_id", ctx.escolaId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const turmaNome = (matricula as any)?.turma?.nome ?? null;
    const classeNome = (matricula as any)?.turma?.classe?.nome ?? null;
    const assiduidade = (matricula as any)?.percentagem_presencas ?? null;

    const estadoAcademico = ["ativo", "ativa", "active"].includes(matricula?.status ?? "")
      ? "Em curso"
      : matricula?.status
        ? "Com pendências"
        : "Sem matrícula ativa";

    return NextResponse.json({ 
      ok: true, 
      status: { 
        nome: aluno?.nome ?? "Aluno", 
        foto_url: aluno?.foto_url ?? null,
        turma: turmaNome, 
        classe: classeNome, 
        estadoAcademico,
        assiduidade 
      } 
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
