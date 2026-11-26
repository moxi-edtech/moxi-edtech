import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
import { resolveSelectedStudentId } from "@/lib/portalAlunoAuth";
import { AcademicYearContextError } from "@/lib/academic-year/context";
import { resolveBoletimMatricula } from "@/lib/aluno/resolveBoletimMatricula";
import { checkBoletimAccess } from "@/lib/aluno/boletimAccess";
import { loadClassificacoesTrimestrais, loadNotasLancadas } from "@/lib/aluno/boletimNotas";
import { selectPublishedStudentGrades } from "@/lib/aluno/published-notes";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(request: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx?.escolaId || !ctx.userId) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    const url = new URL(request.url);
    const selectedId = url.searchParams.get("studentId");
    const authorizedIds = ctx.alunoIds;
    if (selectedId && !authorizedIds.includes(selectedId)) {
      return NextResponse.json({ ok: false, error: "Aluno não autorizado." }, { status: 403 });
    }
    const alunoId = resolveSelectedStudentId({
      selectedId,
      authorizedIds,
      fallbackId: ctx.alunoId,
    });
    if (!alunoId) return NextResponse.json({ ok: false, error: "Aluno não autorizado." }, { status: 403 });

    const resolved = await resolveBoletimMatricula(supabase, {
      escolaId: ctx.escolaId, alunoId, userId: ctx.userId,
      anoLetivoId: url.searchParams.get("ano_letivo_id"),
    });
    const { matricula, context } = resolved;
    if (!matricula?.id || !matricula.turma_id) return NextResponse.json({
      ok: true, is_liberado: false, matricula_encontrada: false,
      disciplinas: [], publicado_trimestres: [], context,
    }, { headers: { "Cache-Control": "no-store" } });

    // Verificação explícita do vínculo turma/ano; nunca usar apenas ano numérico.
    const { data: turma, error: turmaError } = await supabase.from("turmas")
      .select("id, nome, classe_id")
      .eq("escola_id", ctx.escolaId)
      .eq("ano_letivo_id", context.anoLetivoId)
      .eq("id", matricula.turma_id)
      .maybeSingle();
    if (turmaError || !turma) return NextResponse.json({
      ok: false, error: "A matrícula não pertence a uma turma válida deste ano letivo.",
    }, { status: 409 });

    // The same settled, granted payment authorizes consultation and PDF.
    // Do not query published sheets or grades before checking access.
    const access = await checkBoletimAccess(supabase, { escolaId: ctx.escolaId, alunoId, matriculaId: matricula.id });
    if (access.error) return NextResponse.json({ ok: false, error: "Não foi possível verificar o pagamento do boletim." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
    if (!access.granted) return NextResponse.json({
      ok: true, is_liberado: false, matricula_encontrada: true, context,
      disciplinas: [], publicado_trimestres: [],
    }, { headers: { "Cache-Control": "private, no-store" } });

    const { data: terms, error: publicationError } = await (supabase as any).rpc("aluno_trimestres_publicados", {
      p_escola_id: ctx.escolaId, p_matricula_id: matricula.id,
    });
    if (publicationError || !Array.isArray(terms)) return NextResponse.json({
      ok: false, error: "Não foi possível validar a publicação das notas.",
    }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
    const publishedTrimesters = new Set<number>(terms.filter((term: unknown): term is number =>
      typeof term === "number" && Number.isInteger(term) && term >= 1 && term <= 3));
    const scope = { escolaId: ctx.escolaId, matriculaId: matricula.id, turmaId: turma.id };
    const [grades, classifications] = publishedTrimesters.size
      ? await Promise.all([loadNotasLancadas(supabase, scope), loadClassificacoesTrimestrais(supabase, scope)])
      : [[], []];
    const disciplinas = selectPublishedStudentGrades(grades, classifications, publishedTrimesters);

    // Dados da turma por ID; este contexto é apenas leitura e não cria publicação.
    return NextResponse.json({
      ok: true,
      is_liberado: true, // pagamento confirmado; só notas oficialmente publicadas
      matricula_encontrada: true,
      context,
      turma_nome: turma.nome,
      turma_id: turma.id,
      classe_id: turma.classe_id,
      publicado_trimestres: [...publishedTrimesters].sort((a,b)=>a-b),
      disciplinas,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: unknown) {
    if (error instanceof AcademicYearContextError) return NextResponse.json({
      ok: false, error: error.message, code: error.code,
    }, { status: error.status });
    return NextResponse.json({ ok: false, error: "Não foi possível consultar as notas." }, { status: 503 });
  }
}
