import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";

type BoletimDisciplinaRow = {
  trimestre: number | null;
  nota_final: number | null;
  status: string | null;
  missing_count: number | null;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_req: Request, context: { params: Promise<{ disciplinaId: string }> }) {
  try {
    const { disciplinaId } = await context.params;
    const { supabase, ctx } = await getAlunoContext();

    if (!ctx) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const { matriculaId } = ctx;
    if (!matriculaId) {
      return NextResponse.json({ ok: true, notas: [] });
    }

    // Fonte única para aluno: mesma view usada no boletim do portal aluno.
    const { data, error } = await supabase
      .from("vw_boletim_por_matricula")
      .select("trimestre, nota_final, status, missing_count")
      .eq("matricula_id", matriculaId)
      .eq("disciplina_id", disciplinaId)
      .order("trimestre", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const notas = ((data || []) as BoletimDisciplinaRow[]).map((row) => ({
      trimestre: row.trimestre,
      nota: row.nota_final,
      status:
        row.status === "PENDENTE_CONFIG"
          ? "bloqueada"
          : (row.missing_count ?? 0) > 0
            ? "pendente"
            : "lancada",
    }));

    return NextResponse.json({ ok: true, notas });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
