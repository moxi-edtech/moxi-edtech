import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
import { resolveSelectedStudentId } from "@/lib/portalAlunoAuth";
import { AcademicYearContextError } from "@/lib/academic-year/context";
import { resolveBoletimMatricula } from "@/lib/aluno/resolveBoletimMatricula";
import { checkBoletimAccess } from "@/lib/aluno/boletimAccess";
import { loadClassificacoesTrimestrais, loadNotasLancadas } from "@/lib/aluno/boletimNotas";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx?.escolaId || !ctx.userId) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const selectedId = new URL(request.url).searchParams.get("studentId");
    const authorizedIds = ctx.alunoIds;
    if (selectedId && !authorizedIds.includes(selectedId)) {
      return NextResponse.json({ ok: false, error: "Aluno não autorizado" }, { status: 403 });
    }
    const alunoId = resolveSelectedStudentId({ selectedId, authorizedIds, fallbackId: ctx.alunoId });
    if (!alunoId) return NextResponse.json({ ok: false, error: "Aluno não autorizado" }, { status: 403 });



    const [{ data: aluno }, resolved] = await Promise.all([
      supabase.from("alunos").select("nome").eq("id", alunoId).eq("escola_id", ctx.escolaId).maybeSingle(),
      resolveBoletimMatricula(supabase, {
        escolaId: ctx.escolaId, alunoId, userId: ctx.userId,
        anoLetivoId: new URL(request.url).searchParams.get("ano_letivo_id"),
      }),
    ]);
    const { matricula, context: academicContext } = resolved;

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

    const scope = { escolaId: ctx.escolaId, matriculaId: matricula.id, turmaId: matricula.turma_id };
    const [notas, classificacoes] = await Promise.all([
      loadNotasLancadas(supabase, scope),
      loadClassificacoesTrimestrais(supabase, scope),
    ]);
    const byId = new Map(classificacoes.map((row) => [row.id, row.classificacoes]));
    const disciplinas = notas.map((disc) => ({
      ...disc,
      classificacoes: byId.get(disc.id) ?? [],
    }));
    return NextResponse.json({ ok: true, context: academicContext, matricula_encontrada: true, is_liberado: true, total_faltas: totalFaltas, total_faltas_max: totalFaltasMax, disciplinas, nome_aluno: aluno?.nome ?? null });
  } catch (error: unknown) {
    if (error instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro inesperado" }, { status: 500 });
  }
}
