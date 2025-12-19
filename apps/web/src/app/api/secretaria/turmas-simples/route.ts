import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser, authorizeTurmasManage } from "@/lib/escola/disciplinas";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const headers = new Headers();
    
    // 1. Autenticação
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) return NextResponse.json({ ok: true, items: [], total: 0 }, { headers });

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 });

    headers.set('Deprecation', 'true');
    headers.set('Link', `</api/escolas/${escolaId}/turmas>; rel="successor-version"`);

    // 3. Parâmetros
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('session_id');
    const turno = url.searchParams.get('turno');
    const alunoId = url.searchParams.get('aluno_id');

    if (!sessionId) {
       // Sem sessão (ano letivo), não há turmas para listar neste contexto
       return NextResponse.json({ ok: true, items: [], total: 0 }, { headers });
    }

    // 4. CONSULTA À VIEW
    let query = supabase
      .from('vw_turmas_para_matricula')
      .select('*')
      .eq('escola_id', escolaId)
      .eq('session_id', sessionId)
      // [CORREÇÃO] A view usa 'turma_nome', não 'nome'
      .order('turma_nome', { ascending: true });

    if (turno) query = query.eq('turno', turno);

    const { data: turmasView, error } = await query;

    if (error) {
      console.error("Erro ao buscar turmas disponíveis:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 400, headers });
    }

    let items = turmasView || [];

    // Enriquecer apenas quando necessário (fallback para cursos_oferta)
    let ofertaMap: Record<string, { curso_id?: string | null; classe_id?: string | null }> = {};
    const precisaOferta = (items || []).some((t: any) => !(t as any).curso_id || !(t as any).classe_id);
    if (precisaOferta) {
      const turmaIds = items.map((t: any) => t.id).filter(Boolean);
      if (turmaIds.length > 0) {
        const { data: ofertas } = await supabase
          .from('cursos_oferta')
          .select('turma_id, curso_id, classe_id')
          .in('turma_id', turmaIds as string[]);

        if (ofertas) {
          ofertaMap = ofertas.reduce((acc: typeof ofertaMap, o: any) => {
            acc[o.turma_id] = { curso_id: o.curso_id, classe_id: o.classe_id };
            return acc;
          }, {} as typeof ofertaMap);
        }
      }
    }

    // 5. Filtrar se aluno já está matriculado (Lógica de Negócio)
    if (alunoId && items.length > 0) {
      const { data: matriculasExistentes } = await supabase
        .from('matriculas')
        .select('turma_id')
        .eq('escola_id', escolaId)
        .eq('aluno_id', alunoId)
        .in('status', ['ativo', 'ativa']);
        
      const turmasOcupadas = new Set((matriculasExistentes || []).map((m: any) => m.turma_id));
      items = items.filter((t: any) => !turmasOcupadas.has(t.id));
    }

    // 6. Mapeamento para Frontend (Opcional, mas recomendado para consistência)
    // Garante que o frontend receba 'nome' se estiver esperando isso, mapeando de 'turma_nome'
    const itemsFormatados = items.map((t: any) => {
      const resolvedCursoId = (t as any).curso_id || ofertaMap[t.id]?.curso_id || null;
      const resolvedClasseId = (t as any).classe_id || ofertaMap[t.id]?.classe_id || null;
      return {
        ...t,
        curso_id: resolvedCursoId,
        classe_id: resolvedClasseId,
        curso: t.curso_nome || resolvedCursoId
          ? { id: resolvedCursoId, nome: t.curso_nome, tipo: t.curso_tipo }
          : undefined,
        classe: t.classe_nome || resolvedClasseId
          ? { id: resolvedClasseId, nome: t.classe_nome }
          : undefined,
        nome: t.turma_nome, // Compatibilidade retroativa
      };
    });

    return NextResponse.json({ 
        ok: true, 
        data: itemsFormatados, 
        items: itemsFormatados,
        total: itemsFormatados.length 
    }, { headers });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
