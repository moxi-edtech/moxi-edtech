import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { applyKf2ListInvariants } from "@/lib/kf2";
import { requireFeature } from "@/lib/plan/requireFeature";
import { HttpError } from "@/lib/errors";

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

    try {
      await requireFeature("doc_qr_code");
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: err.status });
      }
      throw err;
    }

    // Headers de versionamento (Boas práticas)
    headers.set('Deprecation', 'true');
    headers.set('Link', `</api/escolas/${escolaId}/turmas>; rel="successor-version"`);

    // 3. Parâmetros da URL
    const url = new URL(req.url);
    const turno = url.searchParams.get('turno');
    const busca = url.searchParams.get('busca')?.trim().toLowerCase() || "";
    const status = url.searchParams.get('status');
    const limit = Number(url.searchParams.get('limit') || 30);
    const cursor = url.searchParams.get('cursor');

    // 4. Query ao Banco (SELECT *)
    let query = supabase
      .from('vw_turmas_para_matricula')
      .select(`
        id,
        turma_nome,
        turma_codigo,
        ano_letivo,
        turno,
        sala,
        session_id,
        capacidade_maxima,
        curso_nome,
        classe_nome,
        ocupacao_atual,
        status_validacao
      `)
      .eq('escola_id', escolaId);

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
    
    if (busca) {
      const like = `${busca}%`;
      query = query.or(
        [
          `turma_codigo.ilike.${like}`,
          `turma_nome.ilike.${like}`,
          `sala.ilike.${like}`,
          `curso_nome.ilike.${like}`,
          `classe_nome.ilike.${like}`,
        ].join(',')
      );
    }

    if (cursor) {
      const [cursorNome, cursorId] = cursor.split(',');
      if (cursorNome && cursorId) {
        query = query.or(
          `turma_nome.gt.${cursorNome},and(turma_nome.eq.${cursorNome},id.gt.${cursorId})`
        );
      }
    }

    query = applyKf2ListInvariants(query, {
      limit,
      order: [
        { column: 'turma_nome', ascending: true },
        { column: 'id', ascending: true },
      ],
    });

    const { data: rows, error } = await query;

    if (error) {
        console.error("[API] Erro ao buscar turmas:", error);
        throw error;
    }

    // 5. Mapeamento e Sanitização (AQUI ESTÁ A PROTEÇÃO CONTRA NULL)
    // Transforma dados brutos em dados seguros para o Frontend
    const items = rows?.map((t: any) => ({
        id: t.id,
        nome: t.turma_nome ?? "Sem Nome",
        turma_codigo: t.turma_codigo ?? "",
        ano_letivo: t.ano_letivo,
        turno: t.turno ?? "N/D",
        sala: t.sala ?? "",
        session_id: t.session_id,
        capacidade_maxima: t.capacidade_maxima || 35,
        curso_nome: t.curso_nome ?? "",
        classe_nome: t.classe_nome ?? "",
        status_validacao: t.status_validacao ?? 'rascunho',
        ocupacao_atual: Number(t.ocupacao_atual ?? 0),
    })) || [];

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

    const last = items[items.length - 1];
    const nextCursor = items.length === limit && last ? `${last.nome},${last.id}` : null;

    return NextResponse.json({
      ok: true,
      items,
      total: items.length,
      stats,
      next_cursor: nextCursor,
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
