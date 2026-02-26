import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createRouteClient } from "@/lib/supabase/route-client";
import { importBelongsToEscola, userHasAccessToEscola } from "../../auth-helpers";
import { resolveTabelaPreco } from "@/lib/financeiro/tabela-preco";

import type { Database } from "~types/supabase";
import type { ImportResult } from "~types/migracao";

export const dynamic = "force-dynamic";

type FinancePendenciaMotivo =
  | "turma_nao_encontrada"
  | "turma_inativa"
  | "matricula_pendente"
  | "pricing_ausente";

type FinancePendenciaItem = {
  codigo: FinancePendenciaMotivo;
  motivo: string;
  mensagem: string;
  aluno_id: string | null;
  aluno_nome: string | null;
  matricula_id: string | null;
  turma_id: string | null;
  turma_codigo: string | null;
};

type FinanceContextResult = {
  activeMatriculas: number;
  pendencias: FinancePendenciaItem[];
};

const pendenciaCatalogo: Record<FinancePendenciaMotivo, { motivo: string; mensagem: string }> = {
  turma_nao_encontrada: {
    motivo: "Turma não encontrada",
    mensagem: "A turma indicada não está cadastrada ou não foi reconhecida.",
  },
  turma_inativa: {
    motivo: "Turma não ativa",
    mensagem: "A turma ainda não está ativa. A coordenação precisa aprovar.",
  },
  matricula_pendente: {
    motivo: "Matrícula pendente",
    mensagem: "A matrícula ainda não foi confirmada para esta turma.",
  },
  pricing_ausente: {
    motivo: "Preço não configurado",
    mensagem: "Configure a tabela de preços para gerar o financeiro.",
  },
};

interface ImportBody {
  importId: string;
  escolaId: string;
  skipMatricula?: boolean;
  startMonth?: number;
  modo?: 'migracao' | 'onboarding';
  dataInicioFinanceiro?: string;
}

