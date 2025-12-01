import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    
    // 1. Autenticação
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    // 2. Resolver Escola (Lógica mantida)
    let escolaId: string | undefined;
    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('current_escola_id, escola_id')
        .order('created_at', { ascending: false })
        .limit(1);
      escolaId = ((prof?.[0] as any)?.current_escola_id || (prof?.[0] as any)?.escola_id) as string | undefined;
      
      if (!escolaId) {
        const { data: vinc } = await supabase
          .from('escola_usuarios')
          .select('escola_id')
          .eq('user_id', user.id)
          .limit(1);
        escolaId = (vinc?.[0] as any)?.escola_id as string | undefined;
      }
    } catch {}

    if (!escolaId) return NextResponse.json({ ok: true, items: [], total: 0 });

    // 3. Parâmetros da URL
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('session_id') || undefined;
    const turno = url.searchParams.get('turno') || undefined;
    const alunoId = url.searchParams.get('aluno_id') || undefined;

    // 4. CONSULTA PRINCIPAL (Tabela Turmas + Joins)
    // Aqui buscamos os nomes reais das classes e cursos
    let query = supabase
      .from('turmas')
      .select(`
        id, 
        nome, 
        turno, 
        capacidade_maxima, 
        session_id,
        classe:classes ( nome ),
        curso:cursos ( nome )
      `)
      .eq('escola_id', escolaId)
      .order('nome');

    if (sessionId) query = query.eq('session_id', sessionId);
    if (turno) query = query.eq('turno', turno);

    const { data: turmasRaw, error: turmasErr } = await query;

    if (turmasErr) {
      return NextResponse.json({ ok: false, error: turmasErr.message }, { status: 400 });
    }

    if (!turmasRaw || turmasRaw.length === 0) {
      return NextResponse.json({ ok: true, items: [], total: 0 });
    }

    // 5. Buscar Ocupação (Números) separadamente ou via View
    // Usamos a view apenas para pegar o 'total_matriculas_ativas'
    const turmaIds = turmasRaw.map((t: any) => t.id);
    let ocupacaoMap = new Map<string, number>();

    if (turmaIds.length > 0) {
      const { data: occData } = await supabase
        .from('vw_ocupacao_turmas')
        .select('id, total_matriculas_ativas')
        .in('id', turmaIds);
      
      occData?.forEach((row: any) => {
        ocupacaoMap.set(row.id, row.total_matriculas_ativas || 0);
      });
    }

    // 6. Filtrar se aluno já está matriculado (Opcional)
    let turmasFiltradas = turmasRaw;
    if (alunoId) {
      const { data: matriculasExistentes } = await supabase
        .from('matriculas')
        .select('turma_id')
        .eq('escola_id', escolaId)
        .eq('aluno_id', alunoId)
        .in('status', ['ativo', 'ativa'])
        .in('turma_id', turmaIds);
        
      const jaMatriculadoIds = new Set((matriculasExistentes || []).map((m: any) => m.turma_id));
      turmasFiltradas = turmasRaw.filter((t: any) => !jaMatriculadoIds.has(t.id));
    }

    // 7. Montar Resposta Final
    const items = turmasFiltradas.map((t: any) => ({
      id: t.id,
      nome: t.nome,
      turno: t.turno,
      session_id: t.session_id,
      
      // Dados de Estrutura (Objetos e Strings Planas para facilidade)
      classe: t.classe,
      classe_nome: t.classe?.nome || null,
      
      curso: t.curso,
      curso_nome: t.curso?.nome || null,
      
      // Dados Numéricos
      capacidade_maxima: t.capacidade_maxima ?? 35,
      ocupacao_atual: ocupacaoMap.get(t.id) ?? 0
    }));

    return NextResponse.json({ ok: true, items, total: items.length });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}