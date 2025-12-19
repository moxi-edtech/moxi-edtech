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

    let query = admin
      .from("matriculas")
      .select(
        `id, numero_matricula, numero_chamada, aluno_id, turma_id, status, data_matricula, created_at,
         alunos ( nome_completo, numero_processo ),
         turmas ( nome, sala, turno, classes ( nome ) )`,
        { count: "exact" }
      )
      .eq("escola_id", escolaId)
      .eq("session_id", sessionId);

    if (turmaId) query = query.eq("turma_id", turmaId);
    if (statusIn.length > 0) {
      query = query.in('status', statusIn);
    } else if (status) {
      query = query.eq('status', status);
    }

    if (q) {
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(q);
      const [alunosRes, turmasRes] = await Promise.all([
        admin.from('alunos').select('id').eq('escola_id', escolaId).ilike('nome_completo', `%${q}%`),
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
        aluno_nome: row.alunos?.nome_completo ?? null,
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

// ============================================================================
// POST: Criar Matrícula (Agora simplificado com RPC)
// ============================================================================
export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const {
      // Aluno
      primeiro_nome,
      sobrenome,
      data_nascimento,
      genero,
      bi,
      nif,
      numero_processo,
      email,
      telefone,
      endereco,
      // Encarregado
      encarregado_nome,
      encarregado_telefone,
      encarregado_email,
      parentesco,
      // Matrícula
      turma_id,
      ano_letivo,
      numero_chamada,
      data_matricula,
      // Financeiro
      pagar_matricula_agora,
      metodo_pagamento,
      valor_matricula_pago,
      comprovativo_url,
    } = body;

    const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const adminClient = createAdminClient<Database>(adminUrl, serviceRole);
    
    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 400 });
    }

    // 1. Inserir o Aluno
    const nome_completo = `${primeiro_nome} ${sobrenome}`.trim();
    const { data: alunoData, error: alunoError } = await adminClient
      .from('alunos')
      .insert({
        escola_id: escolaId,
        nome_completo,
        data_nascimento,
        genero,
        bi_numero: bi,
        nif: nif,
        numero_processo: numero_processo || null,
        email,
        telefone,
        endereco,
        encarregado_nome,
        encarregado_telefone,
        encarregado_email,
        encarregado_parentesco: parentesco,
        // Status inicial 'pending', ativado pela matrícula
        status: 'pending',
      })
      .select('id')
      .single();

    if (alunoError) {
      console.error("Erro ao criar aluno:", alunoError);
      return NextResponse.json({ ok: false, error: "Falha ao criar o aluno. Verifique os dados." }, { status: 400 });
    }
    const alunoId = alunoData.id;

    // 2. Criar a Matrícula
    const { data: matriculaData, error: matriculaError } = await adminClient
      .rpc('create_or_confirm_matricula', {
        p_aluno_id: alunoId,
        p_turma_id: turma_id,
        p_ano_letivo: ano_letivo,
      });

    if (matriculaError) {
      // Rollback manual do aluno se a matrícula falhar
      await adminClient.from('alunos').delete().eq('id', alunoId);
      console.error("Erro ao criar matrícula via RPC:", matriculaError);
      return NextResponse.json({ ok: false, error: "Falha ao criar a matrícula." }, { status: 400 });
    }

    const { data: matriculaRecemCriada } = await adminClient
        .from('matriculas')
        .select('id, numero_matricula')
        .eq('aluno_id', alunoId)
        .eq('ano_letivo', ano_letivo)
        .single();
    
    if (!matriculaRecemCriada) {
        return NextResponse.json({ ok: false, error: "Matrícula criada, mas não foi possível encontrá-la para gerar finanças." }, { status: 500 });
    }


    // 3. Lógica Financeira (se aplicável)
    // (A lógica de `registrarLancamentoMatricula` e geração de mensalidades pode ser chamada aqui,
    // usando os dados do body e o `matriculaRecemCriada.id`)
    
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
                alunoId: alunoId,
                matriculaId: matriculaRecemCriada.id,
                valorMatricula: valorMatriculaTabela > 0 ? valorMatriculaTabela : null,
                pagamento: pagamentoMatricula,
                createdBy: user.id,
            });
        } catch (finErr) {
            console.error("Erro no financeiro (taxa de matrícula):", finErr);
        }
    }


    return NextResponse.json({ 
        ok: true, 
        data: { 
            aluno_id: alunoId,
            matricula_id: matriculaRecemCriada.id, 
            numero_matricula: matriculaRecemCriada.numero_matricula,
        } 
    });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Erro inesperado no POST de matrículas:", message);
    return NextResponse.json({ ok: false, error: "Ocorreu um erro inesperado no servidor." }, { status: 500 });
  }
}
