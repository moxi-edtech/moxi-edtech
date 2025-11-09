import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";

export async function GET() {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    // Resolve escola vinculada mais recente do profile
    const { data: prof } = await supabase
      .from('profiles')
      .select('escola_id')
      .order('created_at', { ascending: false })
      .limit(1);
    const escolaId = (prof?.[0] as any)?.escola_id as string | undefined;
    if (!escolaId) return NextResponse.json({ ok: true, counts: { alunos: 0, matriculas: 0 }, avisos_recentes: [] });

    const [alunosRes, matsRes, avisosRes] = await Promise.all([
      supabase.from('alunos').select('*', { count: 'exact', head: true }).eq('escola_id', escolaId),
      supabase.from('matriculas').select('*', { count: 'exact', head: true }).eq('escola_id', escolaId),
      supabase
        .from('avisos')
        .select('id, titulo, resumo, origem, created_at')
        .eq('escola_id', escolaId)
        .order('created_at', { ascending: false })
        .limit(3),
    ]);

    const counts = {
      alunos: alunosRes.count ?? 0,
      matriculas: matsRes.count ?? 0,
    };
    const avisos_recentes = (avisosRes.data || []).map((a: any) => ({ id: a.id, titulo: a.titulo, resumo: a.resumo, origem: a.origem, data: a.created_at }));

    return NextResponse.json({ ok: true, counts, avisos_recentes });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

