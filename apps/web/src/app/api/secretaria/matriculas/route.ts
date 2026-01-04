import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { resolveTabelaPreco } from "@/lib/financeiro/tabela-preco";
import { resolveEscolaIdForUser, authorizeMatriculasManage } from "@/lib/escola/disciplinas";

let legacySchoolSessionsMissing = false;
let legacySchoolSessionsWarned = false;

function markLegacySchoolSessionsMissing(err?: { code?: string } | null) {
  if (err?.code === 'PGRST205') {
    legacySchoolSessionsMissing = true;
    if (!legacySchoolSessionsWarned) {
      console.info('Tabela legacy school_sessions ausente; ignorando consultas legadas.');
      legacySchoolSessionsWarned = true;
    }
    return true;
  }
  return false;
}

function inferAnoLetivo(...valores: Array<string | number | null | undefined>): number | null {
  for (const valor of valores) {
    if (valor === null || valor === undefined) continue;
    if (typeof valor === "number" && Number.isFinite(valor)) return valor;
    const match = String(valor).match(/(19|20)\d{2}/);
    if (match?.[0]) return Number(match[0]);
  }
  return null;
}

function isMatriculasViewMissing(error: any) {
  const code = String(error?.code || "").toUpperCase();
  const message = (error?.message || "").toLowerCase();
  const details = (error?.details || "").toLowerCase();

  return (
    code === "42P01" ||
    code === "PGRST302" ||
    code === "PGRST205" ||
    message.includes("vw_matriculas_validas") ||
    details.includes("vw_matriculas_validas") ||
    (message.includes("relation") && message.includes("vw_matriculas_validas"))
  );
}

const ACTIVE_STATUS_VALUES = ["ativa", "ativo", "active"];

function isActiveStatus(value?: string | null) {
  return ACTIVE_STATUS_VALUES.includes(String(value || "").toLowerCase());
}

async function fetchMatriculasFallback(
  admin: SupabaseClient<Database>,
  opts: {
    escolaId: string;
    sessionAno: number | null;
    sessionId: string;
    classeId: string;
    cursoId: string;
    classeIdsForNivel: string[];
    turmaId: string;
    status?: string;
    statusIn: string[];
    q: string;
    sinceDate: string | null;
    start: number;
    end: number;
  }
) {
  if (opts.turmaId === "null") return { items: [], total: 0 };

  let query = admin
    .from("matriculas")
    .select(
      `
        id,
        escola_id,
        aluno_id,
        turma_id,
        numero_matricula,
        numero_chamada,
        ano_letivo,
        session_id,
        data_matricula,
        status,
        created_at,
        alunos!inner(nome, bi_numero, numero_processo),
        turmas!inner(
          id,
          nome,
          turno,
          sala,
          status_validacao,
          classe_id,
          curso_id,
          classes!left(id, nome),
          cursos!left(id, nome, tipo)
        )
      `,
      { count: "exact" }
    )
    .eq("escola_id", opts.escolaId);

  if (opts.sessionAno !== null) query = query.eq("ano_letivo", opts.sessionAno);
  if (opts.sessionId) query = query.eq("session_id", opts.sessionId);
  if (opts.turmaId) query = query.eq("turma_id", opts.turmaId);
  if (opts.classeId) query = query.eq("turmas.classe_id", opts.classeId);
  if (opts.cursoId) query = query.eq("turmas.curso_id", opts.cursoId);
  if (opts.classeIdsForNivel.length > 0) query = query.in("turmas.classe_id", opts.classeIdsForNivel);
  if (opts.sinceDate) query = query.gte("created_at", opts.sinceDate);

  if (opts.statusIn.length > 0) {
    query = query.in('status', opts.statusIn.map((s) => s.toLowerCase()));
  } else if (opts.status) {
    query = query.eq('status', opts.status.toLowerCase());
  }

  if (opts.q) {
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
      opts.q
    );
    const filters = [
      `numero_matricula.ilike.%${opts.q}%`,
      `alunos.numero_processo.ilike.%${opts.q}%`,
      `alunos.nome.ilike.%${opts.q}%`,
      `turmas.nome.ilike.%${opts.q}%`,
      `alunos.bi_numero.ilike.%${opts.q}%`,
    ];
    if (isUuid) filters.push(`id.eq.${opts.q}`);
    query = query.or(filters.join(","));
  }

  const { data, error, count } = await query
    .range(opts.start, opts.end)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const items = (data || [])
    .filter((row: any) => {
      const turma = Array.isArray((row as any)?.turmas) ? (row as any).turmas?.[0] : (row as any).turmas;
      return !turma?.status_validacao || turma.status_validacao === "ativo" || turma.status_validacao === "ativa";
    })
    .map((row: any) => {
      const status = isActiveStatus(row.status) ? "ativa" : row.status ?? "ativa";

      const aluno = Array.isArray(row.alunos) ? row.alunos?.[0] : row.alunos;
      const turma = Array.isArray(row.turmas) ? row.turmas?.[0] : row.turmas;
      const classe = turma && (Array.isArray((turma as any).classes) ? (turma as any).classes?.[0] : (turma as any).classes);

      return {
        id: row.id,
        numero_matricula: row.numero_matricula ?? null,
        numero_chamada: row.numero_chamada ?? null,
        aluno_id: row.aluno_id,
        turma_id: row.turma_id ?? turma?.id ?? null,
        aluno_nome: aluno?.nome ?? null,
        turma_nome: turma?.nome ?? null,
        sala: turma?.sala ?? null,
        turno: turma?.turno ?? null,
        classe_nome: classe?.nome ?? null,
        status,
        data_matricula: row.data_matricula ?? null,
        created_at: row.created_at,
      } as any;
    });

  const removed = (data?.length || 0) - items.length;
  const total = count !== null && count !== undefined ? Math.max(0, (count as number) - removed) : items.length;

  return { items, total };
}

