import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/escola/disciplinas";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped();
    
    // 1. Auth & Escola
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 });

    // 2. Query Ajustada (SEM 'sigla', COM 'course_code')
    const { data, error } = await supabase
      .from('cursos')
      .select('id, nome, codigo, course_code, curriculum_key') // <--- AQUI ESTAVA O ERRO
      .eq('escola_id', escolaId)
      .order('nome');

    if (error) throw error;

    return NextResponse.json({ ok: true, data });

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}