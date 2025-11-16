import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    const { data: prof } = await supabase
      .from('profiles')
      .select('escola_id')
      .order('created_at', { ascending: false })
      .limit(1);
    const escolaId = (prof?.[0] as any)?.escola_id as string | undefined;
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 });
    }

    const body = await req.json();
    const { turma_id: new_turma_id } = body;
    const { id: matricula_id } = await context.params;

    if (!new_turma_id) {
      return NextResponse.json({ ok: false, error: 'turma_id é obrigatório' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('matriculas')
      .update({ turma_id: new_turma_id })
      .eq('id', matricula_id)
      .eq('escola_id', escolaId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
