import { NextRequest, NextResponse } from "next/server";
import { performance } from "node:perf_hooks";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { canManageEscolaResources } from "../permissions";
import { applyKf2ListInvariants } from "@/lib/kf2";
import { validarCurriculoParaTurma } from "@/lib/academico/turma-gate";

const normalizeTurno = (turno: string | undefined): "M" | "T" | "N" | null => {
  const t = (turno || "").trim().toLowerCase();
  switch (t) {
    case "m":
    case "manha":
    case "manhã":
      return "M";
    case "t":
    case "tarde":
      return "T";
    case "n":
    case "noite":
      return "N";
    default:
      if (["M", "T", "N"].includes((turno || "").toUpperCase())) {
        return (turno || "").toUpperCase() as "M" | "T" | "N";
      }
      return null;
  }
};

// --- GET: Listar Turmas (Admin) ---
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await params;
  const shouldLog = process.env.NODE_ENV !== 'production';
  const logId = shouldLog ? `escolas.turmas.${Date.now()}.${Math.random().toString(36).slice(2, 8)}` : '';
  const log = (label: string, durationMs: number) => {
    if (shouldLog) {
      console.log(`${logId}.${label}: ${durationMs.toFixed(1)}ms`);
    }
  };
  const totalStart = shouldLog ? performance.now() : 0;
  try {
    const clientStart = shouldLog ? performance.now() : 0;
    const supabase = await createRouteClient();
    if (shouldLog) log('client', performance.now() - clientStart);
    const authStart = shouldLog ? performance.now() : 0;
    const { data: auth } = await supabase.auth.getUser();
    if (shouldLog) log('auth', performance.now() - authStart);
    const user = auth?.user;
    if (!user) {
      if (shouldLog) log('total', performance.now() - totalStart);
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? undefined;
    const resolveStart = shouldLog ? performance.now() : 0;
    const userEscolaId = await resolveEscolaIdForUser(
      supabase as any,
      user.id,
      escolaId,
      metaEscolaId ? String(metaEscolaId) : null
    );
    if (shouldLog) log('resolve', performance.now() - resolveStart);
    if (!userEscolaId || userEscolaId !== escolaId) {
      if (shouldLog) log('total', performance.now() - totalStart);
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const permsStart = shouldLog ? performance.now() : 0;
    const allowed = await canManageEscolaResources(supabase as any, escolaId, user.id);
    if (shouldLog) log('perms', performance.now() - permsStart);
    if (!allowed) {
      if (shouldLog) log('total', performance.now() - totalStart);
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    // 3. Parâmetros da URL
    const url = new URL(request.url);
    const turno = url.searchParams.get('turno');
    const cursoId = url.searchParams.get('curso_id');
    const status = url.searchParams.get('status');
    const limit = Number(url.searchParams.get('limit') || 30);
    const cursor = url.searchParams.get('cursor');

    // 4. Query usando a view que resolve curso/classe
    let query = supabase
      .from('vw_turmas_para_matricula')
      .select('id, turma_nome, turma_codigo, turno, sala, capacidade_maxima, curso_nome, classe_nome, status_validacao, ocupacao_atual, ultima_matricula, escola_id, curso_id')
      .eq('escola_id', escolaId)
    
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

    const normalizedTurno = turno && turno !== 'todos' ? normalizeTurno(turno) : null;
    if (normalizedTurno) query = query.eq('turno', normalizedTurno);
    if (cursoId) query = query.eq('curso_id', cursoId);
    if (status && status !== 'todos') query = query.eq('status_validacao', status);
    
    const isMissingColumn = (err: any) => {
      const msg = err?.message as string | undefined
      const code = err?.code as string | undefined
      return code === '42703' || (msg && /column .* does not exist|does not exist/i.test(msg))
    }
    const isMissingView = (err: any) => {
      const msg = err?.message as string | undefined
      const code = err?.code as string | undefined
      return code === '42P01' || (msg && /relation .* does not exist|does not exist/i.test(msg))
    }
    const isLegacyDependency = (err: any) => {
      const msg = err?.message as string | undefined
      return Boolean(msg && /escola_usuarios/i.test(msg))
    }

    let rows: any[] | null = null
    const queryStart = shouldLog ? performance.now() : 0;
    const { data: viewRows, error } = await query;
    if (shouldLog) log('query', performance.now() - queryStart);

    if (error) {
      console.error("Erro na view vw_turmas_para_matricula:", error);
      if (!(isMissingColumn(error) || isMissingView(error) || isLegacyDependency(error))) {
        throw error;
      }

      let fallbackQuery = supabase
        .from('turmas' as any)
        .select('id, nome, turma_codigo, turno, sala, capacidade_maxima, status_validacao, escola_id, curso_id, classe_id')
        .eq('escola_id', escolaId)

      if (cursor) {
        const [cursorNome, cursorId] = cursor.split(',');
        if (cursorNome && cursorId) {
          fallbackQuery = fallbackQuery.or(
            `nome.gt.${cursorNome},and(nome.eq.${cursorNome},id.gt.${cursorId})`
          );
        }
      }

      fallbackQuery = applyKf2ListInvariants(fallbackQuery, {
        limit,
        order: [
          { column: 'nome', ascending: true },
          { column: 'id', ascending: true },
        ],
      })

      if (normalizedTurno) fallbackQuery = fallbackQuery.eq('turno', normalizedTurno);
      if (cursoId) fallbackQuery = fallbackQuery.eq('curso_id', cursoId);
      if (status && status !== 'todos') fallbackQuery = fallbackQuery.eq('status_validacao', status);

      const fallbackStart = shouldLog ? performance.now() : 0;
      const { data: fallbackRows, error: fallbackError } = await fallbackQuery
      if (shouldLog) log('fallback.query', performance.now() - fallbackStart);
      if (fallbackError) {
        console.error('Erro no fallback de turmas:', fallbackError)
        throw fallbackError
      }

      rows = (fallbackRows || []).map((t: any) => ({
        id: t.id,
        turma_nome: t.nome ?? null,
        turma_codigo: t.turma_codigo ?? null,
        turno: t.turno ?? null,
        sala: t.sala ?? null,
        capacidade_maxima: t.capacidade_maxima ?? null,
        curso_nome: null,
        classe_nome: null,
        status_validacao: t.status_validacao ?? null,
        ocupacao_atual: 0,
        ultima_matricula: null,
        escola_id: t.escola_id ?? escolaId,
        curso_id: t.curso_id ?? null,
      }))
    } else {
      rows = viewRows as any[]
    }

    // Enriquecimento para o frontend exibir Curso/Classe corretamente
    const items = (rows || []).map((t: any) => ({
      ...t,
      nome: t.turma_nome ?? 'Sem Nome',
      turno: t.turno ?? 'sem_turno',
      sala: t.sala ?? '',
      capacidade_maxima: t.capacidade_maxima ?? 35,
      curso_nome: t.curso_nome ?? '',
      classe_nome: t.classe_nome ?? '',
      status_validacao: t.status_validacao ?? 'ativo',
      ocupacao_atual: t.ocupacao_atual ?? 0,
      ultima_matricula: t.ultima_matricula ?? null,
      turma_codigo: t.turma_codigo ?? '',
    }));

    const porTurnoMap: Record<string, number> = {};
    let totalAlunos = 0;

    items.forEach((t: any) => {
      const key = String(t.turno || 'sem_turno')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      porTurnoMap[key] = (porTurnoMap[key] || 0) + 1;
      totalAlunos += Number(t.ocupacao_atual || 0);
    });

    const stats = {
      totalTurmas: items.length,
      totalAlunos,
      porTurno: Object.entries(porTurnoMap).map(([turnoKey, total]) => ({ turno: turnoKey, total })),
    };

    const last = items[items.length - 1];
    const nextCursor = items.length === limit && last ? `${last.nome},${last.id}` : null;

    const response = NextResponse.json({
      ok: true,
      items,
      total: items.length,
      stats,
      next_cursor: nextCursor,
    });
    if (shouldLog) log('total', performance.now() - totalStart);
    return response;

  } catch (e: any) {
    const rawMessage =
      e?.message || e?.error || (typeof e === 'string' ? e : null);
    const fallbackMessage = (() => {
      if (rawMessage) return rawMessage;
      try {
        return JSON.stringify(e);
      } catch {
        return 'Erro inesperado';
      }
    })();

    const response = NextResponse.json(
      {
        ok: false,
        error: fallbackMessage,
        details: e?.details ?? null,
        hint: e?.hint ?? null,
        code: e?.code ?? null,
      },
      { status: 500 }
    );
    if (shouldLog) log('total', performance.now() - totalStart);
    return response;
  }
}

// --- POST: Criar Turma (COM BLINDAGEM) ---
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await params;
  
  try {
    const supabase = await createRouteClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId);
    if (!userEscolaId || userEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: "Permissão negada" }, { status: 403 });
    }

    const allowed = await canManageEscolaResources(supabase as any, escolaId, user.id);
    if (!allowed) {
      return NextResponse.json({ ok: false, error: "Permissão negada" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { 
      nome, 
      turno: turnoRaw, 
      sala, 
      ano_letivo, // OBRIGATÓRIO PARA A CONSTRAINT
      capacidade_maxima, 
      curso_id, 
      classe_id,
      letra,
      classe_num
    } = body;
    
    const turno = normalizeTurno(turnoRaw);

    if (!nome || !turno || !ano_letivo || !curso_id) {
        return NextResponse.json({ ok: false, error: "Nome, Turno, Ano Letivo e curso_id são obrigatórios" }, { status: 400 });
    }

    const gate = await validarCurriculoParaTurma(supabase as any, {
      escola_id: escolaId,
      curso_id: String(curso_id),
      ano_letivo: String(ano_letivo),
      classe_id: classe_id ? String(classe_id) : null,
    });

    if (!gate.ok) {
      return NextResponse.json({ ok: false, error: gate.error, code: gate.code }, { status: 422 });
    }

    // Valida ano_letivo contra anos_letivos da escola
    try {
      const { data: anoRow } = await (supabase as any)
        .from('anos_letivos')
        .select('ano')
        .eq('escola_id', escolaId)
        .eq('ano', Number(ano_letivo))
        .maybeSingle()
      if (!anoRow) {
        return NextResponse.json({ ok: false, error: 'Ano letivo não encontrado para esta escola' }, { status: 400 })
      }
    } catch (err) {
      // se a tabela não existir neste ambiente, deixa seguir
    }

    // Insert direto na tabela
    const { data, error } = await (supabase as any)
      .from('turmas')
      .insert({
        escola_id: escolaId,
        nome,
        turno,
        ano_letivo, // Importante para diferenciar Turma A 2024 de Turma A 2025
        sala: sala || null,
        capacidade_maxima: capacidade_maxima || 35,
        curso_id: curso_id || null,
        classe_id: classe_id || null,
        letra: letra || null,
        classe_num: classe_num ?? null
      })
      .select()
      .single();

    if (error) {
        // [BLINDAGEM] Tratamento do Erro de Constraint Unique
        if (error.code === '23505') {
            return NextResponse.json(
                { 
                  ok: false, 
                  error: `A Turma "${nome}" já existe para esta Classe/Curso neste turno e ano letivo.` 
                }, 
                { status: 409 } // Conflict
            );
        }
        throw error;
    }

    return NextResponse.json({ ok: true, data, message: "Turma criada com sucesso" });

  } catch (e: any) {
    console.error("Erro POST Turma:", e);
    return NextResponse.json({ ok: false, error: e.message || String(e) }, { status: 500 });
  }
}
