// apps/web/src/app/api/secretaria/admissoes/convert/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { requireRoleInSchool } from '@/lib/authz';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import { recordAuditServer } from '@/lib/audit';
import { emitirComprovanteMatricula } from '@/lib/documentos/emitirComprovanteMatricula';
import { K12_FINANCEIRO_OPERACIONAL_ROLE_GROUP } from '@/lib/roles';
import type { Json } from '~types/supabase';
// import { enqueueOutboxEvent } from '@/lib/outbox';

const convertPayloadSchema = z.object({
  candidatura_id: z.string().uuid(),
  turma_id: z.string().uuid(),
  metodo_pagamento: z.enum(['TPA', 'CASH', 'TRANSFERENCIA']),
  comprovativo_url: z.string().trim().min(1).optional(),
  comprovativo_path: z.string().trim().min(1).optional(),
  amount: z.number().positive().optional(),
  parcial: z.boolean().optional(),
  referencia: z.string().trim().optional(),
  servicos_ids: z.array(z.string().uuid()).max(20).optional().default([]),
  mensalidades_competencias: z.array(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)).max(12).optional().default([]),
  override_capacidade: z.boolean().optional().default(false),
  override_motivo: z.string().trim().optional(),
})

type JsonObject = { [key: string]: Json | undefined };

function isJsonObject(value: Json | null): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function extractMatriculaIdFromConflict(text: string): string | null {
  const keyMatch = text.match(/matricula_id\)=\(\s*([0-9a-f-]{36})\s*\)/i);
  if (keyMatch?.[1]) return keyMatch[1];

  const messageMatch = text.match(/Matr[ií]cula\s+([0-9a-f-]{36})/i);
  if (messageMatch?.[1]) return messageMatch[1];

  const fallbackMatch = text.match(UUID_RE);
  return fallbackMatch?.[0] ?? null;
}

function isOfficialMatriculaStatus(status: unknown): boolean {
  return ["ativo", "ativa", "active"].includes(String(status ?? "").toLowerCase());
}

async function getFinalizedAdmissionResult(
  supabase: Awaited<ReturnType<typeof createClient>>,
  candidaturaId: string,
  escolaId: string | null
) {
  if (!escolaId) return null;

  const { data: candAfter } = await supabase
    .from("candidaturas")
    .select("status, matricula_id, aluno_id")
    .eq("id", candidaturaId)
    .eq("escola_id", escolaId)
    .maybeSingle();
  const statusAfter = String(candAfter?.status ?? "").toLowerCase();
  if (statusAfter !== "matriculado" || !candAfter?.matricula_id) return null;

  const { data: matricula } = await supabase
    .from("matriculas")
    .select("numero_matricula")
    .eq("id", candAfter.matricula_id)
    .eq("escola_id", escolaId)
    .maybeSingle();

  return {
    ok: true,
    idempotent: true,
    message: "Matrícula já havia sido finalizada.",
    matricula_id: candAfter.matricula_id,
    aluno_id: candAfter.aluno_id,
    numero_matricula: (matricula?.numero_matricula as string | null) ?? null,
  };
}

async function getExistingMatriculaConflict(
  supabase: Awaited<ReturnType<typeof createClient>>,
  escolaId: string | null,
  conflictText: string
) {
  const matriculaId = extractMatriculaIdFromConflict(conflictText);
  if (!matriculaId || !escolaId) return null;

  const { data: matricula } = await supabase
    .from("matriculas")
    .select("id, aluno_id, turma_id, numero_matricula, ano_letivo, status")
    .eq("escola_id", escolaId)
    .eq("id", matriculaId)
    .maybeSingle();

  if (!matricula) return null;

  const { data: aluno } = await supabase
    .from("alunos")
    .select("id, nome, nome_completo, bi_numero, numero_documento, telefone")
    .eq("escola_id", escolaId)
    .eq("id", matricula.aluno_id)
    .maybeSingle();

  const { data: turma } = matricula.turma_id
    ? await supabase
        .from("turmas")
        .select("id, nome, turma_codigo, turno")
        .eq("escola_id", escolaId)
        .eq("id", matricula.turma_id)
        .maybeSingle()
    : { data: null };

  const { data: candidatura } = await supabase
    .from("candidaturas")
    .select("id, status, nome_candidato")
    .eq("escola_id", escolaId)
    .eq("matricula_id", matriculaId)
    .maybeSingle();

  return {
    matricula_id: matricula.id,
    aluno_id: matricula.aluno_id,
    numero_matricula: matricula.numero_matricula,
    ano_letivo: matricula.ano_letivo,
    status: matricula.status,
    aluno_nome: aluno?.nome_completo ?? aluno?.nome ?? null,
    aluno_documento: aluno?.numero_documento ?? aluno?.bi_numero ?? null,
    aluno_telefone: aluno?.telefone ?? null,
    turma_id: turma?.id ?? matricula.turma_id ?? null,
    turma_nome: turma?.nome ?? turma?.turma_codigo ?? null,
    turma_turno: turma?.turno ?? null,
    candidatura_id: candidatura?.id ?? null,
    candidatura_status: candidatura?.status ?? null,
    nome_candidato: candidatura?.nome_candidato ?? null,
  };
}

