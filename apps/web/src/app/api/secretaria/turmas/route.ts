import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser, authorizeTurmasManage } from "@/lib/escola/disciplinas";

// Força a renderização dinâmica para garantir que a autenticação seja verificada a cada request
export const dynamic = 'force-dynamic';

// --- GET: LISTAGEM BLINDADA ---
export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const headers = new Headers();
    
    // 1. Autenticação & Contexto
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) {
      // Retorna vazio se não tiver escola, sem erro
      return NextResponse.json({ ok: true, items: [], total: 0, stats: {} }, { headers });
    }

    // 2. Permissão (RBAC)
    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id);
    if (!authz.allowed) {
      return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão de acesso.' }, { status: 403 });
    }

    // Headers de versionamento (Boas práticas)
    headers.set('Deprecation', 'true');
    headers.set('Link', `</api/escolas/${escolaId}/turmas>; rel="successor-version"`);

    // 3. Parâmetros da URL
    const url = new URL(req.url);
    const turno = url.searchParams.get('turno');
    const busca = url.searchParams.get('busca')?.trim().toLowerCase() || "";
    const status = url.searchParams.get('status'); // Novo: Captura o parâmetro de status

    // 4. Query ao Banco (SELECT *)
    let query = supabase
      .from('turmas') 
      .select(`
        *,
        curso:cursos(nome),
        classe:classes(nome),
        matriculas(count)
      `)
      .eq('escola_id', escolaId)
      .order('nome', { ascending: true });

    // Filtro de turno no Nível do Banco (Mais performático)
    if (turno && turno !== 'todos') {
        if (turno === 'manha') query = query.ilike('turno', 'Manhã%');
        else if (turno === 'tarde') query = query.ilike('turno', 'Tarde%');
        else if (turno === 'noite') query = query.ilike('turno', 'Noite%');
        else query = query.eq('turno', turno);
    }

    // Filtro de status_validacao no Nível do Banco
    if (status && status !== 'todos') {
      query = query.eq('status_validacao', status);
    }
    
    const { data: rows, error } = await query;

    if (error) {
        console.error("[API] Erro ao buscar turmas:", error);
        throw error;
    }

    // 5. Mapeamento e Sanitização (AQUI ESTÁ A PROTEÇÃO CONTRA NULL)
    // Transforma dados brutos em dados seguros para o Frontend
    let items = rows?.map((t: any) => ({
        id: t.id,
        // BLINDAGEM: Se vier null, entrega string vazia ou valor default.
        // Isso impede o erro "toLowerCase of undefined" no client.
        nome: t.nome ?? "Sem Nome", 
        turma_codigo: t.turma_codigo ?? "",
        
        ano_letivo: t.ano_letivo, // Pode ser null se não definido, mas não quebra string functions
        turno: t.turno ?? "N/D",
        sala: t.sala ?? "",
        session_id: t.session_id,
        capacidade_maxima: t.capacidade_maxima || 35, // Default visual
        
        // Flattening das Relações (Trazendo pra raiz do objeto)
        curso_nome: t.curso?.nome ?? "",
        classe_nome: t.classe?.nome ?? "",
        
        // Status & Stats
        status_validacao: t.status_validacao ?? 'ativo',
        ocupacao_atual: t.matriculas?.[0]?.count || 0
    })) || [];

    // 6. Filtro de Busca Texto (In-Memory)
    // Usado para filtrar por campos relacionados que são difíceis de filtrar no Supabase simples
    if (busca) {
        items = items.filter((t) => 
            t.turma_codigo.toLowerCase().includes(busca) ||
            t.nome.toLowerCase().includes(busca) || 
            t.sala.toLowerCase().includes(busca) ||
            t.curso_nome.toLowerCase().includes(busca) ||
            t.classe_nome.toLowerCase().includes(busca)
        );
    }

    // 7. Cálculo de Estatísticas (KPIs)
    let totalAlunos = 0;
    const porTurnoMap: Record<string, number> = {};

    items.forEach((t) => {
        totalAlunos += (t.ocupacao_atual || 0);
        // Normalização agressiva para agrupar "Manhã", "manha" e "MANHÃ"
        const tr = t.turno.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); 
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
    console.error("[API] Critical Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// --- POST: CRIAÇÃO SEGURA ---
export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const headers = new Headers();
    
    // 1. Auth Check
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 });

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 });

    // 2. Parse Body
    const body = await req.json();
    const {
      nome,
      turma_codigo,
      turno,
      sala,
      session_id,
      ano_letivo,
      capacidade_maxima,
      curso_id,
      classe_id,
      status_validacao // Opcional: frontend pode mandar 'rascunho'
    } = body;

    // 3. Validação Básica
    if (!turma_codigo || !turno || !ano_letivo) {
      return NextResponse.json({ ok: false, error: 'Campos obrigatórios: Código, Turno e Ano Letivo.' }, { status: 400 });
    }

    // Sanitização de Inteiros
    const anoLetivoInt = typeof ano_letivo === 'string' ? parseInt(ano_letivo.replace(/\D/g, ''), 10) : ano_letivo;
    const capacidadeInt = capacidade_maxima ? parseInt(String(capacidade_maxima), 10) : 35;
    
    // Define status (Ativo por padrão se for criação manual)
    const statusFinal = status_validacao || 'ativo';

    // 4. Insert
    const { data: newTurma, error } = await supabase
      .from('turmas')
      .insert({
        escola_id: escolaId,
        nome: nome || `Turma ${turma_codigo}`, // Fallback de nome se não vier
        turma_codigo,
        ano_letivo: anoLetivoInt,
        turno,
        sala: sala || null,
        session_id: session_id || null,
        capacidade_maxima: capacidadeInt,
        curso_id: curso_id || null,   
        classe_id: classe_id || null,
        status_validacao: statusFinal
      })
      .select()
      .single();

    // 5. Tratamento de Erro de Banco (Ex: Código Duplicado)
    if (error) {
      if (error.code === '23505') { // Postgres Unique Violation
        return NextResponse.json(
          { ok: false, error: `Já existe uma turma com o código "${turma_codigo}" neste ano.` }, 
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ 
      ok: true, 
      data: newTurma,
      message: 'Turma criada com sucesso' 
    }, { headers });

  } catch (e: any) {
    console.error("[API] Erro POST Turma:", e);
    return NextResponse.json({ ok: false, error: e.message || "Erro interno ao criar turma." }, { status: 500 });
  }
}
