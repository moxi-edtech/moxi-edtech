import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
import { resolveSelectedStudentId } from "@/lib/portalAlunoAuth";
import { resolveBoletimMatricula } from "@/lib/aluno/resolveBoletimMatricula";
import { AcademicYearContextError } from "@/lib/academic-year/context";
import { applyKf2ListInvariants } from "@/lib/kf2";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx?.escolaId) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }
    const params = new URL(request.url).searchParams;
    const requestedId = params.get("studentId");
    if (requestedId && !ctx.alunoIds.includes(requestedId)) {
      return NextResponse.json({ ok: false, error: "Aluno não autorizado" }, { status: 403 });
    }
    const alunoId = resolveSelectedStudentId({
      selectedId: requestedId, authorizedIds: ctx.alunoIds, fallbackId: ctx.alunoId,
    });
    if (!alunoId) return NextResponse.json({ ok: false, error: "Nenhum educando autorizado" }, { status: 403 });

    // A lista de disciplinas pertence à matrícula do aluno/ano selecionado,
    // não à turma em cache de outro filho ou ano. Não expõe notas nem contorna
    // checkBoletimAccess, exigido apenas para avaliações e boletins.
    const { matricula, context } = await resolveBoletimMatricula(supabase, {
      escolaId: ctx.escolaId, alunoId, userId: ctx.userId,
      anoLetivoId: params.get("ano_letivo_id"), operation: "READ",
    });
    if (!matricula?.turma_id) {
      return NextResponse.json({ ok: true, disciplinas: [], context: { anoLetivoLabel: context.anoLetivoLabel } });
    }

    let query = supabase
      .from("turma_disciplinas")
      .select("curso_matriz:curso_matriz_id(disciplina:disciplinas_catalogo!curso_matriz_disciplina_id_fkey(id, nome))")
      .eq("escola_id", ctx.escolaId)
      .eq("turma_id", matricula.turma_id);

    query = applyKf2ListInvariants(query);
    const { data, error } = await query;
    if (error) throw error;

    const seen = new Map<string, string>();
    (data ?? []).forEach((row: any) => {
      const disciplina = row?.curso_matriz?.disciplina;
      if (disciplina?.id && !seen.has(disciplina.id)) seen.set(disciplina.id, disciplina.nome);
    });
    const disciplinas = [...seen].map(([id, nome]) => ({ id, nome }));
    return NextResponse.json({
      ok: true, disciplinas,
      context: { anoLetivoLabel: context.anoLetivoLabel, mode: context.mode },
    });
  } catch (error: unknown) {
    if (error instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: error.status });
    }
    console.error("[AlunoDisciplinas] ", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "Não foi possível consultar as disciplinas." }, { status: 500 });
  }
}
