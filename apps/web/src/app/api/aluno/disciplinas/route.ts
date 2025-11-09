import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";

export async function GET() {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    const { turmaId } = ctx;

    if (!turmaId) return NextResponse.json({ ok: true, disciplinas: [] });

    const { data: cursosOferta, error } = await supabase
      .from('cursos_oferta')
      .select('curso_id, cursos!inner(id, nome)')
      .eq('turma_id', turmaId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const disciplinas = (cursosOferta || []).map((r: any) => ({ id: r.cursos?.id, nome: r.cursos?.nome }));
    return NextResponse.json({ ok: true, disciplinas });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

