import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('session_id');
    const qsEscolaId = url.searchParams.get('escola_id') || undefined;
    const alunoId = url.searchParams.get('aluno_id') || undefined;
    const include = url.searchParams.get('include');

    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado', debug: { reason: 'missing_user' } }, { status: 401 });

    // Resolver escolaId
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

    // ✅ CORREÇÃO: Usar apenas campos que existem na tabela turmas
    let selectFields = 'id, nome, turno, sala, ano_letivo';
    
    // ✅ CORREÇÃO: Se sessionId foi fornecido, buscar o nome da sessão para filtrar
    let anoLetivoFiltro: string | null = null;
    if (sessionId) {
      const { data: session } = await supabase
        .from('school_sessions')
        .select('nome')
        .eq('id', sessionId)
        .single();
      
      if (session) {
        anoLetivoFiltro = session.nome;
        console.log("🎯 Filtrando por ano letivo:", anoLetivoFiltro);
      } else {
        console.error("❌ Sessão não encontrada:", sessionId);
      }
    }

    // Preferir service role quando disponível. Se faltar, usa o client do usuário.
    const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Se não houver service role configurado, usa o caminho do usuário
    if (!(adminUrl && serviceRole)) {
      let query = supabase
        .from('turmas')
        .select(selectFields)
        .eq('escola_id', escolaId)
        .order('nome');
      
      // ✅ CORREÇÃO: Filtrar por ano_letivo se sessionId foi fornecido
      if (anoLetivoFiltro) {
        query = query.eq('ano_letivo', anoLetivoFiltro);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error("❌ Erro ao buscar turmas:", error);
        return NextResponse.json({ 
          ok: false, 
          error: error.message, 
          debug: { path: 'user', escolaId, escolaIdSource, sessionId, anoLetivoFiltro } 
        }, { status: 400 });
      }
      
      let items = data || [];

      // ✅ CORREÇÃO: Buscar dados de sessão se solicitado (usando ano_letivo)
      if (include && include.includes('session') && items.length > 0) {
        const anosLetivos = Array.from(new Set(items.map((t: any) => t.ano_letivo).filter(Boolean)));
        if (anosLetivos.length > 0) {
          const { data: sessions } = await supabase
            .from('school_sessions')
            .select('id, nome')
            .in('nome', anosLetivos);
          const sessionMap: Map<string, { id: string; nome: string }> = new Map(
            (sessions || []).map((s: any) => [s.nome as string, { id: s.id as string, nome: s.nome as string }])
          );
          
          items = items.map((turma: any) => {
            const sess = turma?.ano_letivo ? sessionMap.get(turma.ano_letivo as string) : undefined;
            return {
              ...turma,
              session_id: sess?.id ?? null,
              session_nome: turma.ano_letivo, // Já temos o nome no ano_letivo
            };
          });
        }
      }

      return NextResponse.json({ 
        ok: true, 
        items, 
        debug: { 
          path: 'user', 
          escolaId, 
          escolaIdSource, 
          sessionId, 
          anoLetivoFiltro,
          count: items.length,
          includes: include || 'none'
        } 
      });
    }

    // ✅ CORREÇÃO: Usar admin client com mesma lógica (tipos garantidos pelo if acima)
    const admin = createAdminClient<Database>(adminUrl, serviceRole);
    let query = (admin as any)
      .from('turmas')
      .select(selectFields)
      .eq('escola_id', escolaId)
      .order('nome');
    
    // ✅ CORREÇÃO: Filtrar por ano_letivo se sessionId foi fornecido
    if (anoLetivoFiltro) {
      query = query.eq('ano_letivo', anoLetivoFiltro);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error("❌ Erro ao buscar turmas:", error);
      return NextResponse.json({ 
        ok: false, 
        error: error.message, 
        debug: { path: 'admin', escolaId, escolaIdSource, sessionId, anoLetivoFiltro } 
      }, { status: 400 });
    }
    
    let items = data || [];
    
    // ✅ CORREÇÃO: Processar dados relacionados também para admin
    if (include && include.includes('session') && items.length > 0) {
      const anosLetivos = Array.from(new Set(items.map((t: any) => t.ano_letivo).filter(Boolean)));
      if (anosLetivos.length > 0) {
        const { data: sessions } = await (admin as any)
          .from('school_sessions')
          .select('id, nome')
          .in('nome', anosLetivos);
        const sessionMap: Map<string, { id: string; nome: string }> = new Map(
          (sessions || []).map((s: any) => [s.nome as string, { id: s.id as string, nome: s.nome as string }])
        );
        
        items = items.map((turma: any) => {
          const sess = turma?.ano_letivo ? sessionMap.get(turma.ano_letivo as string) : undefined;
          return {
            ...turma,
            session_id: sess?.id ?? null,
            session_nome: turma.ano_letivo,
          };
        });
      }
    }

    return NextResponse.json({ 
      ok: true, 
      items, 
      debug: { 
        path: 'admin', 
        escolaId, 
        escolaIdSource, 
        sessionId, 
        anoLetivoFiltro,
        count: items.length,
        includes: include || 'none'
      } 
    });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("💥 Erro geral:", e);
    return NextResponse.json({ 
      ok: false, 
      error: message, 
      debug: { reason: 'exception' } 
    }, { status: 500 });
  }
}