export async function POST(request: Request) {
  // Autentica usuário
  const routeClient = await createRouteClient();
  const { data: userRes } = await routeClient.auth.getUser();
  const authUser = userRes?.user;
  if (!authUser) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: ImportBody;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { importId, escolaId } = body;
  if (!importId || !escolaId) {
    return NextResponse.json({ error: "importId e escolaId são obrigatórios" }, { status: 400 });
  }

  const skipMatricula = Boolean(body.skipMatricula);
  const todayMonth = new Date().getMonth() + 1;
  let startMonth = Number(body.startMonth ?? todayMonth);
  if (!Number.isFinite(startMonth) || startMonth < 1 || startMonth > 12) startMonth = todayMonth;

  const supabase = routeClient as SupabaseClient<Database>;

  // Verifica acesso e pertencimento do importId
  const hasAccess = await userHasAccessToEscola(supabase, escolaId, authUser.id);
  if (!hasAccess) return NextResponse.json({ error: "Sem vínculo com a escola" }, { status: 403 });
  const sameEscola = await importBelongsToEscola(supabase, importId, escolaId);
  if (!sameEscola) return NextResponse.json({ error: "Importação não pertence à escola" }, { status: 403 });

  type ImportModo = "migracao" | "onboarding";
  const modoFinal: ImportModo = body.modo === "onboarding" ? "onboarding" : "migracao";

  const dataInicioFinal: string | null = body.dataInicioFinanceiro
    ? new Date(body.dataInicioFinanceiro).toISOString().slice(0, 10)
    : null;

  const params = {
    p_import_id: importId,
    p_escola_id: escolaId,
    p_modo: modoFinal,
    p_data_inicio_financeiro: dataInicioFinal, // null intencional
  };

  // Usa o RPC com `as any` para contornar a incompatibilidade de tipos entre o esquema local e o remoto
  const { data, error } = await (supabase as any).rpc("importar_alunos_v4", params);

  if (error) {
    console.error("[importar_alunos_v4] rpc error", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Define o tipo de resultado esperado da RPC
  type RpcResult = {
    ok: boolean;
    imported: number;
    turmas_created: number;
    matriculas_pendentes: number;
    errors: number;
  };

  const row = Array.isArray(data) ? data[0] : data;
  const result = row as unknown as RpcResult;
  const isNum = (v: any) => typeof v === "number" && Number.isFinite(v);

  // Valida o shape da resposta da RPC, incluindo números
  if (!result || typeof result.ok !== "boolean" || !isNum(result.imported) || !isNum(result.errors)) {
    console.error("[importar_alunos_v4] resposta inesperada", { importId, data });
    return NextResponse.json({ ok: false, error: "Resposta inesperada da importação" }, { status: 500 });
  }

  const { error: updateErr } = await supabase
    .from("import_migrations")
    .update({
      status: "imported", // CORRIGIDO: usa "imported"
      imported_rows: result.imported ?? 0,
      error_rows: result.errors ?? 0,
      processed_at: new Date().toISOString(),
    })
    .eq("id", importId);

  if (updateErr) {
    // Não quebra a request, mas loga o erro de atualização
    console.error("[import_migrations] update error", { importId, error: updateErr });
  }

  let financeResult: FinanceContextResult = { activeMatriculas: 0, pendencias: [] };
  let financeErrorMessage: string | null = null;
  try {
    // 1) Pegar ano_letivo do staging, garantindo que é único para o import
    const { data: years, error: stagingYearErr } = await supabase
      .from("staging_alunos")
      .select("ano_letivo")
      .eq("import_id", importId)
      .eq("escola_id", escolaId)
      .not("ano_letivo", "is", null);

    if (stagingYearErr) {
      throw new Error(stagingYearErr.message);
    }

    const uniq = Array.from(new Set((years ?? []).map(r => Number(r.ano_letivo)).filter(Boolean)));
    if (uniq.length !== 1) {
      return NextResponse.json(
        { ok: false, error: `Importação inconsistente: ano_letivo múltiplo no staging (${uniq.join(", ")})` },
        { status: 400 }
      );
    }
    const anoLetivoFromStaging = uniq[0];
    if (!anoLetivoFromStaging || Number.isNaN(anoLetivoFromStaging)) {
      throw new Error("ano_letivo não encontrado na staging_alunos para este importId");
    }

    financeResult = await aplicarContextoFinanceiro({
      supabase,
      escolaId,
      importId,
      anoLetivo: anoLetivoFromStaging,
      skipMatricula,
      startMonth,
    });
  } catch (financeError) {
    console.error("[migracao/importar] Falha ao aplicar contexto financeiro:", financeError);
    financeErrorMessage = "Não foi possível aplicar o financeiro automaticamente.";
  }

  const pendenciasFinanceiras = financeResult.pendencias ?? [];
  const pendenciasVisiveis = pendenciasFinanceiras.map(({ codigo, ...rest }) => rest);
  const pendenciasPorMotivo = pendenciasFinanceiras.reduce<Record<string, number>>((acc, item) => {
    acc[item.motivo] = (acc[item.motivo] ?? 0) + 1;
    return acc;
  }, {});

  const pendenciasTotal = pendenciasFinanceiras.length;
  const okFinanceiro = !financeErrorMessage && pendenciasTotal === 0;

  const mensagemResumo = pendenciasTotal > 0
    ? `Importação concluída: ${result.imported} importados, ${pendenciasTotal} com pendências financeiras.`
    : `Importação concluída: ${result.imported} importados sem pendências financeiras.`;

  try {
    const { error: clearPendenciasErr } = await supabase
      .from("import_financeiro_pendencias")
      .delete()
      .eq("import_id", importId);

    if (clearPendenciasErr) {
      console.error("[import_financeiro_pendencias] clear error", clearPendenciasErr);
    }

    if (pendenciasFinanceiras.length > 0) {
      const pendenciasRows = pendenciasFinanceiras.map((item) => ({
        escola_id: escolaId,
        import_id: importId,
        aluno_id: item.aluno_id,
        matricula_id: item.matricula_id,
        turma_id: item.turma_id,
        motivo: item.motivo,
        mensagem: item.mensagem,
        detalhes: {
          codigo: item.codigo,
          turma_codigo: item.turma_codigo,
        },
      }));

      const { error: insertPendenciasErr } = await supabase
        .from("import_financeiro_pendencias")
        .insert(pendenciasRows);

      if (insertPendenciasErr) {
        console.error("[import_financeiro_pendencias] insert error", insertPendenciasErr);
      }
    }
  } catch (pendenciasError) {
    console.error("[import_financeiro_pendencias] inesperado", pendenciasError);
  }

  try {
    await notificarRascunhosESucesso({
      supabase,
      escolaId,
      importId,
      result,
      activeMatriculas: financeResult.activeMatriculas,
      pendenciasFinanceiras: pendenciasTotal,
    });
  } catch (notifyError) {
    console.error("[migracao/importar] Falha ao notificar:", notifyError);
  }

  return NextResponse.json({
    ok: result.ok,
    ok_importacao: result.ok,
    ok_financeiro: okFinanceiro,
    mensagem_resumo: mensagemResumo,
    resumo: {
      importados: result.imported,
      erros: result.errors,
      turmas_criadas: result.turmas_created ?? 0,
      matriculas_pendentes: result.matriculas_pendentes ?? 0,
      financeiro_ativo: financeResult.activeMatriculas,
      pendencias_financeiras: pendenciasTotal,
    },
    pendencias_financeiras: {
      total: pendenciasTotal,
      por_motivo: pendenciasPorMotivo,
      itens: pendenciasVisiveis,
    },
    alertas: financeErrorMessage ? [financeErrorMessage] : [],
    result,
  });
}

type SupabaseAdmin = SupabaseClient<Database>;

async function aplicarContextoFinanceiro(params: {
  supabase: SupabaseAdmin;
  escolaId: string;
  importId: string;
  anoLetivo: number;
  skipMatricula: boolean;
  startMonth: number;
}): Promise<FinanceContextResult> {
  const { supabase, escolaId, importId, anoLetivo, skipMatricula, startMonth } = params;

  const clampedMonth = Math.min(Math.max(startMonth || 1, 1), 12);

  const { data: alunos } = await supabase
    .from("alunos")
    .select("id")
    .eq("escola_id", escolaId)
    .eq("import_id", importId);

  const alunoIds = (alunos || []).map((a) => (a as any).id).filter(Boolean);
  if (!alunoIds.length) return { activeMatriculas: 0, pendencias: [] };

  const { data: matriculas } = await supabase
    .from("matriculas")
    .select(
      "id, aluno_id, turma_id, ano_letivo, status, ativo, turmas(id, curso_id, classe_id, status_validacao, turma_codigo, nome), alunos(nome, nome_completo)"
    )
    .in("aluno_id", alunoIds)
    .eq("ano_letivo", anoLetivo);

  const pricingCache = new Map<string, { valorMatricula: number; valorMensalidade: number; diaVencimento: number | null } | null>();
  const resolvePricing = async (cursoId?: string | null, classeId?: string | null) => {
    const key = `${cursoId || "null"}:${classeId || "null"}`;
    if (pricingCache.has(key)) return pricingCache.get(key);
    const { tabela } = await resolveTabelaPreco(supabase as any, {
      escolaId,
      anoLetivo,
      cursoId: cursoId || undefined,
      classeId: classeId || undefined,
      allowMensalidadeFallback: true,
    });
    const parsed = tabela
      ? {
          valorMatricula: Number(tabela.valor_matricula || 0),
          valorMensalidade: Number(tabela.valor_mensalidade || 0),
          diaVencimento: (tabela.dia_vencimento as any) ?? null,
        }
      : null;
    pricingCache.set(key, parsed);
    return parsed;
  };

  const pendencias: FinancePendenciaItem[] = [];

  const matriculasValidas: Array<{ id: string; aluno_id: string; turma_id: string | null; pricing: { valorMatricula: number; valorMensalidade: number; diaVencimento: number | null } }>
    = [];

  const pushPendencia = (
    m: any,
    turma: any,
    motivo: FinancePendenciaMotivo
  ) => {
    const catalogo = pendenciaCatalogo[motivo];
    const alunoNome = (m?.alunos?.nome_completo ?? m?.alunos?.nome ?? null) as string | null;
    const turmaCodigo = (turma?.turma_codigo ?? turma?.nome ?? null) as string | null;
    pendencias.push({
      codigo: motivo,
      motivo: catalogo.motivo,
      mensagem: catalogo.mensagem,
      aluno_id: m?.aluno_id ?? null,
      aluno_nome: alunoNome,
      matricula_id: m?.id ?? null,
      turma_id: m?.turma_id ?? null,
      turma_codigo: turmaCodigo,
    });
  };

  for (const m of matriculas || []) {
    const turma = (m as any).turmas as any;
    if (!turma) {
      pushPendencia(m, null, "turma_nao_encontrada");
      continue;
    }
    if (turma.status_validacao !== "ativo") {
      pushPendencia(m, turma, "turma_inativa");
      continue;
    }
    const statusMatricula = String((m as any).status || "").toLowerCase();
    const matriculaAtiva = (m as any).ativo === true;
    if (!matriculaAtiva || (statusMatricula && !["ativo", "ativa"].includes(statusMatricula))) {
      pushPendencia(m, turma, "matricula_pendente");
      continue;
    }

    const pricing = await resolvePricing(turma.curso_id, turma.classe_id);
    if (!pricing) {
      pushPendencia(m, turma, "pricing_ausente");
      continue;
    }

    matriculasValidas.push({
      id: (m as any).id,
      aluno_id: (m as any).aluno_id,
      turma_id: (m as any).turma_id,
      pricing,
    });
  }

  const matriculasMensalidade = new Set<string>();
  const matriculasParaAbono = new Set<string>();

  for (const m of matriculasValidas) {
    if (m.pricing.valorMensalidade > 0) matriculasMensalidade.add(m.id);
    if (skipMatricula && m.pricing.valorMatricula > 0) matriculasParaAbono.add(m.id);
  }

  const activeMatriculasCount = matriculasValidas.length;

  const chunk = <T,>(arr: T[], size: number) => {
    const res: T[][] = [];
    for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
    return res;
  };

  // Limpa ou quita mensalidades anteriores ao marco definido
  if (clampedMonth > 1 && matriculasMensalidade.size > 0) {
    const matriculasChunked = chunk(Array.from(matriculasMensalidade), 200);
    for (const group of matriculasChunked) {
      await supabase
        .from("mensalidades")
        .update({
          status: "isento" as any,
          valor_previsto: 0,
          valor: 0,
          valor_pago_total: 0,
        })
        .eq("escola_id", escolaId)
        .eq("ano_referencia", anoLetivo)
        .lt("mes_referencia", clampedMonth)
        .in("matricula_id", group);

      await supabase
        .from("financeiro_lancamentos")
        .update({
          status: "pago" as any,
          valor_original: 0,
          valor_multa: 0,
          valor_desconto: 0,
          data_pagamento: new Date().toISOString(),
        })
        .eq("escola_id", escolaId)
        .eq("origem", "mensalidade")
        .eq("ano_referencia", anoLetivo)
        .lt("mes_referencia", clampedMonth)
        .in("matricula_id", group);
    }
  }

  // Abona/zera matrícula quando solicitado
  if (matriculasParaAbono.size > 0) {
    const matriculasChunked = chunk(Array.from(matriculasParaAbono), 200);
    for (const group of matriculasChunked) {
      await supabase
        .from("financeiro_lancamentos")
        .update({
          status: "pago" as any,
          valor_original: 0,
          valor_multa: 0,
          valor_desconto: 0,
          data_pagamento: new Date().toISOString(),
        })
        .eq("escola_id", escolaId)
        .eq("origem", "matricula")
        .in("matricula_id", group);
    }
  }

  return { activeMatriculas: activeMatriculasCount, pendencias };
}

async function notificarRascunhosESucesso(params: {
  supabase: SupabaseAdmin;
  escolaId: string;
  importId: string;
  result: ImportResult;
  activeMatriculas: number;
  pendenciasFinanceiras: number;
}) {
  const { supabase, escolaId, importId, result, activeMatriculas, pendenciasFinanceiras } = params;

  // Notificação para Admin/Pedagógico sobre rascunhos criados
  const { data: turmasRascunho } = await supabase
    .from("turmas")
    .select("id")
    .eq("escola_id", escolaId)
    .eq("import_id", importId)
    .eq("status_validacao", "rascunho");

  const totalRascunho = turmasRascunho?.length || 0;
  if (totalRascunho > 0) {
    await supabase.from("notifications").insert({
      escola_id: escolaId,
      target_role: "admin",
      tipo: "turmas_rascunho_importacao",
      titulo: `Importação gerou ${totalRascunho} turmas em rascunho`,
      mensagem: "Revise e aprove para liberar o financeiro.",
      link_acao: "/dashboard/turmas",
    });
  }

  // Notificação para Financeiro apenas se houve alunos importados em turmas ativas (aplicada em contexto financeiro)
  if (activeMatriculas > 0) {
    await supabase.from("notifications").insert({
      escola_id: escolaId,
      target_role: "financeiro",
      tipo: "importacao_turmas_ativas",
      titulo: `Importação concluída: ${activeMatriculas} alunos em turmas ativas`,
      mensagem: "Clique para auditar cobranças e isenções.",
      link_acao: "/financeiro",
    });
  }

  if (pendenciasFinanceiras > 0) {
    await supabase.from("notifications").insert({
      escola_id: escolaId,
      target_role: "admin",
      tipo: "importacao_pendencias_financeiras",
      titulo: `Importação com ${pendenciasFinanceiras} pendências financeiras`,
      mensagem: "Há alunos sem contexto financeiro. Revise preços e turmas ativas.",
      link_acao: "/financeiro/configuracoes/precos",
    });
  }
}
