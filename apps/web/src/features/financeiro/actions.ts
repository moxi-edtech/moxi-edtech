"use server";

import { createClient } from "@/utils/supabase/server";
import { requireRoleInSchool } from "@/lib/authz";
import { K12_FINANCEIRO_OPERACIONAL_ROLE_GROUP } from "@/lib/roles";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { revalidatePath } from "next/cache";
import type { Database, Json } from "~types/supabase";

export type PagamentoMetodo = Database["public"]["Enums"]["pagamento_metodo"];

type RpcLoteResult = {
  ok?: boolean;
  erro?: string | null;
  geradas?: number | null;
};

type RpcValidarPagamentoResult = {
  ok?: boolean;
  error?: string | null;
};

export interface RegistrarPagamentoPayload {
  escola_id: string;
  aluno_id: string;
  mensalidade_id: string;
  valor: number;
  metodo: PagamentoMetodo;
  reference?: string;
  evidence_url?: string;
  gateway_ref?: string;
  meta?: Record<string, Json>;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

async function requireFinanceiroAccess(supabase: Awaited<ReturnType<typeof createClient>>, escolaId?: string | null) {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;

  if (!user) {
    throw new Error("Não autenticado.");
  }

  const resolvedEscolaId = await resolveEscolaIdForUser(
    supabase as any,
    user.id,
    escolaId ? String(escolaId) : null
  );

  if (!resolvedEscolaId) {
    throw new Error("Sem permissão para esta escola.");
  }

  const roleCheck = await requireRoleInSchool({
    supabase: supabase as any,
    escolaId: resolvedEscolaId,
    roles: [...K12_FINANCEIRO_OPERACIONAL_ROLE_GROUP],
  });

  if (roleCheck.error) {
    throw new Error("Sem permissão financeira.");
  }

  return resolvedEscolaId;
}

async function resolvePagamentoEscolaId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pagamentoId: string
) {
  const { data, error } = await supabase
    .from("pagamentos")
    .select("escola_id")
    .eq("id", pagamentoId)
    .maybeSingle();

  if (error || !data?.escola_id) {
    throw new Error("Pagamento não encontrado.");
  }

  return String(data.escola_id);
}

/**
 * Server Action para registrar um pagamento via secretaria.
 * Utiliza a RPC financeiro_registrar_pagamento_secretaria para garantir atomicidade.
 */
export async function registrarPagamentoAction(payload: RegistrarPagamentoPayload) {
  const supabase = await createClient();

  try {
    const resolvedEscolaId = await requireFinanceiroAccess(supabase, payload.escola_id);

    const { data, error } = await supabase.rpc("financeiro_registrar_pagamento_secretaria", {
      p_escola_id: resolvedEscolaId,
      p_aluno_id: payload.aluno_id,
      p_mensalidade_id: payload.mensalidade_id,
      p_valor: payload.valor,
      p_metodo: payload.metodo,
      p_reference: payload.reference || undefined,
      p_evidence_url: payload.evidence_url || undefined,
      p_gateway_ref: payload.gateway_ref || undefined,
      p_meta: payload.meta || {},
    });

    if (error) {
      console.error("Erro na RPC registrar_pagamento_secretaria:", error);
      throw new Error(error.message || "Erro ao registrar pagamento na base de dados.");
    }

    // Revalidar caminhos relacionados ao financeiro para atualizar a UI
    revalidatePath(`/escola/${resolvedEscolaId}/(portal)/financeiro/pagamentos`);
    revalidatePath(`/escola/${resolvedEscolaId}/(portal)/financeiro/turmas-alunos`);
    
    // Se a mensalidade for de um aluno específico, podemos revalidar a ficha dele também
    // revalidatePath(`/escola/${payload.escola_id}/(portal)/secretaria/alunos/${payload.aluno_id}`);

    return { success: true, data };
  } catch (error: unknown) {
    console.error("Erro na Action registrarPagamentoAction:", error);
    return { 
      success: false, 
      error: getErrorMessage(error, "Falha ao processar o registro de pagamento."),
    };
  }
}

/**
 * Obtém a lista de pagamentos pendentes de validação (comprovativos enviados por alunos).
 */
export async function getPagamentosPendentes(escolaId: string) {
  const supabase = await createClient();

  try {
    const resolvedEscolaId = await requireFinanceiroAccess(supabase, escolaId);

    const { data, error } = await supabase
      .from("vw_pagamentos_pendentes")
      .select("*")
      .eq("escola_id", resolvedEscolaId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar pagamentos pendentes:", error);
      return [];
    }

    return data;
  } catch (error) {
    console.error("Sem permissão para listar pagamentos pendentes:", error);
    return [];
  }
}

