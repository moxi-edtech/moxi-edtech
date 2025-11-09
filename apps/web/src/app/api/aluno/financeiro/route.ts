import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";

export async function GET() {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    const { matriculaId } = ctx;

    if (!matriculaId) return NextResponse.json({ ok: true, mensalidades: [] });

    const { data, error } = await supabase
      .from('mensalidades')
      .select('id, competencia, valor, vencimento, status, pago_em')
      .eq('matricula_id', matriculaId)
      .order('competencia', { ascending: true });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, mensalidades: data || [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

