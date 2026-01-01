import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";

export async function GET(_req: Request, context: { params: Promise<{ disciplinaId: string }> }) {
  try {
    const { disciplinaId } = await context.params;
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    const { matriculaId, escolaId } = ctx;

    if (!matriculaId || !escolaId) return NextResponse.json({ ok: true, notas: [] });

    // Schema de notas pode variar; tentativa genérica.
    const { data: notas } = await supabase
      .from('notas')
      .select('id, avaliacao, valor, peso, created_at')
      .eq('escola_id', escolaId)
      .eq('matricula_id', matriculaId)
      .eq('disciplina_id', disciplinaId)
      .order('created_at', { ascending: false });

    return NextResponse.json({ ok: true, notas: notas || [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