// GET usa a view canônica de matrículas válidas
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const daysParam = searchParams.get("days");
  const days = daysParam === null || daysParam === "" ? 0 : Number(daysParam) || 0;
  const page = Number(searchParams.get("page")) || 1;
  const pageSize = Number(searchParams.get("pageSize")) || 20;
  const turmaId = (searchParams.get("turma_id") || "").trim();
  const status = (searchParams.get("status") || "").trim();
  const anoParamRaw = searchParams.get("ano") || searchParams.get("ano_letivo");
  const anoParam = anoParamRaw !== null ? Number(anoParamRaw) : null;
  const anoFromQuery = Number.isFinite(anoParam) ? (anoParam as number) : null;
  const classeId = (searchParams.get("classe_id") || "").trim();
  const cursoId = (searchParams.get("curso_id") || "").trim();
  const ensino = (searchParams.get("ensino") || "").trim();
  const statusIn = (searchParams.get("status_in") || "")
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const sinceDate = days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() : null;

  try {
    const supabase = await supabaseServerTyped<Database>();
    const headers = new Headers();
    const { data: userRes, error: authErr } = await supabase.auth.getUser();
    if (authErr) throw authErr;
    const user = userRes.user;

    const escolaId = user ? await resolveEscolaIdForUser(supabase as any, user.id) : null;

    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não encontrada para o usuário" }, { status: 400 });
    }

    const authz = await authorizeMatriculasManage(supabase as any, escolaId, user.id);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 });

    headers.set('Deprecation', 'true');
    headers.set('Link', `</api/escolas/${escolaId}/matriculas>; rel="successor-version"`);

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Configuração Supabase ausente." }, { status: 500 });
    }
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const sessionId = (searchParams.get("session_id") || "").trim();

    let sessionAno: number | null = anoFromQuery;
    let classeIdsForNivel: string[] = [];

    // Se não vier ano na query, tentar descobrir ano letivo ativo da escola
    if (sessionAno === null && !sessionId) {
      try {
        const { data: anoAtivo } = await admin
          .from('anos_letivos')
          .select('ano')
          .eq('escola_id', escolaId)
          .eq('ativo', true)
          .order('ano', { ascending: false })
          .limit(1);
        const anoResolved = anoAtivo?.[0]?.ano;
        if (anoResolved !== undefined && anoResolved !== null) {
          const anoNumber = typeof anoResolved === 'string' ? Number(anoResolved) : anoResolved;
          if (Number.isFinite(anoNumber)) sessionAno = anoNumber as number;
        }
      } catch (err) {
        console.warn('Falha ao resolver ano letivo ativo:', err);
      }
    }

    const { data: anoLetivoRow, error: anoLetivoErr } = sessionId
      ? await admin
          .from('anos_letivos')
          .select('id, ano, data_inicio, data_fim, ativo, escola_id')
          .eq('id', sessionId)
          .eq('escola_id', escolaId)
          .maybeSingle()
      : { data: null, error: null } as any;

    if (anoLetivoErr) {
      console.warn('Erro ao buscar ano letivo:', anoLetivoErr);
    }

    if (anoLetivoRow) {
      const anoResolved = inferAnoLetivo((anoLetivoRow as any)?.ano, anoLetivoRow.data_inicio, anoLetivoRow.data_fim);
      if (sessionAno === null && anoResolved !== null) sessionAno = anoResolved;
    }

    if (sessionAno === null && !anoFromQuery) {
      return NextResponse.json({ ok: false, error: "Ano letivo não encontrado para a escola" }, { status: 400 });
    }

    if (ensino) {
      try {
        const { data: classesData, error: classesErr } = await admin
          .from('classes')
          .select('id')
          .eq('escola_id', escolaId)
          .eq('nivel', ensino);

        if (classesErr) {
          console.warn('Erro ao filtrar classes por ensino:', classesErr);
        } else {
          classeIdsForNivel = (classesData || []).map((c: any) => c.id).filter(Boolean);
        }
      } catch (err) {
        console.warn('Falha ao resolver classes por ensino:', err);
      }
    }

    if (ensino && classeIdsForNivel.length === 0) {
      return NextResponse.json({ ok: true, items: [], total: 0 }, { headers });
    }

    // filtros por turma agora resolvidos diretamente na view canônica

    let query = admin
      .from('vw_matriculas_validas')
      .select(
        `
        id,
        escola_id,
        aluno_id,
        aluno_nome,
        bi_numero,
        numero_processo,
        numero_matricula,
        numero_chamada,
        ano_letivo,
        ano_letivo_id,
        session_id,
        data_matricula,
        status,
        turma_id,
        turma_nome,
        sala,
        turno,
        classe_id,
        classe_nome,
        curso_id,
        curso_nome,
        curso_tipo,
        created_at
      `,
        { count: 'exact' }
      )
      .eq('escola_id', escolaId);

    if (sessionAno !== null) query = query.eq('ano_letivo', sessionAno);
    if (sessionId) query = query.eq('session_id', sessionId);
    if (classeId) query = query.eq('classe_id', classeId);
    if (cursoId) query = query.eq('curso_id', cursoId);
    if (classeIdsForNivel.length > 0) query = query.in('classe_id', classeIdsForNivel);

    if (sinceDate) {
      query = query.gte('created_at', sinceDate);
    }

    if (turmaId === "null") {
      return NextResponse.json({ ok: true, items: [], total: 0 }, { headers });
    } else if (turmaId) query = query.eq("turma_id", turmaId);

    if (q) {
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(q);
      const conditions: string[] = [
        `numero_matricula.ilike.%${q}%`,
        `aluno_nome.ilike.%${q}%`,
        `turma_nome.ilike.%${q}%`,
        `bi_numero.ilike.%${q}%`,
        `numero_processo.ilike.%${q}%`,
      ];
      if (isUuid) conditions.push(`matricula_id.eq.${q}`);
      query = query.or(conditions.join(','));
    }

    const normalizedStatusIn = statusIn.map((s) => s.toLowerCase());
    const normalizedStatus = status ? status.toLowerCase() : "";

    const statusFiltersForQuery = normalizedStatusIn.length > 0 ? normalizedStatusIn : normalizedStatus ? [normalizedStatus] : [];
    const wantsAllStatuses = statusFiltersForQuery.length === 0;
    const wantsNonActiveStatuses = statusFiltersForQuery.some((s) => !isActiveStatus(s));

    if (!wantsAllStatuses) {
      if (normalizedStatusIn.length > 0) {
        query = query.in('status', normalizedStatusIn);
      } else if (normalizedStatus) {
        query = query.eq('status', normalizedStatus);
      }
    }

    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;

    if (wantsNonActiveStatuses) {
      try {
        const { items, total } = await fetchMatriculasFallback(admin, {
          escolaId,
          sessionAno,
          sessionId,
          classeId,
          cursoId,
          classeIdsForNivel,
          turmaId,
          status: normalizedStatus,
          statusIn: statusFiltersForQuery,
          q,
          sinceDate,
          start,
          end,
        });

        return NextResponse.json({ ok: true, items, total }, { headers });
      } catch (fallbackError) {
        console.error("Fallback matriculas query failed:", fallbackError);
      }
    }

    query = query.range(start, end).order("created_at", { ascending: false });

    const { data, error, count } = await query;
    if (error) {
      if (isMatriculasViewMissing(error)) {
        console.warn("vw_matriculas_validas ausente; usando fallback na tabela matriculas.");
        try {
          const { items, total } = await fetchMatriculasFallback(admin, {
            escolaId,
            sessionAno,
            sessionId,
            classeId,
            cursoId,
            classeIdsForNivel,
            turmaId,
            status: normalizedStatus,
            statusIn: statusFiltersForQuery,
            q,
            sinceDate,
            start,
            end,
          });

          return NextResponse.json({ ok: true, items, total }, { headers });
        } catch (fallbackError) {
          console.error("Fallback matriculas query failed:", fallbackError);
        }
      }

      console.error("Error fetching matriculas:", error);
      return NextResponse.json({ ok: false, error: "Erro ao buscar matrículas." }, { status: 500 });
    }

    const items = (data || []).map((row: any) => {
      const status = isActiveStatus(row.status) ? "ativa" : row.status ?? "ativa";
      return {
        id: row.id,
        numero_matricula: row.numero_matricula ?? null,
        numero_chamada: row.numero_chamada ?? null,
        aluno_id: row.aluno_id,
        turma_id: row.turma_id,
        aluno_nome: row.aluno_nome ?? null,
        turma_nome: row.turma_nome ?? null,
        sala: row.sala ?? null,
        turno: row.turno ?? null,
        classe_nome: row.classe_nome ?? null,
        status,
        data_matricula: row.data_matricula ?? null,
        created_at: row.created_at,
      } as any;
    });

    return NextResponse.json({ ok: true, items, total: count ?? 0 }, { headers });
  } catch (error: any) {
    console.error("An unexpected error occurred:", error);
    return NextResponse.json({ ok: false, error: "Ocorreu um erro inesperado." }, { status: 500 });
  }
}