async function getCurrentAdmissionSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  candidaturaId: string,
  escolaId: string | null
) {
  if (!escolaId) return null;

  const { data: candidatura } = await supabase
    .from("candidaturas")
    .select("id, status, nome_candidato, dados_candidato")
    .eq("id", candidaturaId)
    .eq("escola_id", escolaId)
    .maybeSingle();

  if (!candidatura) return null;

  const dados =
    candidatura.dados_candidato &&
    typeof candidatura.dados_candidato === "object" &&
    !Array.isArray(candidatura.dados_candidato)
      ? (candidatura.dados_candidato as Record<string, unknown>)
      : {};
  const pickString = (key: string) => {
    const value = dados[key];
    return typeof value === "string" && value.trim() ? value : null;
  };

  return {
    id: candidatura.id,
    status: candidatura.status ?? null,
    nome_candidato: candidatura.nome_candidato ?? null,
    documento: pickString("numero_documento") ?? pickString("bi_numero"),
    telefone: pickString("telefone") ?? pickString("responsavel_contato"),
  };
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const idempotencyKey = request.headers.get('idempotency-key');
  let escolaIdContext: string | null = null;
  if (!idempotencyKey) {
    return NextResponse.json({ error: 'Idempotency-Key header is required' }, { status: 400 });
  }

  const body = await request.json()
  const validation = convertPayloadSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json({ error: validation.error.format() }, { status: 400 })
  }
  
  const {
    candidatura_id,
    turma_id,
    metodo_pagamento,
    comprovativo_url,
    comprovativo_path,
    amount,
    parcial,
    referencia,
    override_capacidade,
    override_motivo,
    servicos_ids,
    mensalidades_competencias,
  } = validation.data
  const overrideMotivo = override_motivo?.trim() || null
  if (override_capacidade && (!overrideMotivo || overrideMotivo.length < 10)) {
    return NextResponse.json(
      { ok: false, error: "Motivo obrigatório para override de capacidade.", code: "CAPACITY_OVERRIDE_REASON_REQUIRED" },
      { status: 400 }
    )
  }
  const comprovativo = comprovativo_path ?? comprovativo_url

  try {
    const { data: candidatura, error: candError } = await supabase
        .from('candidaturas')
        .select('escola_id, status, matricula_id, aluno_id, dados_candidato')
        .eq('id', candidatura_id)
        .single();

    if (candError || !candidatura) {
        return NextResponse.json({ error: 'Candidatura not found' }, { status: 404 });
    }

    escolaIdContext = candidatura.escola_id as string;
    const statusAtual = String(candidatura.status ?? "").toLowerCase();
    if (statusAtual === "pre_candidatura") {
      return NextResponse.json(
        {
          ok: false,
          error: "Pré-candidatura ainda não pode ser convertida em matrícula. Primeiro transforme-a em candidatura formal para um ano letivo e turma.",
          code: "PRE_CANDIDATURA_NOT_CONVERTIBLE",
        },
        { status: 400 }
      );
    }

    if (statusAtual === "matriculado" && candidatura.matricula_id) {
      let numeroMatricula: string | null = null;
      const { data: matricula } = await supabase
        .from("matriculas")
        .select("numero_matricula")
        .eq("id", candidatura.matricula_id)
        .eq("escola_id", candidatura.escola_id)
        .maybeSingle();
      numeroMatricula = (matricula?.numero_matricula as string | null) ?? null;

      return NextResponse.json({
        ok: true,
        idempotent: true,
        message: "Matrícula já havia sido finalizada.",
        matricula_id: candidatura.matricula_id,
        aluno_id: candidatura.aluno_id,
        numero_matricula: numeroMatricula,
      });
    }

  // 2. Authorize
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const escolaId = await resolveEscolaIdForUser(supabase, user.id, candidatura.escola_id);
  if (!escolaId || escolaId !== candidatura.escola_id) {
    return NextResponse.json({ error: 'Sem vínculo com a escola' }, { status: 403 });
  }

    const { error: authError } = await requireRoleInSchool({
    supabase,
    escolaId: candidatura.escola_id,
    roles: [...K12_FINANCEIRO_OPERACIONAL_ROLE_GROUP, 'diretor'],
  });
    if (authError) return authError;

    // Idempotência canônica: se já temos resultado persistido para esta chave/scope, devolvemos.
    if (idempotencyKey) {
      const { data: existingIdempotency } = await supabase
        .from("idempotency_keys")
        .select("result")
        .eq("escola_id", escolaIdContext)
        .eq("scope", "admissao_finalizar_matricula")
        .eq("key", idempotencyKey)
        .maybeSingle();
      const idempotencyResult = existingIdempotency?.result ?? null;
      if (isJsonObject(idempotencyResult)) {
        return NextResponse.json(idempotencyResult);
      }
    }

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("current_escola_id, escola_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile?.current_escola_id || !profile?.escola_id) {
        await supabase
          .from("profiles")
          .update({
            current_escola_id: profile?.current_escola_id ?? candidatura.escola_id,
            escola_id: profile?.escola_id ?? candidatura.escola_id,
          })
          .eq("user_id", user.id);
      }
    } catch {}

    // Validar o catálogo antes de criar a matrícula: uma seleção inválida nunca
    // pode deixar uma matrícula criada sem o pagamento correspondente.
    const { data: servicosRows, error: servicosError } = servicos_ids.length
      ? await supabase
          .from("servicos_escola")
          .select("id, codigo, nome, descricao, valor_base, ativo")
          .eq("escola_id", candidatura.escola_id)
          .in("id", servicos_ids)
      : { data: [], error: null };
    if (servicosError) throw servicosError;
    if ((servicosRows ?? []).length !== servicos_ids.length || (servicosRows ?? []).some((service) => !service.ativo || Number(service.valor_base ?? 0) <= 0)) {
      return NextResponse.json({ ok: false, error: "Um dos serviços selecionados já não está disponível ou não tem preço configurado.", code: "SERVICE_NOT_AVAILABLE" }, { status: 409 });
    }
    const servicos = (servicosRows ?? []).map((service) => ({
      id: service.id,
      codigo: service.codigo,
      nome: service.nome,
      descricao: service.descricao,
      preco: Number(service.valor_base ?? 0),
      quantidade: 1,
      tipo: "servico",
    }));
    if (metodo_pagamento === "TPA" && !referencia) {
      return NextResponse.json({ ok: false, error: "Informe a referência do TPA antes de finalizar.", code: "PAYMENT_REFERENCE_REQUIRED" }, { status: 400 });
    }
    if (metodo_pagamento === "TRANSFERENCIA" && !comprovativo) {
      return NextResponse.json({ ok: false, error: "Anexe o comprovativo da transferência antes de finalizar.", code: "PAYMENT_EVIDENCE_REQUIRED" }, { status: 400 });
    }
    if ((servicos.length > 0 || mensalidades_competencias.length > 0) && parcial) {
      return NextResponse.json({
        ok: false,
        error: "Pagamento parcial não está disponível quando há serviços ou mensalidades selecionadas. Para incluir estes itens, liquide o checkout completo.",
        code: "EXTRAS_REQUIRE_FULL_PAYMENT",
      }, { status: 400 });
    }
    if (new Set(mensalidades_competencias).size !== mensalidades_competencias.length) {
      return NextResponse.json({ ok: false, error: "Existem mensalidades duplicadas na seleção.", code: "DUPLICATE_MONTHLY_SELECTION" }, { status: 400 });
    }

    // 3. Chamada canónica: valida turma/preço e faz rascunho -> submetida -> aprovada -> matriculado numa transação.
    const { data, error } = await supabase.rpc('admissao_finalizar_matricula', {
      p_escola_id: candidatura.escola_id,
      p_candidatura_id: candidatura_id,
      p_turma_id: turma_id,
      p_pagamento: {
        metodo_pagamento,
        comprovativo_url: comprovativo,
        comprovativo_path: comprovativo,
        amount,
        parcial,
        referencia,
      },
      p_idempotency_key: idempotencyKey,
      p_observacao: 'Finalização via Nova Admissão',
      p_override_capacidade: override_capacidade,
      p_override_motivo: overrideMotivo ?? undefined,
    })

    if (error) throw error

    const result = (data && typeof data === 'object' ? data : {}) as {
      matricula_id?: string | null
      numero_matricula?: string | null
      valor_matricula?: number | null
      valor_pago?: number | null
      status?: string | null
      override_capacidade?: boolean | null
      override_motivo?: string | null
      capacidade_maxima?: number | null
      matriculados_antes?: number | null
      aluno_id?: string | null
    }
    const matriculaId = typeof result.matricula_id === 'string' ? result.matricula_id : null
    const alunoId = typeof result.aluno_id === 'string' ? result.aluno_id : null

    const valorMatricula = Number(result.valor_matricula ?? 0);
    if (!alunoId || !matriculaId) throw new Error("Não foi possível associar o pagamento ao aluno matriculado.");

    // O desconto familiar precisa ser aplicado antes de resolver as propinas
    // selecionadas; assim o checkout usa exatamente o saldo real das mensalidades.
    let familia: { ok: boolean; agregado_id?: string; error?: string } | null = null;
    const candidaturaDados = candidatura.dados_candidato && typeof candidatura.dados_candidato === "object" && !Array.isArray(candidatura.dados_candidato)
      ? candidatura.dados_candidato as Record<string, unknown>
      : {};
    const agregadoFamiliarId = typeof candidaturaDados.agregado_familiar_id === "string" ? candidaturaDados.agregado_familiar_id : null;
    const { data: matriculaContext } = await supabase
      .from("matriculas")
      .select("aluno_id, session_id")
      .eq("escola_id", candidatura.escola_id)
      .eq("id", matriculaId)
      .maybeSingle();

    if (agregadoFamiliarId && matriculaContext?.aluno_id) {
      const { data: agregado } = await (supabase as any)
        .from("financeiro_agregados_familiares")
        .select("id")
        .eq("id", agregadoFamiliarId)
        .eq("escola_id", candidatura.escola_id)
        .maybeSingle();
      if (agregado) {
        const { error: familyError } = await (supabase as any)
          .from("financeiro_agregados_membros")
          .insert({ agregado_id: agregado.id, aluno_id: matriculaContext.aluno_id });
        if (familyError && familyError.code !== "23505") {
          familia = { ok: false, agregado_id: agregado.id, error: familyError.message };
        } else {
          if (matriculaContext.session_id) {
            const { error: familyDiscountError } = await (supabase as any).rpc("aplicar_desconto_familiar", {
              p_escola_id: candidatura.escola_id,
              p_ano_letivo_id: matriculaContext.session_id,
            });
            if (familyDiscountError) throw familyDiscountError;
          }
          familia = { ok: true, agregado_id: agregado.id };
        }
      }
    }

    const { data: mensalidadesGeradas, error: mensalidadesError } = mensalidades_competencias.length > 0
      ? await supabase
          .from("mensalidades")
          .select("id, ano_referencia, mes_referencia, valor_previsto, valor, valor_pago_total, status, data_vencimento")
          .eq("escola_id", candidatura.escola_id)
          .eq("aluno_id", alunoId)
          .eq("matricula_id", matriculaId)
          .order("ano_referencia", { ascending: true })
          .order("mes_referencia", { ascending: true })
      : { data: [], error: null };
    if (mensalidadesError) throw mensalidadesError;

    const mensalidadesAbertas = (mensalidadesGeradas ?? [])
      .map((row: any) => ({
        ...row,
        competencia: `${row.ano_referencia}-${String(row.mes_referencia).padStart(2, "0")}`,
        saldo: Math.max(Number(row.valor_previsto ?? row.valor ?? 0) - Number(row.valor_pago_total ?? 0), 0),
      }))
      .filter((row: any) => row.saldo > 0 && !["pago", "isento", "cancelado"].includes(String(row.status ?? "").toLowerCase()));

    if (mensalidades_competencias.length > 0) {
      const expectedPrefix = mensalidadesAbertas
        .slice(0, mensalidades_competencias.length)
        .map((row: any) => row.competencia);
      if (
        expectedPrefix.length !== mensalidades_competencias.length ||
        expectedPrefix.some((competencia: string, index: number) => competencia !== mensalidades_competencias[index])
      ) {
        return NextResponse.json({
          ok: false,
          error: "As mensalidades devem ser selecionadas em ordem cronológica, começando pela primeira competência em aberto.",
          code: "MENSALIDADES_SELECTION_ORDER_INVALID",
        }, { status: 409 });
      }
    }

    const mensalidadesSelecionadas = mensalidadesAbertas
      .filter((row: any) => mensalidades_competencias.includes(row.competencia));
    if (mensalidadesSelecionadas.length !== mensalidades_competencias.length) {
      return NextResponse.json({
        ok: false,
        error: "Uma das mensalidades selecionadas não foi gerada para esta matrícula.",
        code: "MENSALIDADES_NOT_GENERATED",
      }, { status: 409 });
    }

    const valorServicos = servicos.reduce((sum, service) => sum + service.preco, 0);
    const valorMensalidades = mensalidadesSelecionadas.reduce((sum: number, row: any) => sum + row.saldo, 0);
    const valorTotal = valorMatricula + valorServicos + valorMensalidades;
    const valorPago = parcial && amount !== undefined ? Number(amount) : valorTotal;
    if (valorPago <= 0) throw new Error("Não foi possível associar o pagamento ao aluno matriculado.");

    const itensPagamento = [
      // O batch processa mensalidades em ordem cronológica, mas devolve como
      // "data" o item de maior batch_index. Mantemos a matrícula por último
      // para que a emissão do recibo use um pagamento de serviço
      // (mensalidade_id IS NULL), conforme o contrato de emitir_recibo_servicos.
      ...mensalidadesSelecionadas.map((row: any) => ({
        id: row.id,
        nome: `Propina ${String(row.mes_referencia).padStart(2, "0")}/${row.ano_referencia}`,
        codigo: `MENSALIDADE_${row.competencia}`,
        preco: row.saldo,
        quantidade: 1,
        tipo: "mensalidade",
        competencia: row.competencia,
      })),
      ...servicos.map((service) => ({ ...service, tipo: "servico" })),
      { id: matriculaId, nome: "Matrícula", codigo: "SERV_MATRICULA", preco: valorMatricula, quantidade: 1, tipo: "servico" },
    ].filter((item) => Number(item.preco ?? 0) > 0);

    const metodoFinanceiro = metodo_pagamento === "CASH" ? "cash" : metodo_pagamento === "TPA" ? "tpa" : "transfer";
    let pagamento: any = null;

    if (!parcial && itensPagamento.length > 1) {
      const { data: batch, error: batchError } = await (supabase as any).rpc("financeiro_registrar_pagamentos_secretaria_batch", {
        p_escola_id: candidatura.escola_id,
        p_aluno_id: alunoId,
        p_itens: itensPagamento.map((item) => ({
          id: item.id,
          tipo: item.tipo,
          nome: item.nome,
          preco: item.preco,
        })),
        p_metodo: metodoFinanceiro,
        p_idempotency_key: `${idempotencyKey}:pagamento`,
        p_reference: referencia || null,
        p_evidence_url: comprovativo || null,
        p_gateway_ref: null,
        p_meta: {
          origem: "admissao",
          tipo_comprovativo: "matricula",
          matricula_id: matriculaId,
          itens_pagamento: itensPagamento,
          valor_total: valorTotal,
          valor_matricula: valorMatricula,
          valor_servicos: valorServicos,
          valor_mensalidades: valorMensalidades,
          mensalidades_competencias,
        },
      });
      if (batchError) throw batchError;
      if (batch?.ok !== true || !batch?.data?.id) {
        throw new Error(batch?.error || "Não foi possível registar o checkout financeiro.");
      }
      pagamento = batch.data;
    } else {
      const { data: pagamentoSingle, error: pagamentoError } = await (supabase as any).rpc("financeiro_registrar_pagamento_secretaria", {
        p_escola_id: candidatura.escola_id,
        p_aluno_id: alunoId,
        p_mensalidade_id: null,
        p_valor: valorPago,
        p_metodo: metodoFinanceiro,
        p_reference: referencia || undefined,
        p_evidence_url: comprovativo || undefined,
        p_gateway_ref: null,
        p_meta: {
          idempotency_key: `${idempotencyKey}:pagamento`,
          origem: "admissao",
          tipo_comprovativo: "matricula",
          matricula_id: matriculaId,
          itens_pagamento: itensPagamento,
          valor_total: valorTotal,
          valor_matricula: valorMatricula,
          valor_servicos: valorServicos,
          valor_mensalidades: valorMensalidades,
          mensalidades_competencias,
        },
      });
      if (pagamentoError) throw pagamentoError;
      pagamento = pagamentoSingle;
    }

    recordAuditServer({
      escolaId: candidatura.escola_id,
      portal: 'secretaria',
      acao: 'ADMISSAO_CONVERTIDA_MATRICULA',
      entity: 'matriculas',
      entityId: matriculaId,
      details: {
        candidatura_id,
        turma_id,
        metodo_pagamento,
        referencia: referencia ?? null,
        override_capacidade: result.override_capacidade ?? false,
        capacidade_maxima: result.capacidade_maxima ?? null,
        matriculados_antes: result.matriculados_antes ?? null,
      },
    }).catch(() => null)

    if (result.override_capacidade) {
      recordAuditServer({
        escolaId: candidatura.escola_id,
        portal: 'secretaria',
        acao: 'ADMISSAO_CAPACIDADE_OVERRIDE',
        entity: 'matriculas',
        entityId: matriculaId,
        details: {
          candidatura_id,
          turma_id,
          capacidade_maxima: result.capacidade_maxima ?? null,
          matriculados_antes: result.matriculados_antes ?? null,
          override_motivo: result.override_motivo ?? overrideMotivo,
        },
      }).catch(() => null)
    }

    try {
      await supabase.rpc('refresh_mv_turmas_para_matricula')
    } catch (refreshError) {
      console.warn('[admissoes/convert] refresh_mv_turmas_para_matricula failed:', refreshError)
    }
    let comprovante: { ok: boolean; printUrl?: string; error?: string } | null = null
    if (matriculaId) {
      const comprovanteResult = await emitirComprovanteMatricula({
        supabase,
        escolaId: candidatura.escola_id,
        matriculaId,
        dataHoraEfetivacao: new Date().toISOString(),
        createdBy: user.id,
        audit: {
          portal: "secretaria",
          acao: "COMPROVANTE_MATRICULA_AUTOEMITIDO",
        },
      })
      if (comprovanteResult.ok) {
        comprovante = { ok: true, printUrl: comprovanteResult.printUrl }
      } else {
        comprovante = { ok: false, error: comprovanteResult.error }
        console.warn('[admissoes/convert] comprovante não emitido:', comprovanteResult.error)
      }
    }

    let recibo: { ok: boolean; status: 'available' | 'pending' | 'error'; print_url?: string; doc_id?: string; public_id?: string; error?: string } | null = null
    if (pagamento?.id && !parcial) {
      const { data: reciboData, error: reciboError } = await (supabase as any).rpc('emitir_recibo_servicos', {
        p_pagamento_id: pagamento.id,
      })
      const reciboResult = reciboData && typeof reciboData === 'object' ? reciboData as Record<string, unknown> : null
      if (reciboError) {
        recibo = { ok: false, status: 'error', error: reciboError.message }
        console.warn('[admissoes/convert] recibo não emitido:', reciboError.message)
      } else if (reciboResult?.ok === true && typeof reciboResult.doc_id === 'string') {
        recibo = {
          ok: true,
          status: 'available',
          doc_id: reciboResult.doc_id,
          public_id: typeof reciboResult.public_id === 'string' ? reciboResult.public_id : undefined,
          print_url: `/secretaria/documentos/${reciboResult.doc_id}/recibo/print`,
        }
      } else {
        const receiptError = typeof reciboResult?.erro === 'string' ? reciboResult.erro : 'Recibo pendente de liquidação.'
        const isPending = /liquid|pendente|ainda/i.test(receiptError)
        recibo = { ok: false, status: isPending ? 'pending' : 'error', error: receiptError }
      }
    } else if (pagamento?.id && parcial) {
      recibo = { ok: false, status: 'pending', error: 'O recibo financeiro será emitido após a liquidação integral.' }
    }

    return NextResponse.json({
      ok: true,
      ...result,
      matricula_id: matriculaId,
      pagamento_id: pagamento?.id ?? null,
      valor_total: valorTotal,
      valor_mensalidades: valorMensalidades,
      mensalidades_competencias,
      itens_pagamento: itensPagamento,
      comprovante,
      recibo,
      familia,
    })
  } catch (error: unknown) {
    console.error('Error converting admission:', error)
    const isUniqueViolation =
      typeof error === 'object' &&
      error &&
      'code' in error &&
      (error as { code?: string }).code === '23505';
    const errorMessage =
      typeof error === 'object' && error && 'message' in error
        ? String((error as { message?: string }).message ?? '')
        : '';
    const errorDetails =
      typeof error === 'object' && error && 'details' in error
        ? String((error as { details?: string }).details ?? '')
        : '';
    const isAlreadyProcessedMessage =
      /this request has already been processed/i.test(errorMessage);
    const isIdempotencyUniqueViolation =
      isUniqueViolation &&
      /idempotency_keys|idempotency_keys_pkey|admissao_finalizar_matricula/i.test(`${errorMessage} ${errorDetails}`);

    if (isIdempotencyUniqueViolation || isAlreadyProcessedMessage) {
      // 1) Tenta recuperar resultado idempotente já gravado pela RPC.
      if (idempotencyKey && escolaIdContext) {
        const { data: existingIdempotency } = await supabase
          .from("idempotency_keys")
          .select("result")
          .eq("escola_id", escolaIdContext)
          .eq("scope", "admissao_finalizar_matricula")
          .eq("key", idempotencyKey)
          .maybeSingle();
        const idempotencyResult = existingIdempotency?.result ?? null;
        if (isJsonObject(idempotencyResult)) {
          return NextResponse.json(idempotencyResult);
        }
      }

      // 2) Fallback: verifica estado final da candidatura/matrícula.
      const finalizedResult = await getFinalizedAdmissionResult(supabase, candidatura_id, escolaIdContext);
      if (finalizedResult) return NextResponse.json(finalizedResult);

      return NextResponse.json(
        {
          ok: false,
          error: "Operação duplicada detectada sem resultado persistido. A requisição original pode ainda estar em processamento.",
          code: "DUPLICATE_REQUEST_PENDING_STATE",
        },
        { status: 409 }
      );
    }
    if (isUniqueViolation) {
      const finalizedResult = await getFinalizedAdmissionResult(supabase, candidatura_id, escolaIdContext);
      if (finalizedResult) return NextResponse.json(finalizedResult);

      const conflictText = `${errorMessage} ${errorDetails}`;
      const existingMatricula = await getExistingMatriculaConflict(
        supabase,
        escolaIdContext,
        conflictText
      );

      if (
        existingMatricula &&
        !isOfficialMatriculaStatus(existingMatricula.status) &&
        /candidaturas_matricula_draft_conflict|rascunho de matr[ií]cula|Retome a candidatura/i.test(conflictText)
      ) {
        const currentCandidatura = await getCurrentAdmissionSnapshot(supabase, candidatura_id, escolaIdContext);

        return NextResponse.json(
          {
            ok: false,
            error: "Este aluno/documento já tem uma admissão em andamento. Retome o rascunho existente para finalizar a matrícula sem duplicar registos.",
            details: errorDetails || errorMessage || null,
            code: "ADMISSION_EXISTING_DRAFT",
            existing_matricula: existingMatricula,
            current_candidatura: currentCandidatura,
          },
          { status: 409 }
        );
      }

      if (
        existingMatricula &&
        /candidaturas_matricula_id_unique|matricula_id|Matr[ií]cula/i.test(conflictText)
      ) {
        const currentCandidatura = await getCurrentAdmissionSnapshot(supabase, candidatura_id, escolaIdContext);

        return NextResponse.json(
          {
            ok: false,
            error: "Este aluno/documento já tem matrícula finalizada neste ano letivo. Abra a matrícula existente ou corrija a candidatura duplicada.",
            details: errorDetails || errorMessage || null,
            code: "ADMISSION_ALREADY_MATRICULATED",
            existing_matricula: existingMatricula,
            current_candidatura: currentCandidatura,
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          ok: false,
          error: "Conflito de dados ao finalizar matrícula. Verifique se o aluno/documento já existe ou se já há matrícula no ano letivo.",
          details: errorDetails || errorMessage || null,
          code: "ADMISSION_CONSTRAINT_CONFLICT",
        },
        { status: 409 }
      );
    }
    if (/TURMA_LOTADA_CAPACIDADE|Turma lotada/i.test(errorMessage)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Turma lotada. Um responsável autorizado pode efetivar com override e motivo obrigatório.",
          details: errorMessage || null,
          code: "TURMA_LOTADA_CAPACIDADE",
        },
        { status: 409 }
      )
    }
    if (/Override de capacidade não autorizado/i.test(errorMessage)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Sem permissão para override de capacidade.",
          details: errorMessage || null,
          code: "CAPACITY_OVERRIDE_FORBIDDEN",
        },
        { status: 403 }
      )
    }
    if (/Motivo obrigatório para override de capacidade/i.test(errorMessage)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Motivo obrigatório para override de capacidade.",
          details: errorMessage || null,
          code: "CAPACITY_OVERRIDE_REASON_REQUIRED",
        },
        { status: 400 }
      )
    }
    if (
      typeof error === 'object' &&
      error &&
      'code' in error &&
      error.code === 'P0001' &&
      /Mensalidade anterior à entrada financeira/i.test(errorMessage)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'A matrícula não pôde ser finalizada porque o plano financeiro começa depois da primeira mensalidade gerada.',
          details: 'A candidatura foi preservada para edição. Tente novamente após a atualização financeira.',
          code: 'FINANCIAL_ENTRY_DATE_CONFLICT',
          action: { id: 'review_admission', label: 'Rever matrícula' },
        },
        { status: 409 }
      )
    }
    if (
      typeof error === 'object' &&
      error &&
      'code' in error &&
      error.code === 'P0001' &&
      /Data de início financeiro .* depois do fim do calendário/i.test(errorMessage)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'A data financeira escolhida está fora do calendário académico da turma.',
          details: 'Escolha uma competência dentro do calendário MED da turma. A candidatura continua disponível para edição.',
          code: 'FINANCIAL_START_OUTSIDE_ACADEMIC_CALENDAR',
          action: { id: 'review_admission', label: 'Rever matrícula' },
        },
        { status: 409 }
      )
    }
    if (
      typeof error === 'object' &&
      error &&
      'code' in error &&
      error.code === 'P0001' &&
      /Calendário académico MED não configurado/i.test(errorMessage)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'A turma não tem calendário académico MED configurado.',
          details: 'Configure o calendário do ano letivo da turma e retome a candidatura para finalizar a matrícula.',
          code: 'ACADEMIC_CALENDAR_NOT_CONFIGURED',
          action: { id: 'open_academic_calendar', label: 'Corrigir calendário MED' },
        },
        { status: 409 }
      )
    }
    if (
      typeof error === 'object' &&
      error &&
      'code' in error &&
      error.code === 'P0001' &&
      /Calendário académico da turma não corresponde/i.test(errorMessage)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'O calendário académico da turma não corresponde ao ano letivo da matrícula.',
          details: 'Corrija o vínculo da turma ao calendário MED e retome a candidatura.',
          code: 'ACADEMIC_CALENDAR_YEAR_MISMATCH',
          action: { id: 'open_academic_calendar', label: 'Corrigir calendário MED' },
        },
        { status: 409 }
      )
    }
    if (typeof error === 'object' && error && 'code' in error && error.code === '42883') {
      const message = String((error as { message?: string }).message ?? '')
      const missingFunction = /confirmar_matricula_core/i.test(message)
      return NextResponse.json(
        {
          error: missingFunction
            ? 'Banco desatualizado: função confirmar_matricula_core não encontrada.'
            : 'Erro de compatibilidade no banco ao converter matrícula.',
          details: missingFunction
            ? 'Execute as migrations locais (ex: pnpm db:push ou pnpm db:reset) para criar a função.'
            : (error as { message?: string }).message ?? null,
          hint: missingFunction ? null : (error as { hint?: string }).hint ?? null,
          code: (error as { code?: string }).code ?? null,
        },
        { status: 500 }
      )
    }
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : null,
        code: typeof error === 'object' && error && 'code' in error ? (error as { code?: string }).code ?? null : null,
      },
      { status: 500 }
    )
  }
}
