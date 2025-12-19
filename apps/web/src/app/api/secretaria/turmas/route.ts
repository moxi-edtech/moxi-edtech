import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser, authorizeTurmasManage } from "@/lib/escola/disciplinas";

export const dynamic = 'force-dynamic';

// --- GET (Listagem) - Mantido igual, apenas para contexto ---
export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const headers = new Headers();
    
    // 1. Autenticação
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) return NextResponse.json({ ok: true, items: [], total: 0, stats: {} }, { headers });

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 });

    headers.set('Deprecation', 'true');
    headers.set('Link', `</api/escolas/${escolaId}/turmas>; rel="successor-version"`);

    // 3. Parâmetros da URL
    const url = new URL(req.url);
    const turno = url.searchParams.get('turno');
    const busca = url.searchParams.get('busca')?.toLowerCase() || "";
    
    // 4. Query à VIEW
    let query = supabase
      .from('vw_turmas_para_matricula') 
      .select('*')
      .eq('escola_id', escolaId)
      .order('turma_nome', { ascending: true });

    if (turno && turno !== 'todos') query = query.eq('turno', turno);
    
    const { data: rows, error } = await query;

    if (error) {
        console.error("Erro na View:", error);
        throw error;
    }

    // 5. Filtro em Memória
    let items = rows || [];

    if (busca) {
        items = items.filter((t: any) => 
            (t.turma_codigo && t.turma_codigo.toLowerCase().includes(busca)) || // NOVO
            (t.turma_nome && t.turma_nome.toLowerCase().includes(busca)) || 
            (t.sala && t.sala.toLowerCase().includes(busca)) ||
            (t.curso_nome && t.curso_nome.toLowerCase().includes(busca)) ||
            (t.classe_nome && t.classe_nome.toLowerCase().includes(busca))
        );
    }

    // 6. Estatísticas
    let totalAlunos = 0;
    const porTurnoMap: Record<string, number> = {};

    items.forEach((t: any) => {
        totalAlunos += (t.ocupacao_atual || 0);
        const tr = t.turno || 'sem_turno';
        porTurnoMap[tr] = (porTurnoMap[tr] || 0) + 1;
    });

    const stats = {
        totalTurmas: items.length,
        totalAlunos: totalAlunos,
        porTurno: Object.entries(porTurnoMap).map(([k, v]) => ({ turno: k, total: v }))
    };

    return NextResponse.json({
      ok: true,
      items,
      total: items.length,
      stats
    }, { headers });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// --- POST (Criação) - AQUI ESTÁ A CORREÇÃO ---
export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const headers = new Headers();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 });

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 });

    headers.set('Deprecation', 'true');
    headers.set('Link', `</api/escolas/${escolaId}/turmas>; rel="successor-version"`);

    const body = await req.json();
    const {
      nome,
      turma_codigo, // NOVO CAMPO
      turno,
      sala,
      session_id,
      ano_letivo,
      capacidade_maxima,
      curso_id,
      classe_id
    } = body;

    if (!turma_codigo || !turno || !ano_letivo) {
      return NextResponse.json({ ok: false, error: 'Código da Turma, Turno e Ano Letivo são obrigatórios' }, { status: 400 });
    }

    const anoLetivoInt = typeof ano_letivo === 'string' ? parseInt(ano_letivo.replace(/\D/g, ''), 10) : ano_letivo;
    if (isNaN(anoLetivoInt)) {
        return NextResponse.json({ ok: false, error: 'Ano Letivo inválido' }, { status: 400 });
    }
    
    // Inserção na tabela física 'turmas'
    const { data: newTurma, error } = await supabase
      .from('turmas')
      .insert({
        escola_id: escolaId,
        nome, // O nome ainda pode ser um descritivo (Ex: 10ª Classe - Manhã)
        turma_codigo, // O código único para o ano (Ex: 10A)
        ano_letivo: anoLetivoInt, // O ano como inteiro
        turno,
        sala: sala || null,
        session_id: session_id || null,
        capacidade_maxima: capacidade_maxima || 35,
        curso_id: curso_id || null,   
        classe_id: classe_id || null  
      })
      .select()
      .single();

    // --- BLOCO DE TRATAMENTO DE DUPLICIDADE ---
    if (error) {
      if (error.code === '23505') {
        // A constraint será 'unique_turma_por_ano_e_codigo'
        return NextResponse.json(
          { 
            ok: false, 
            error: `O código de turma "${turma_codigo}" já está em uso no ano letivo de ${ano_letivo}.` 
          }, 
          { status: 409, headers } // Conflict
        );
      }
      
      // Se não for duplicidade, lança o erro original
      throw error;
    }
    // ------------------------------------------

    return NextResponse.json({ 
      ok: true, 
      data: newTurma,
      message: 'Turma criada com sucesso' 
    }, { headers });

  } catch (e: any) {
    console.error("Erro POST Turma:", e);
    return NextResponse.json({ ok: false, error: e.message || String(e) }, { status: 500 });
  }
}