// ============================================================================
// HELPER: Lançamento Financeiro (Taxa de Matrícula)
// ============================================================================
type PagamentoMatriculaPayload = {
  pagar_agora?: boolean;
  metodo_pagamento?: string | null;
  valor_pago?: number | null;
  comprovativo_url?: string | null;
};

async function registrarLancamentoMatricula(
  client: any,
  opts: {
    escolaId: string;
    alunoId: string;
    matriculaId: string;
    valorMatricula?: number | null;
    pagamento?: PagamentoMatriculaPayload;
    createdBy?: string | null;
  }
) {
  const valor = Number(opts.valorMatricula || 0);
  if (!Number.isFinite(valor) || valor <= 0) return;

  const pagarAgora = Boolean(opts.pagamento?.pagar_agora);
  const metodo = (opts.pagamento?.metodo_pagamento || "")?.trim() || null;
  const comprovativoUrl = opts.pagamento?.comprovativo_url || null;
  const valorPago = Number(typeof opts.pagamento?.valor_pago === "number" ? opts.pagamento?.valor_pago : valor);

  const lancInsert = await client
    .from("financeiro_lancamentos")
    .insert({
      escola_id: opts.escolaId,
      aluno_id: opts.alunoId,
      matricula_id: opts.matriculaId,
      tipo: "debito",
      origem: "matricula",
      descricao: "Matrícula",
      valor_original: valor,
      status: pagarAgora ? "pago" : "pendente",
      data_pagamento: pagarAgora ? new Date().toISOString() : null,
      metodo_pagamento: pagarAgora ? (metodo as any) : null,
      comprovativo_url: pagarAgora ? comprovativoUrl : null,
      created_by: opts.createdBy || null,
    })
    .select("id")
    .single();

  if (lancInsert.error || !lancInsert.data) {
    throw new Error(lancInsert.error?.message || "Falha ao registrar lançamento da matrícula");
  }

  if (pagarAgora && Number.isFinite(valorPago) && valorPago > 0) {
    const pagamentoInsert = await client
      .from("pagamentos")
      .insert({
        escola_id: opts.escolaId,
        aluno_id: opts.alunoId,
        valor: valorPago as any,
        status: "pago",
        metodo: metodo,
        referencia: `matricula:${opts.matriculaId}`,
        descricao: "Pagamento de matrícula",
        comprovante_url: comprovativoUrl,
      })
      .select("id")
      .single();

    if (pagamentoInsert.error || !pagamentoInsert.data) {
      await client.from("financeiro_lancamentos").delete().eq("id", (lancInsert.data as any).id).eq("escola_id", opts.escolaId);
      throw new Error(pagamentoInsert.error?.message || "Falha ao registrar pagamento da matrícula");
    }
    try {
      await client.rpc("refresh_all_materialized_views");
    } catch (e) {
      console.warn("Falha ao refrescar materialized views", e);
    }
  }
}

