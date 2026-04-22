import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { applyKf2ListInvariants } from "@/lib/kf2";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const headers = new Headers();
    
    // 1. Autenticação
    const { data: userRes } = await supabase.auth.getUser();
    let user = userRes?.user;
    if (!user) {
      const authHeader = req.headers.get('authorization');
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (token) {
        const { data: tokenUser } = await supabase.auth.getUser(token);
        user = tokenUser?.user ?? null;
      }
    }
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    const url = new URL(req.url);
    const escolaIdFromQuery = url.searchParams.get('escolaId') || url.searchParams.get('escola_id');

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaIdFromQuery);
    if (!escolaId) return NextResponse.json({ ok: true, items: [], total: 0 }, { headers });

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 });

    headers.set('Deprecation', 'true');
    headers.set('Link', `</api/escolas/${escolaId}/turmas>; rel="successor-version"`);

    // 3. Parâmetros
    let sessionId = url.searchParams.get('session_id');
    const turno = url.searchParams.get('turno');
    const alunoId = url.searchParams.get('aluno_id');
    const anoParam = url.searchParams.get('ano') || url.searchParams.get('ano_letivo');

    let anoLetivo = anoParam ? Number(anoParam) : null;
    if (!Number.isFinite(anoLetivo)) anoLetivo = null;

    if (!anoLetivo && sessionId) {
      try {
        const { data: sessionRow } = await supabase
          .from('anos_letivos')
          .select('ano')
          .eq('id', sessionId)
          .maybeSingle();

        const anoResolved = sessionRow?.ano;
        if (anoResolved !== undefined && anoResolved !== null) {
          const anoNumber = typeof anoResolved === 'string' ? Number(anoResolved) : anoResolved;
          if (Number.isFinite(anoNumber)) anoLetivo = anoNumber as number;
        }
      } catch (err) {
        console.warn('Falha ao resolver ano letivo pela sessão', err);
      }
    }

    if (!sessionId && !anoLetivo) {
      // 3.1 Tentar buscar o ano letivo ativo se nada for providenciado
      const { data: activeSession } = await supabase
        .from('anos_letivos')
        .select('id, ano')
        .eq('escola_id', escolaId)
        .eq('ativo', true)
        .maybeSingle();

      if (activeSession) {
        sessionId = activeSession.id;
        anoLetivo = typeof activeSession.ano === 'string' ? Number(activeSession.ano) : activeSession.ano;
      }
    }

    if (!sessionId && !anoLetivo) {
       // Sem sessão (ano letivo), não há turmas para listar neste contexto
       return NextResponse.json({ ok: true, items: [], total: 0 }, { headers });
    }

    // 4. CONSULTA À VIEW
    let query = supabase
      .from('vw_turmas_para_matricula')
      .select(
        [
          'id',
          'escola_id',
          'session_id',
          'turma_nome',
          'turma_codigo',
          'turno',
          'capacidade_maxima',
          'sala',
          'classe_nome',
          'curso_nome',
          'curso_tipo',
          'curso_is_custom',
          'curso_global_hash',
          'classe_id',
          'curso_id',
          'ano_letivo',
          'ocupacao_atual',
          'ultima_matricula',
          'status_validacao',
        ].join(', ')
      )
      .eq('escola_id', escolaId);

    if (sessionId && anoLetivo) {
      query = query.eq('ano_letivo', anoLetivo).or(`session_id.eq.${sessionId},session_id.is.null`);
    } else if (sessionId) {
      query = query.eq('session_id', sessionId);
    } else if (anoLetivo) {
      query = query.eq('ano_letivo', anoLetivo);
    }

    if (turno) query = query.eq('turno', turno);

    query = applyKf2ListInvariants(query, {
      defaultLimit: 50,
      order: [
        { column: 'turma_nome', ascending: true },
        { column: 'id', ascending: false },
      ],
    });

    const { data: turmasView, error } = await query;

    if (error) {
      console.error("Erro ao buscar turmas disponíveis:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 400, headers });
    }

    let items: any[] = turmasView || [];

    // Fallback operacional:
    // algumas escolas têm turmas em produção, mas a view de matrícula pode vir vazia
    // por defasagem de refresh/critério. Para módulos como horários, usamos turmas reais.
    if (!error && items.length === 0) {
      let turmasQuery = supabase
        .from('turmas')
        .select('id, nome, turma_codigo, turma_code, turno, capacidade_maxima, sala, classe_id, curso_id, ano_letivo, status_validacao, session_id')
        .eq('escola_id', escolaId);

      if (sessionId && anoLetivo) {
        turmasQuery = turmasQuery.eq('ano_letivo', anoLetivo).or(`session_id.eq.${sessionId},session_id.is.null`);
      } else if (sessionId) {
        turmasQuery = turmasQuery.eq('session_id', sessionId);
      } else if (anoLetivo) {
        turmasQuery = turmasQuery.eq('ano_letivo', anoLetivo);
      }

      if (turno) turmasQuery = turmasQuery.eq('turno', turno);

      turmasQuery = applyKf2ListInvariants(turmasQuery, {
        defaultLimit: 50,
        order: [
          { column: 'nome', ascending: true },
          { column: 'id', ascending: false },
        ],
      });

      const { data: turmasFallback, error: fallbackError } = await turmasQuery;
      if (fallbackError) {
        console.error('Erro no fallback de turmas-simples:', fallbackError);
      } else {
        items = (turmasFallback || []).map((t: any) => ({
          id: t.id,
          escola_id: escolaId,
          session_id: t.session_id ?? null,
          turma_nome: t.nome ?? null,
          turma_codigo: t.turma_codigo ?? t.turma_code ?? null,
          turno: t.turno ?? null,
          capacidade_maxima: t.capacidade_maxima ?? null,
          sala: t.sala ?? null,
          classe_nome: null,
          curso_nome: null,
          curso_tipo: null,
          curso_is_custom: null,
          curso_global_hash: null,
          classe_id: t.classe_id ?? null,
          curso_id: t.curso_id ?? null,
          ano_letivo: t.ano_letivo ?? null,
          ocupacao_atual: 0,
          ultima_matricula: null,
          status_validacao: t.status_validacao ?? null,
        }));
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
      const resolvedCursoId = (t as any).curso_id || null;
      const resolvedClasseId = (t as any).classe_id || null;
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
