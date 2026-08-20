import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { applyKf2ListInvariants } from "@/lib/kf2";
import { resolveRaaProgressionForMatricula, RaaProgressionUnavailableError } from "@/lib/academico/raa-progression-server";

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
    const matriculaId = url.searchParams.get('matricula_id');
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
      query = query.eq('ano_letivo', anoLetivo).eq('session_id', sessionId);
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

    // Rematrícula no balcão consome a mesma decisão global da RAA.
    let progressao: {
      aplicada: boolean;
      modo: 'promocao' | 'retencao' | 'indefinida';
      estado: 'notas_pendentes' | 'reprovado' | 'classe_nao_identificada';
      classe_origem: number | null;
      classe_destino: number | null;
      turma_origem_id: string | null;
      mensagem: string;
      orientacao?: {
        titulo: string;
        mensagem: string;
        proximo_passo: string;
        acoes: Array<{ id: string; label: string; href: string; prioridade: 'principal' | 'secundaria' }>;
      } | null;
    } | null = null;

    if (matriculaId && alunoId && sessionId && anoLetivo && items.length > 0) {
      const { data: origem } = await supabase
        .from('matriculas')
        .select('id, aluno_id, status, ano_letivo, turma_id, turmas:turma_id(classe_id, curso_id)')
        .eq('escola_id', escolaId)
        .eq('id', matriculaId)
        .eq('aluno_id', alunoId)
        .maybeSingle();

      const turmaOrigem = Array.isArray((origem as any)?.turmas)
        ? (origem as any).turmas[0]
        : (origem as any)?.turmas;
      const classeOrigemId = turmaOrigem?.classe_id ?? null;
      const cursoOrigemId = turmaOrigem?.curso_id ?? null;
      const classeIds = Array.from(new Set([
        classeOrigemId,
        ...items.map((item: any) => item.classe_id).filter(Boolean),
      ]));
      const { data: classesProgressao } = classeIds.length > 0
        ? await supabase.from('classes').select('id, nome, numero').eq('escola_id', escolaId).in('id', classeIds)
        : { data: [] };
      const classeById = new Map((classesProgressao || []).map((classe: any) => [classe.id, classe]));
      const numeroClasse = (classe: any) => {
        const numero = Number(classe?.numero);
        if (Number.isFinite(numero) && numero > 0) return numero;
        const match = String(classe?.nome || '').match(/(\d{1,2})\s*(?:ª|a)?/i);
        return match ? Number(match[1]) : null;
      };
      const origemClasseNumero = numeroClasse(classeById.get(classeOrigemId));
      let progressionResult: Awaited<ReturnType<typeof resolveRaaProgressionForMatricula>> | null = null;
      let progressionError: string | null = null;
      try {
        progressionResult = await resolveRaaProgressionForMatricula(supabase, escolaId, {
          id: (origem as any)?.id,
          aluno_id: (origem as any)?.aluno_id ?? alunoId,
          turma_id: (origem as any)?.turma_id,
        });
      } catch (error) {
        progressionError = error instanceof RaaProgressionUnavailableError
          ? error.message
          : 'Não foi possível resolver a progressão académica.';
      }
      const progressionDecision = progressionResult?.progression.decision ?? 'pendente';
      const reprovado = progressionDecision.startsWith('retido');
      const modo = reprovado ? 'retencao' : 'promocao';
      const classeDestinoNumero = progressionResult?.progression.etapaDestino?.classeNum
        ?? (reprovado ? origemClasseNumero : null);
      const cursoFiltrado = cursoOrigemId
        ? items.filter((item: any) => !item.curso_id || item.curso_id === cursoOrigemId)
        : items;
      const elegiveis = classeDestinoNumero == null
        ? []
        : cursoFiltrado.filter((item: any) => numeroClasse(classeById.get(item.classe_id)) === classeDestinoNumero);
      items = elegiveis;
      progressao = {
        aplicada: origemClasseNumero != null,
        modo,
        estado: reprovado ? 'reprovado' : (origemClasseNumero == null ? 'classe_nao_identificada' : 'notas_pendentes'),
        classe_origem: origemClasseNumero,
        classe_destino: classeDestinoNumero,
        turma_origem_id: (origem as any)?.turma_id ?? null,
        orientacao: progressionResult?.orientacao ?? (progressionError
          ? {
              titulo: 'Análise académica bloqueada',
              mensagem: progressionError,
              proximo_passo: 'Corrigir a configuração ou os dados académicos e executar novamente.',
              acoes: progressionError.toLowerCase().includes('política')
                ? [{ id: 'configurar_politica', label: 'Configurar política de progressão', href: '/admin/configuracoes/avaliacao', prioridade: 'principal' as const }]
                : [{ id: 'rever_dados', label: 'Rever dados académicos', href: '/secretaria/fechamento-academico', prioridade: 'principal' as const }],
            }
          : null),
        mensagem: origemClasseNumero == null
          ? 'A classe de origem não foi identificada; configure a classe antes de rematricular.'
          : progressionError
            ? progressionError
            : progressionDecision === 'concluiu'
              ? 'Aluno concluinte: não existe uma etapa seguinte para rematrícula.'
              : reprovado
                ? `Resultado global ${progressionDecision}: retenção na ${origemClasseNumero}ª classe.`
                : progressionDecision === 'inscricao_condicional'
                  ? `Inscrição condicional: etapa seguinte ${classeDestinoNumero ?? 'não identificada'}ª classe, com disciplinas pendentes visíveis.`
            : progressionResult?.orientacao?.mensagem ?? `Estado global ${progressionDecision}: concluir a análise académica antes de rematricular.`,
      };
    }

    // Fallback operacional:
    // algumas escolas têm turmas em produção, mas a view de matrícula pode vir vazia
    // por defasagem de refresh/critério. Para módulos como horários, usamos turmas reais.
    // No balcão de rematrícula, porém, um resultado vazio pode significar que a
    // progressão académica bloqueou todas as opções. Repor todas as turmas aqui
    // permitiria escolher uma classe inválida e contrariaria a validação do backend.
    const hasRematriculaAcademicContext = Boolean(matriculaId && alunoId && sessionId && anoLetivo);
    if (!error && items.length === 0 && !hasRematriculaAcademicContext) {
      let turmasQuery = supabase
        .from('turmas')
        .select('id, nome, turma_codigo, turma_code, turno, capacidade_maxima, sala, classe_id, curso_id, ano_letivo, status_validacao, session_id')
        .eq('escola_id', escolaId);

      if (sessionId && anoLetivo) {
        turmasQuery = turmasQuery.eq('ano_letivo', anoLetivo).eq('session_id', sessionId);
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

    if (items.length > 0) {
      const ids = items.map((t: any) => t.id).filter(Boolean);
      const { data: freshSalas } = await supabase
        .from('turmas')
        .select('id, sala')
        .in('id', ids);

      if (freshSalas) {
        const salaMap = new Map(freshSalas.map((t: any) => [t.id, t.sala]));
        items = items.map((t: any) => ({
          ...t,
          sala: salaMap.get(t.id) ?? t.sala,
        }));
      }
    }

    // 5. Filtrar se aluno já está matriculado (Lógica de Negócio)
    if (alunoId && items.length > 0) {
      let matriculasQuery = supabase
        .from('matriculas')
        .select('turma_id')
        .eq('escola_id', escolaId)
        .eq('aluno_id', alunoId)
        .in('status', ['ativo', 'ativa']);

      if (sessionId) {
        matriculasQuery = matriculasQuery.eq('session_id', sessionId);
      } else if (anoLetivo) {
        matriculasQuery = matriculasQuery.eq('ano_letivo', anoLetivo);
      }

      const { data: matriculasExistentes } = await matriculasQuery;
        
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
        total: itemsFormatados.length,
        progressao,
    }, { headers });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