async function resyncMatriculaCounter(adminClient: SupabaseClient<Database>, escolaId: string) {
  const { data, error } = await (adminClient as any).rpc('resync_matricula_counter', {
    p_escola_id: escolaId,
  });

  if (error) throw new Error(error.message);

  const parsed = Number(data ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isNumeroDuplicadoError(err: any) {
  const message = (err?.message || '').toLowerCase();
  const details = (err?.details || '').toLowerCase();
  const hint = (err?.hint || '').toLowerCase();
  const code = err?.code || '';
  return (
    code === '23505' ||
    message.includes('uq_matriculas_escola_numero') ||
    details.includes('uq_matriculas_escola_numero') ||
    hint.includes('uq_matriculas_escola_numero') ||
    message.includes('duplicate key value')
  );
}

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // 1. Parse Data
    const body = await req.json();
    const {
      aluno_id, // <--- CRITICAL: Check if this exists
      turma_id,
      primeiro_nome,
      sobrenome,
      data_nascimento,
      bi_numero,
      nif,
      encarregado_nome,
      encarregado_telefone,
      encarregado_email,
      parentesco,
      // Financeiro
      pagar_matricula_agora,
      metodo_pagamento,
      valor_matricula_pago,
      comprovativo_url,
      session_id,
    } = body;

    // Admin Client for privileged actions
    const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const adminClient = createAdminClient<Database>(adminUrl, serviceRole);

    // 2. Validate Turma (Required for everyone)
    if (!turma_id) {
      return NextResponse.json({ ok: false, error: "A turma é obrigatória." }, { status: 400 });
    }

    // Fetch Turma details
    const { data: turma, error: turmaErr } = await adminClient
      .from('turmas')
      .select('*')
      .eq('id', turma_id)
      .single();

    if (turmaErr || !turma) {
      return NextResponse.json({ ok: false, error: "Turma inválida." }, { status: 400 });
    }

    const escolaId = turma.escola_id;
    let anoLetivo = inferAnoLetivo(body?.ano_letivo, (turma as any)?.ano_letivo, body?.ano);
    const turmaSessionId = (turma as any)?.session_id || null;
    const finalSessionId = session_id || turmaSessionId;

    let sessionIdForInsert: string | null = null;

    const { data: anoLetivoRow, error: anoLetivoErr } = finalSessionId
      ? await adminClient
          .from('anos_letivos')
          .select('id, ano, data_inicio, data_fim, ativo, escola_id')
          .eq('id', finalSessionId)
          .eq('escola_id', escolaId)
          .maybeSingle()
      : { data: null, error: null } as any;

    if (anoLetivoErr) {
      console.warn('Erro ao validar ano letivo:', anoLetivoErr);
    }

    if (anoLetivoRow) {
      const anoFromSession = inferAnoLetivo((anoLetivoRow as any)?.ano, anoLetivoRow.data_inicio, anoLetivoRow.data_fim);
      if (anoLetivo === null && anoFromSession !== null) anoLetivo = anoFromSession;
    } else {
      // Valida se a sessão pertence à mesma escola (legado)
      if (finalSessionId && !legacySchoolSessionsMissing) {
        const { data: sessionRow, error: sessionErr } = await adminClient
          .from('school_sessions')
          .select('id, nome, data_inicio, data_fim')
          .eq('id', finalSessionId)
          .eq('escola_id', escolaId)
          .maybeSingle();

        if (sessionErr) {
          if (!markLegacySchoolSessionsMissing(sessionErr)) console.error('Erro ao validar sessão legacy:', sessionErr);
        }

        if (sessionRow) {
          sessionIdForInsert = sessionRow.id;
          const anoFromSession = inferAnoLetivo(sessionRow.nome, sessionRow.data_inicio, sessionRow.data_fim);
          if (anoLetivo === null && anoFromSession !== null) anoLetivo = anoFromSession;
        }
      }
    }

    if (anoLetivo === null) {
      anoLetivo = new Date().getFullYear();
    }

    // ---------------------------------------------------------
    // 3. LOGIC BRANCH: Existing vs New Student
    // ---------------------------------------------------------
    let finalAlunoId = aluno_id;

    if (!finalAlunoId) {
      // === PATH A: CREATE NEW STUDENT ===
      // Validate required fields for NEW students
      const nomeCompleto = `${primeiro_nome || ''} ${sobrenome || ''}`.trim();
      
      if (!nomeCompleto) {
        return NextResponse.json({ ok: false, error: "Nome do aluno é obrigatório para novos registros." }, { status: 400 });
      }
      if (!encarregado_telefone) {
        return NextResponse.json({ ok: false, error: "Telefone do encarregado é obrigatório." }, { status: 400 });
      }

      // Insert into ALUNOS (Relies on DB triggers for numero_processo)
      const { data: newAluno, error: createErr } = await adminClient
        .from('alunos')
        .insert({
          escola_id: escolaId,
          nome: nomeCompleto,
          data_nascimento: data_nascimento || null,
          bi_numero: bi_numero || null,
          nif: nif || bi_numero || null,
          encarregado_nome: encarregado_nome || null,
          encarregado_telefone: encarregado_telefone,
          encarregado_email: encarregado_email || null,
          // Note: status/active is handled by database defaults or null
        })
        .select('id')
        .single();

      if (createErr || !newAluno) {
        console.error("Error creating student:", createErr);
        return NextResponse.json({ ok: false, error: `Erro ao criar aluno: ${createErr?.message}` }, { status: 400 });
      }

      finalAlunoId = newAluno.id;
    } 
    
    // ---------------------------------------------------------
    // 4. CREATE MATRICULA (Common Path)
    // ---------------------------------------------------------
    
    // Check for existing matricula
    const { data: existingMatricula } = await adminClient
        .from('matriculas')
        .select('id')
        .eq('escola_id', escolaId)
        .eq('aluno_id', finalAlunoId)
        .eq('ano_letivo', anoLetivo)
        .maybeSingle();

    if (existingMatricula) {
        return NextResponse.json({ ok: false, error: "Aluno já matriculado neste ano letivo." }, { status: 400 });
    }

    // Insert Matricula
    const { data: matricula, error: matErr } = await adminClient
      .from('matriculas')
      .insert({
        escola_id: escolaId,
        aluno_id: finalAlunoId,
        turma_id: turma_id,
        ano_letivo: anoLetivo,
        session_id: sessionIdForInsert,
        status: 'pendente',
        ativo: true,
        data_matricula: new Date().toISOString()
      })
      .select()
      .single();

    if (matErr) {
      // Rollback: Only delete aluno if WE created it in this request
      if (!aluno_id && finalAlunoId) {
         await adminClient.from('alunos').delete().eq('id', finalAlunoId);
      }
      return NextResponse.json({ ok: false, error: matErr.message }, { status: 400 });
    }

    const { error: confirmErr } = await (adminClient as any).rpc('confirmar_matricula', {
      p_matricula_id: matricula.id,
    });

    if (confirmErr) {
      console.error('Erro ao confirmar matrícula via RPC:', confirmErr);
      return NextResponse.json({ ok: false, error: confirmErr.message }, { status: 400 });
    }

    const { data: matriculaAtualizada, error: fetchErr } = await adminClient
      .from('matriculas')
      .select('id, numero_matricula, status')
      .eq('id', matricula.id)
      .maybeSingle();

    if (fetchErr || !matriculaAtualizada?.numero_matricula) {
      return NextResponse.json({ ok: false, error: fetchErr?.message || 'Número de matrícula não gerado' }, { status: 400 });
    }

    const numeroMatriculaFinal = matriculaAtualizada.numero_matricula;
    (matricula as any).numero_matricula = numeroMatriculaFinal;
    (matricula as any).status = matriculaAtualizada.status ?? matricula.status;

    // ---------------------------------------------------------
    // 5. FINANCIALS (Tabela de Preço Logic)
    // ---------------------------------------------------------
    
    const { data: turmaView } = await supabase.from('vw_turmas_para_matricula').select('curso_id, classe_id').eq('id', turma_id).maybeSingle();
    const pricingParams = { escolaId, anoLetivo: anoLetivo, cursoId: turmaView?.curso_id, classeId: turmaView?.classe_id, allowMensalidadeFallback: true };
    let { tabela: tabelaPreco } = await resolveTabelaPreco(adminClient as any, pricingParams);
    if(tabelaPreco) {
        const valorMatriculaTabela = Number(tabelaPreco.valor_matricula) || 0;
        const pagamentoMatricula: PagamentoMatriculaPayload = {
            pagar_agora: Boolean(pagar_matricula_agora),
            metodo_pagamento: metodo_pagamento?.trim() || null,
            valor_pago: Number(valor_matricula_pago),
            comprovativo_url: comprovativo_url || null,
        };

        try {
            await registrarLancamentoMatricula(adminClient, {
                escolaId,
                alunoId: finalAlunoId,
                matriculaId: matricula.id,
                valorMatricula: valorMatriculaTabela > 0 ? valorMatriculaTabela : null,
                pagamento: pagamentoMatricula,
                createdBy: user.id,
            });
        } catch (finErr: any) {
            console.error("Erro no financeiro (taxa de matrícula):", finErr);
        }
    }


    return NextResponse.json({ 
        ok: true, 
        data: { 
            matricula_id: matricula.id,
            aluno_id: finalAlunoId,
            numero_matricula: numeroMatriculaFinal,
            session_id: matricula.session_id,
        } 
    });

  } catch (error: any) {
    console.error("Fatal error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
