import { NextResponse } from 'next/server';
import { supabaseServerTyped } from '@/lib/supabaseServer';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import type { Database } from '~types/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    const url = new URL(req.url);
    const studentId = url.searchParams.get("studentId");
    
    // Resolve escolaId do aluno (ou do user logado se for pai/encarregado)
    // Para simplificar no portal do aluno, pegamos a escola do perfil
    const { data: profile } = await supabase.from('profiles').select('escola_id').eq('user_id', user.id).single();
    if (!profile?.escola_id) return NextResponse.json({ ok: true, items: [] });

    const escolaId = profile.escola_id;

    // Buscar eventos futuros ou em andamento (limite de 3 para o widget da home)
    const today = new Date().toISOString().split('T')[0];

    const { data: events, error } = await supabase
      .from('calendario_eventos')
      .select('*')
      .eq('escola_id', escolaId)
      .gte('data_fim', today)
      .order('data_inicio', { ascending: true })
      .limit(3);

    if (error) throw error;

    return NextResponse.json({ ok: true, items: events || [] });

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
