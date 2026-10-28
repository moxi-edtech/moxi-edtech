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
      .select("periodos_ativos, curso_matriz:curso_matriz_id(periodos_ativos, disciplina:disciplinas_catalogo!curso_matriz_disciplina_id_fkey(id, nome))")
      .eq("escola_id", ctx.escolaId)
      .eq("turma_id", matricula.turma_id);

    query = applyKf2ListInvariants(query);
    const { data, error } = await query;
    if (error) throw error;

    const safePeriodos = (raw: unknown): number[] | null => {
      if (!Array.isArray(raw)) return null;
      return [...new Set(raw.filter((p) => Number.isInteger(p) && p >= 1 && p <= 3))].sort((a, b) => a - b);
    };
    const seen = new Map<string, { id: string; nome: string; periodos_ativos: number[] | null }>();
    (data ?? []).forEach((row: any) => {
      const disciplina = row?.curso_matriz?.disciplina;
      if (!disciplina?.id || typeof disciplina.nome !== "string") return;
      // Assignment overrides the curriculum matrix only when explicitly defined.
      // Null is unknown, not equivalent to all trimesters.
      const configured = safePeriodos(row.periodos_ativos) ?? safePeriodos(row.curso_matriz?.periodos_ativos);
      const previous = seen.get(disciplina.id);
      if (!previous) {
        seen.set(disciplina.id, { id: disciplina.id, nome: disciplina.nome, periodos_ativos: configured });
      } else if (configured !== null) {
        // Legacy duplicated assignments: a period must not disappear because one
        // of several linked rows was selected first.
        previous.periodos_ativos = previous.periodos_ativos === null
          ? configured
          : [...new Set([...previous.periodos_ativos, ...configured])].sort((a, b) => a - b);
      }
    });
    const disciplinas = [...seen.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
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
