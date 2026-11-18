import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
import { resolveSelectedStudentId } from "@/lib/portalAlunoAuth";
import { AcademicYearContextError } from "@/lib/academic-year/context";
import { resolveBoletimMatricula } from "@/lib/aluno/resolveBoletimMatricula";
import { loadClassificacoesTrimestrais, loadNotasLancadas } from "@/lib/aluno/boletimNotas";
import { publishedTrimestersFromOfficialSheets, selectPublishedStudentGrades } from "@/lib/aluno/published-notes";

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
      ok: true, is_liberado: true, matricula_encontrada: false,
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

    const [{ data: sheets, error: sheetsError }, { data: periods, error: periodsError }] = await Promise.all([
      supabase.from("pautas_oficiais").select("periodo_letivo_id, pdf_path, tipo, status")
        .eq("escola_id", ctx.escolaId)
        .eq("turma_id", turma.id)
        .eq("tipo", "trimestral").eq("status", "SUCCESS").limit(50),
      supabase.from("periodos_letivos").select("id, numero")
        .eq("escola_id", ctx.escolaId)
        .eq("ano_letivo_id", context.anoLetivoId)
        .eq("tipo", "TRIMESTRE").limit(12),
    ]);
    if (sheetsError || periodsError) return NextResponse.json({
      ok: false, error: "Não foi possível validar a publicação das notas.",
    }, { status: 503 });

    const periodById = new Map((periods ?? []).map((p) => [p.id, p.numero]));
    const publishedTrimesters = publishedTrimestersFromOfficialSheets((sheets ?? []).map((sheet) => ({
      tipo: sheet.tipo,
      status: sheet.status,
      pdf_path: sheet.pdf_path,
      numero: sheet.periodo_letivo_id ? periodById.get(sheet.periodo_letivo_id) ?? null : null,
    })));
    const scope = { escolaId: ctx.escolaId, matriculaId: matricula.id, turmaId: turma.id };
    const [grades, classifications] = publishedTrimesters.size
      ? await Promise.all([loadNotasLancadas(supabase, scope), loadClassificacoesTrimestrais(supabase, scope)])
      : [[], []];
    const disciplinas = selectPublishedStudentGrades(grades, classifications, publishedTrimesters);

    // Dados da turma por ID; este contexto é apenas leitura e não cria publicação.
    return NextResponse.json({
      ok: true,
      is_liberado: true, // consultar nunca depende de um pedido financeiro
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
