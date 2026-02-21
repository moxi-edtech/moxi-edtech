import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
import { applyKf2ListInvariants } from "@/lib/kf2";

export async function GET() {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    const { turmaId } = ctx;

    if (!turmaId) return NextResponse.json({ ok: true, disciplinas: [] });

    let query = supabase
      .from('turma_disciplinas')
      .select('curso_matriz:curso_matriz_id(disciplina:disciplinas_catalogo!curso_matriz_disciplina_id_fkey(id, nome))')
      .eq('turma_id', turmaId);

    query = applyKf2ListInvariants(query);
    
    const { data: cursosOferta, error } = await query;

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const seen = new Map<string, string>();
    (cursosOferta || []).forEach((row: any) => {
      const disciplina = row?.curso_matriz?.disciplina;
      if (disciplina?.id && !seen.has(disciplina.id)) {
        seen.set(disciplina.id, disciplina.nome);
      }
    });
    const disciplinas = Array.from(seen.entries()).map(([id, nome]) => ({ id, nome }));
    return NextResponse.json({ ok: true, disciplinas });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
