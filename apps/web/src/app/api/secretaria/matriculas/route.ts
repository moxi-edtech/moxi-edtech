import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { normalizeAnoLetivo, resolveTabelaPreco } from "@/lib/financeiro/tabela-preco";
import { resolveEscolaIdForUser, authorizeMatriculasManage } from "@/lib/escola/disciplinas";

// Mantivemos o GET intacto pois ele é apenas leitura e listagem
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const daysParam = searchParams.get("days");
  const days = daysParam === null || daysParam === "" ? 0 : Number(daysParam) || 0;
  const page = Number(searchParams.get("page")) || 1;
  const pageSize = Number(searchParams.get("pageSize")) || 20;
  const turmaId = (searchParams.get("turma_id") || "").trim();
  const status = (searchParams.get("status") || "").trim();
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

    if (!sessionId) {
      return NextResponse.json({ ok: false, error: "Ano letivo (session_id) é obrigatório" }, { status: 400 });
    }

    const { data: sessionRow, error: sessionErr } = await admin
      .from('school_sessions')
      .select('id, nome, data_inicio, data_fim')
      .eq('id', sessionId)
      .eq('escola_id', escolaId)
      .maybeSingle();

    if (sessionErr || !sessionRow) {
      return NextResponse.json({ ok: false, error: "Sessão inválida para a escola" }, { status: 400 });
    }

    const sessionAno = (() => {
      const name = String((sessionRow as any)?.nome ?? '').trim();
      const match = name.match(/(19|20)\d{2}/);
      if (match?.[0]) return Number(match[0]);
      const inicio = sessionRow?.data_inicio ? new Date(sessionRow.data_inicio) : null;
      if (inicio && !isNaN(inicio.getTime())) return inicio.getFullYear();
      const fim = sessionRow?.data_fim ? new Date(sessionRow.data_fim) : null;
      if (fim && !isNaN(fim.getTime())) return fim.getFullYear();
      return null;
    })();

    let query = admin
      .from("matriculas")
      .select(
        `id, numero_matricula, numero_chamada, aluno_id, turma_id, status, data_matricula, created_at,
         alunos ( nome, numero_processo ),
         turmas ( nome, sala, turno, classes ( nome ) )`,
        { count: "exact" }
      )
      .eq("escola_id", escolaId);

    if (sessionAno !== null) {
      query = query.or(`session_id.eq.${sessionId},and(session_id.is.null,ano_letivo.eq.${sessionAno})`);
    } else {
      query = query.eq("session_id", sessionId);
    }

    if (sinceDate) {
      query = query.gte('created_at', sinceDate);
    }

    if (turmaId) query = query.eq("turma_id", turmaId);
    if (statusIn.length > 0) {
      query = query.in('status', statusIn);
    } else if (status) {
      query = query.eq('status', status);
    }

    if (q) {
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(q);
      const [alunosRes, turmasRes] = await Promise.all([
        admin.from('alunos').select('id').eq('escola_id', escolaId).ilike('nome', `%${q}%`),
        admin.from('turmas').select('id').eq('escola_id', escolaId).or(`nome.ilike.%${q}%,turma_codigo.ilike.%${q}%`),
      ]);

      const alunoIds: string[] = (alunosRes.data || []).map((a: any) => a.id).filter(Boolean);
      const turmaIds: string[] = (turmasRes.data || []).map((t: any) => t.id).filter(Boolean);

      const conditions: string[] = [`numero_matricula.ilike.%${q}%`, `status.ilike.%${q}%`];
      if (isUuid) conditions.push(`id.eq.${q}`);
      if (alunoIds.length) conditions.push(`aluno_id.in.(${alunoIds.join(',')})`);
      if (turmaIds.length) conditions.push(`turma_id.in.(${turmaIds.join(',')})`);
      query = query.or(conditions.join(','));
    }

    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;
    query = query.range(start, end).order("created_at", { ascending: false });

    const { data, error, count } = await query;
    if (error) {
      console.error("Error fetching matriculas:", error);
      return NextResponse.json({ ok: false, error: "Erro ao buscar matrículas." }, { status: 500 });
    }

    const items = (data || []).map((row: any) => {
      return {
        id: row.id,
        numero_matricula: row.numero_matricula ?? null,
        numero_chamada: row.numero_chamada ?? null,
        aluno_id: row.aluno_id,
        turma_id: row.turma_id,
        aluno_nome: row.alunos?.nome ?? null,
        turma_nome: row.turmas?.nome ?? null,
        sala: row.turmas?.sala ?? null,
        turno: row.turmas?.turno ?? null,
        classe_nome: row.turmas?.classes?.nome ?? null,
        status: row.status,
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
    const ano_letivo = turma.ano_letivo;
    const turmaSessionId = (turma as any)?.session_id || null;
    const finalSessionId = session_id || turmaSessionId;

    if (!finalSessionId) {
      return NextResponse.json({ ok: false, error: "Sessão (session_id) é obrigatória." }, { status: 400 });
    }

    // Valida se a sessão pertence à mesma escola
    const { data: sessionRow, error: sessionErr } = await adminClient
      .from('school_sessions')
      .select('id')
      .eq('id', finalSessionId)
      .eq('escola_id', escolaId)
      .maybeSingle();

    if (sessionErr || !sessionRow) {
      return NextResponse.json({ ok: false, error: "Sessão inválida para a escola" }, { status: 400 });
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
          nome_completo: nomeCompleto, // Aligned with Master Script
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
        .eq('ano_letivo', ano_letivo)
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
        ano_letivo: ano_letivo,
        session_id: finalSessionId,
        status: 'ativo',
        ativo: true,
        // numero_matricula is handled by DB triggers or logic below
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

    const { data: numeroMatriculaGerado, error: numeroErr } = await adminClient.rpc('generate_matricula_number', {
      p_matricula_id: matricula.id
    });

    if (numeroErr) {
      console.error("Erro ao gerar número da matrícula:", numeroErr);
      // Mesmo com erro na geração do número, a matrícula foi criada.
      // Retorne sucesso, mas sem o número, para que o sistema não trave.
    }

    const numeroMatriculaFinal = numeroMatriculaGerado ?? null;
    (matricula as any).numero_matricula = numeroMatriculaFinal;

    // ---------------------------------------------------------
    // 5. FINANCIALS (Tabela de Preço Logic)
    // ---------------------------------------------------------
    
    const { data: turmaView } = await supabase.from('vw_turmas_para_matricula').select('curso_id, classe_id').eq('id', turma_id).maybeSingle();
    const pricingParams = { escolaId, anoLetivo: ano_letivo, cursoId: turmaView?.curso_id, classeId: turmaView?.classe_id, allowMensalidadeFallback: true };
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
