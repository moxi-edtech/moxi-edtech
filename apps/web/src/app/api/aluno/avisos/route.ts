import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
import { applyKf2ListInvariants } from "@/lib/kf2";

export async function GET() {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    const { escolaId } = ctx;

    if (!escolaId) return NextResponse.json({ ok: true, avisos: [] });

    let query = supabase
      .from('avisos')
      .select('id, titulo, resumo, origem, created_at')
      .eq('escola_id', escolaId)
      
    query = applyKf2ListInvariants(query);

    const { data, error } = await query;

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const avisos = (data || []).map((a: any) => ({
      id: a.id,
      titulo: a.titulo,
      resumo: a.resumo,
      origem: a.origem,
      data: a.created_at,
    }));

    return NextResponse.json({ ok: true, avisos });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
