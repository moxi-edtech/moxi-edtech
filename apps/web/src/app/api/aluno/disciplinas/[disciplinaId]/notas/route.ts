// @kf2 allow-scan
import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
import { checkBoletimAccess } from "@/lib/aluno/boletimAccess";
import { loadNotasLancadas } from "@/lib/aluno/boletimNotas";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_req: Request, context: { params: Promise<{ disciplinaId: string }> }) {
  try {
    const { disciplinaId } = await context.params;
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx?.userId) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    const { matriculaId, escolaId, alunoId } = ctx;
    if (!matriculaId || !escolaId || !alunoId) return NextResponse.json({ ok: true, notas: [] });

    const access = await checkBoletimAccess(supabase, { escolaId, alunoId, matriculaId });
    if (access.error) return NextResponse.json({ ok: false, error: "Não foi possível verificar o pagamento do boletim." }, { status: 503 });
    if (!access.granted) return NextResponse.json({ ok: false, error: "Pague o boletim de notas e aguarde a confirmação da secretaria." }, { status: 403 });

    const { data: matricula } = await supabase.from("matriculas").select("turma_id")
      .eq("id", matriculaId).eq("aluno_id", alunoId).eq("escola_id", escolaId).maybeSingle();
    if (!matricula?.turma_id) return NextResponse.json({ ok: false, error: "Matrícula não encontrada." }, { status: 404 });

    const disciplinas = await loadNotasLancadas(supabase, { escolaId, matriculaId, turmaId: matricula.turma_id });
    const disciplina = disciplinas.find((item) => item.id === disciplinaId);
    return NextResponse.json({
      ok: true,
      notas: (disciplina?.avaliacoes ?? []).map((avaliacao) => ({
        trimestre: avaliacao.trimestre,
        tipo: avaliacao.tipo,
        nome: avaliacao.nome,
        nota: avaliacao.nota,
        status: "lancada",
      })),
    });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro inesperado" }, { status: 500 });
  }
}