/**
 * Gera mensalidades em lote para uma escola, ano letivo e mês específicos.
 */
export async function gerarMensalidadesLoteAction(
  escolaId: string,
  anoLetivo: number,
  mesReferencia: number,
  diaVencimentoDefault: number = 10,
  turmaId?: string
) {
  const supabase = await createClient();

  try {
    const resolvedEscolaId = await requireFinanceiroAccess(supabase, escolaId);

    const { data, error } = await supabase.rpc("gerar_mensalidades_lote", {
      p_escola_id: resolvedEscolaId,
      p_ano_letivo: anoLetivo,
      p_mes_referencia: mesReferencia,
      p_dia_vencimento_default: diaVencimentoDefault,
      p_turma_id: turmaId || null,
    });

    if (error) {
      throw new Error(error.message || "Erro ao gerar mensalidades em lote.");
    }

    const result = (data ?? {}) as RpcLoteResult;
    if (!result.ok) {
      throw new Error(result.erro || "Falha na geração de mensalidades.");
    }

    revalidatePath(`/escola/${resolvedEscolaId}/(portal)/financeiro/dashboard`);
    revalidatePath(`/escola/${resolvedEscolaId}/(portal)/financeiro/turmas-alunos`);

    return { success: true, geradas: result.geradas ?? 0 };
  } catch (error: unknown) {
    console.error("Erro na Action gerarMensalidadesLoteAction:", error);
    return { success: false, error: getErrorMessage(error, "Erro ao gerar mensalidades em lote.") };
  }
}

/**
 * Obtém o resumo financeiro de um aluno (Total devido, pago e saldo).
 */
export async function getResumoFinanceiroAluno(escolaId: string, alunoId: string) {
  const supabase = await createClient();
  const resolvedEscolaId = await requireFinanceiroAccess(supabase, escolaId);

  const { data, error } = await supabase
    .from("mensalidades")
    .select("valor_previsto, valor_pago_total, status")
    .eq("escola_id", resolvedEscolaId)
    .eq("aluno_id", alunoId)
    .neq("status", "cancelado");

  if (error) {
    console.error("Erro ao buscar resumo financeiro do aluno:", error);
    return { totalDevido: 0, totalPago: 0, saldo: 0, pendentes: 0 };
  }

  const resumo = data.reduce(
    (acc, m) => {
      acc.totalDevido += Number(m.valor_previsto || 0);
      acc.totalPago += Number(m.valor_pago_total || 0);
      if (m.status === "pendente" || m.status === "pago_parcial") {
        acc.pendentes += 1;
      }
      return acc;
    },
    { totalDevido: 0, totalPago: 0, pendentes: 0 }
  );

  return {
    ...resumo,
    saldo: resumo.totalDevido - resumo.totalPago,
  };
}

/**
 * Valida (aprova ou rejeita) um pagamento que estava pendente de validação.
 */
export async function validarPagamentoAction(
  pagamentoId: string, 
  aprovado: boolean, 
  mensagemSecretaria?: string
) {
  const supabase = await createClient();

  try {
    const pagamentoEscolaId = await resolvePagamentoEscolaId(supabase, pagamentoId);
    await requireFinanceiroAccess(supabase, pagamentoEscolaId);

    const { data, error } = await supabase.rpc("validar_pagamento", {
      p_pagamento_id: pagamentoId,
      p_aprovado: aprovado,
      p_mensagem_secretaria: mensagemSecretaria || undefined,
    });

    if (error) {
      const cleanMessage = error.message.replace(/^(DATA|AUTH|STATE|PARA):\s*/, "");
      console.error("Erro na RPC validar_pagamento:", error);
      throw new Error(cleanMessage || "Erro ao validar pagamento.");
    }
    const result = (data ?? {}) as RpcValidarPagamentoResult;
    if (!result.ok) {
      throw new Error(result.error || "Falha na validação do pagamento.");
    }

    // Revalidar caminhos relacionados ao financeiro
    // Não temos o escolaId aqui diretamente da RPC return (precisamos do payload original ou buscar)
    // Mas as actions do Next.js revalidam por tag ou path.
    // Como não temos o escolaId, vamos assumir que quem chama faz o revalidatePath se necessário,
    // ou podemos tentar extrair do result se a RPC retornasse.

    return { success: true, data: result };
  } catch (error: unknown) {
    console.error("Erro na Action validarPagamentoAction:", error);
    return { success: false, error: getErrorMessage(error, "Erro ao validar pagamento.") };
  }
}
