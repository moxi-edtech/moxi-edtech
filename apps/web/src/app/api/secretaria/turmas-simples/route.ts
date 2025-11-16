import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('session_id');
    const qsEscolaId = url.searchParams.get('escola_id') || undefined;
    const alunoId = url.searchParams.get('aluno_id') || undefined;

    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado', debug: { reason: 'missing_user' } }, { status: 401 });

    // Resolver escolaId com diferentes origens para facilitar debug
    let escolaId = qsEscolaId as string | undefined;
    let escolaIdSource: 'query' | 'aluno' | 'profile' | 'vinculo' | 'none' = 'none';
    if (escolaId) escolaIdSource = 'query';

    if (!escolaId && alunoId) {
      try {
        const { data: aluno } = await supabase
          .from('alunos')
          .select('escola_id')
          .eq('id', alunoId)
          .maybeSingle();
        escolaId = (aluno as any)?.escola_id as string | undefined;
        if (escolaId) escolaIdSource = 'aluno';
      } catch {}
    }
    if (!escolaId) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('current_escola_id, escola_id, user_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      escolaId = ((prof?.[0] as any)?.current_escola_id || (prof?.[0] as any)?.escola_id) as string | undefined;
      if (escolaId) escolaIdSource = 'profile';
      if (!escolaId) {
        try {
          const { data: vinc } = await supabase
            .from('escola_usuarios')
            .select('escola_id')
            .eq('user_id', user.id)
            .limit(1);
          escolaId = (vinc?.[0] as any)?.escola_id as string | undefined;
          if (escolaId) escolaIdSource = 'vinculo';
        } catch {}
      }
    }
    if (!escolaId) return NextResponse.json({ ok: true, items: [], debug: { escolaId: null, escolaIdSource: 'none', sessionId } });

    // Verificar vínculo do usuário com a escola
    const { data: vincUser } = await supabase
      .from('escola_usuarios')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('escola_id', escolaId)
      .limit(1);
    const vinculado = Boolean(vincUser && vincUser.length > 0);
    if (!vinculado) {
      return NextResponse.json({ ok: false, error: 'Sem vínculo com a escola', debug: { escolaId, escolaIdSource, sessionId, vinculado } }, { status: 403 });
    }

    // Preferir service role quando disponível
    const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const useAdmin = Boolean(adminUrl && serviceRole);

    if (!useAdmin) {
      let query = supabase
        .from('turmas')
        .select('id, nome')
        .eq('escola_id', escolaId)
        .order('nome');
      if (sessionId) query = query.eq('session_id', sessionId);
      const { data, error } = await query;
      if (error) return NextResponse.json({ ok: false, error: error.message, debug: { path: 'user', escolaId, escolaIdSource, sessionId } }, { status: 400 });
      return NextResponse.json({ ok: true, items: data || [], debug: { path: 'user', escolaId, escolaIdSource, sessionId, count: (data || []).length } });
    }

    const admin = createAdminClient<Database>(adminUrl, serviceRole);
    let query = (admin as any)
      .from('turmas')
      .select('id, nome')
      .eq('escola_id', escolaId)
      .order('nome');
    if (sessionId) query = query.eq('session_id', sessionId);
    const { data, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: error.message, debug: { path: 'admin', escolaId, escolaIdSource, sessionId } }, { status: 400 });
    return NextResponse.json({ ok: true, items: data || [], debug: { path: 'admin', escolaId, escolaIdSource, sessionId, count: (data || []).length } });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message, debug: { reason: 'exception' } }, { status: 500 });
  }
}
