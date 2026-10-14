import { NextResponse } from "next/server";
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

    const selectedId = new URL(request.url).searchParams.get("studentId");
    const { data: userRes } = await supabase.auth.getUser();
    const authorizedIds = await resolveAuthorizedStudentIds({
      supabase, userId: ctx.userId, escolaId: ctx.escolaId, userEmail: userRes?.user?.email,
    });
    if (selectedId && !authorizedIds.includes(selectedId)) {
      return NextResponse.json({ ok: false, error: "Aluno não autorizado" }, { status: 403 });
    }
    const alunoId = resolveSelectedStudentId({ selectedId, authorizedIds, fallbackId: ctx.alunoId });
    if (!alunoId) return NextResponse.json({ ok: false, error: "Aluno não autorizado" }, { status: 403 });

    const academicContext = await resolveAcademicYearContext(supabase, {
      userId: ctx.userId,
      requestedAcademicYearId: new URL(request.url).searchParams.get("ano_letivo_id"),
      operation: "READ",
    });

    const [{ data: aluno }, { data: matricula }] = await Promise.all([
      supabase.from("alunos").select("nome").eq("id", alunoId).eq("escola_id", ctx.escolaId).maybeSingle(),
      supabase.from("matriculas").select("id, turma_id")
        .eq("aluno_id", alunoId).eq("escola_id", ctx.escolaId)
        .eq("session_id", academicContext.anoLetivoId).limit(1).maybeSingle(),
    ]);

    if (!matricula?.id || !matricula.turma_id) {
      return NextResponse.json({ ok: true, is_liberado: false, matricula_encontrada: false, total_faltas: 0, total_faltas_max: 0, disciplinas: [], nome_aluno: aluno?.nome ?? null });
    }

    // Assiduidade é independente da taxa do boletim e continua disponível.
    const { data: frequencias } = await supabase.from("frequencia_status_periodo")
      .select("faltas, aulas_previstas, frequencia_min_percent")
      .eq("escola_id", ctx.escolaId).eq("matricula_id", matricula.id).limit(50);
    const totalFaltas = (frequencias ?? []).reduce((total, item) => total + Number(item.faltas ?? 0), 0);
    const totalFaltasMax = (frequencias ?? []).reduce((total, item) =>
      total + Math.max(0, Math.floor(Number(item.aulas_previstas ?? 0) * (1 - Number(item.frequencia_min_percent ?? 75) / 100))), 0);

    const access = await checkBoletimAccess(supabase, { escolaId: ctx.escolaId, alunoId, matriculaId: matricula.id });
    if (access.error) return NextResponse.json({ ok: false, error: "Não foi possível verificar o pagamento do boletim." }, { status: 503 });
    if (!access.granted) {
      return NextResponse.json({ ok: true, context: academicContext, matricula_encontrada: true, is_liberado: false, total_faltas: totalFaltas, total_faltas_max: totalFaltasMax, disciplinas: [], nome_aluno: aluno?.nome ?? null });
    }

    const disciplinas = await loadNotasLancadas(supabase, { escolaId: ctx.escolaId, matriculaId: matricula.id, turmaId: matricula.turma_id });
    return NextResponse.json({ ok: true, context: academicContext, matricula_encontrada: true, is_liberado: true, total_faltas: totalFaltas, total_faltas_max: totalFaltasMax, disciplinas, nome_aluno: aluno?.nome ?? null });
  } catch (error: unknown) {
    if (error instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro inesperado" }, { status: 500 });
  }
}
