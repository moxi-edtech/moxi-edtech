import { NextResponse } from "next/server";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { createRouteClient } from "@/lib/supabase/route-client";
import { importBelongsToEscola, userHasAccessToEscola } from "../../auth-helpers";
import { resolveTabelaPreco } from "@/lib/financeiro/tabela-preco";

import type { Database } from "~types/supabase";
import type { ImportResult } from "~types/migracao";

export const dynamic = "force-dynamic";

interface ImportBody {
  importId: string;
  escolaId: string;
  skipMatricula?: boolean;
  startMonth?: number;
  modo?: 'migracao' | 'onboarding';
  dataInicioFinanceiro?: string;
}

export async function POST(request: Request) {
  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!adminUrl || !serviceKey) {
    return NextResponse.json({ error: "SUPABASE configuration missing" }, { status: 500 });
  }

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

  const supabase = createAdminClient<Database>(adminUrl, serviceKey);

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

  let financeActiveCount = 0;
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

    financeActiveCount = await aplicarContextoFinanceiro({
      supabase,
      escolaId,
      importId,
      anoLetivo: anoLetivoFromStaging,
      skipMatricula,
      startMonth,
    });
  } catch (financeError) {
    console.error("[migracao/importar] Falha ao aplicar contexto financeiro:", financeError);
  }

  try {
    await notificarRascunhosESucesso({
      supabase,
      escolaId,
      importId,
      result,
      activeMatriculas: financeActiveCount,
    });
  } catch (notifyError) {
    console.error("[migracao/importar] Falha ao notificar:", notifyError);
  }

  return NextResponse.json(result ?? {});
}

type SupabaseAdmin = SupabaseClient<Database>;

async function aplicarContextoFinanceiro(params: {
  supabase: SupabaseAdmin;
  escolaId: string;
  importId: string;
  anoLetivo: number;
  skipMatricula: boolean;
  startMonth: number;
}): Promise<number> {
  const { supabase, escolaId, importId, anoLetivo, skipMatricula, startMonth } = params;

  const clampedMonth = Math.min(Math.max(startMonth || 1, 1), 12);

  const { data: alunos } = await supabase
    .from("alunos")
    .select("id")
    .eq("escola_id", escolaId)
    .eq("import_id", importId);

  const alunoIds = (alunos || []).map((a) => (a as any).id).filter(Boolean);
  if (!alunoIds.length) return 0;

  const { data: matriculas } = await supabase
    .from("matriculas")
    .select("id, aluno_id, turma_id, ano_letivo, turmas(id, curso_id, classe_id, status_validacao)")
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

  const matriculasValidas: Array<{ id: string; aluno_id: string; turma_id: string | null; pricing: { valorMatricula: number; valorMensalidade: number; diaVencimento: number | null } }>
    = [];

  for (const m of matriculas || []) {
    const turma = (m as any).turmas as any;
    if (!turma || turma.status_validacao !== "ativo") continue;
    const pricing = await resolvePricing(turma.curso_id, turma.classe_id);
    if (!pricing) continue;
    matriculasValidas.push({
      id: (m as any).id,
      aluno_id: (m as any).aluno_id,
      turma_id: (m as any).turma_id,
      pricing,
    });
  }

  const alunoMensalidade = new Set<string>();
  const matriculasParaAbono = new Set<string>();

  for (const m of matriculasValidas) {
    if (m.pricing.valorMensalidade > 0) alunoMensalidade.add(m.aluno_id);
    if (skipMatricula && m.pricing.valorMatricula > 0) matriculasParaAbono.add(m.id);
  }

  const activeMatriculasCount = matriculasValidas.length;

  const chunk = <T,>(arr: T[], size: number) => {
    const res: T[][] = [];
    for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
    return res;
  };

  // Limpa ou quita mensalidades anteriores ao marco definido
  if (clampedMonth > 1 && alunoMensalidade.size > 0) {
    const alunosChunked = chunk(Array.from(alunoMensalidade), 200);
    for (const group of alunosChunked) {
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
        .in("aluno_id", group);

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
        .in("aluno_id", group);
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

  return activeMatriculasCount;
}

async function notificarRascunhosESucesso(params: {
  supabase: SupabaseAdmin;
  escolaId: string;
  importId: string;
  result: ImportResult;
  activeMatriculas: number;
}) {
  const { supabase, escolaId, importId, result, activeMatriculas } = params;

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
}
