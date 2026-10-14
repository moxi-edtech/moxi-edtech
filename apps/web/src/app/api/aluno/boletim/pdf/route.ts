import { NextResponse } from "next/server";
import { criarPdfBoletim } from "@/lib/aluno/boletimPdf";
import { getAlunoContext } from "@/lib/alunoContext";
import { resolveAuthorizedStudentIds, resolveSelectedStudentId } from "@/lib/portalAlunoAuth";
import { AcademicYearContextError, resolveAcademicYearContext } from "@/lib/academic-year/context";
import { checkBoletimAccess } from "@/lib/aluno/boletimAccess";
import { loadNotasLancadas } from "@/lib/aluno/boletimNotas";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx?.escolaId || !ctx.userId) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    const academicContext = await resolveAcademicYearContext(supabase, {
      userId: ctx.userId,
      requestedAcademicYearId: new URL(request.url).searchParams.get("ano_letivo_id"),
      operation: "READ",
    });
    const { data: userRes } = await supabase.auth.getUser();
    const authorizedIds = await resolveAuthorizedStudentIds({ supabase, userId: ctx.userId, escolaId: ctx.escolaId, userEmail: userRes?.user?.email });
    const selectedId = new URL(request.url).searchParams.get("studentId");
    if (selectedId && !authorizedIds.includes(selectedId)) return NextResponse.json({ ok: false, error: "Aluno não autorizado" }, { status: 403 });
    const alunoId = resolveSelectedStudentId({ selectedId, authorizedIds, fallbackId: ctx.alunoId });
    if (!alunoId) return NextResponse.json({ ok: false, error: "Aluno não autorizado" }, { status: 403 });

    const { data: matricula } = await supabase.from("matriculas").select("id, turma_id")
      .eq("aluno_id", alunoId).eq("escola_id", ctx.escolaId).eq("session_id", academicContext.anoLetivoId)
      .limit(1).maybeSingle();
    if (!matricula?.id || !matricula.turma_id) return NextResponse.json({ ok: false, error: "Matrícula não encontrada" }, { status: 404 });

    const access = await checkBoletimAccess(supabase, { escolaId: ctx.escolaId, alunoId, matriculaId: matricula.id });
    if (access.error) return NextResponse.json({ ok: false, error: "Não foi possível verificar o pagamento do boletim." }, { status: 503 });
    if (!access.granted) return NextResponse.json({ ok: false, error: "Pague o boletim de notas e aguarde a validação da secretaria." }, { status: 403 });

    const [escolaResult, alunoResult, disciplinas] = await Promise.all([
      supabase.from("escolas").select("nome, nif, endereco, logo_url").eq("id", ctx.escolaId).maybeSingle(),
      supabase.from("alunos").select("nome").eq("id", alunoId).eq("escola_id", ctx.escolaId).maybeSingle(),
      loadNotasLancadas(supabase, { escolaId: ctx.escolaId, matriculaId: matricula.id, turmaId: matricula.turma_id }),
    ]);
    if (escolaResult.error || alunoResult.error) throw new Error("Não foi possível consultar os dados do boletim.");

    const nomeAluno = alunoResult.data?.nome || "Aluno";
    const pdfBytes = await criarPdfBoletim({
      nomeAluno,
      escola: escolaResult.data ?? {},
      disciplinas,
      dataEmissao: new Date().toLocaleString("pt-AO", { dateStyle: "short", timeStyle: "short" }),
    });
    return new NextResponse(pdfBytes as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="boletim_${nomeAluno.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error: unknown) {
    if (error instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro inesperado" }, { status: 500 });
  }
}
