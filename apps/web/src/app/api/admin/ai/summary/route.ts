import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createAiAction } from "@/lib/server/ai/ai-actions";
import { updateAiUsageLog, validateAiAccess } from "@/lib/server/ai/ai-guards";
import { callAiWithFallback, getAiProviderConfig } from "@/lib/server/ai/provider-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { DBWithRPC } from "@/types/supabase-augment";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const summarySchema = z.object({
  schoolId: z.string().uuid(),
  period: z.enum(["today", "week", "month"]).optional().default("today"),
});

type SummarySnapshot = {
  escola: {
    nome: string | null;
    plano_atual: string | null;
    status: string | null;
  } | null;
  secretaria: {
    counts: unknown;
    kpis: unknown;
  };
  financeiro: {
    pagamentosStatus: unknown[];
    radarRisco: unknown[];
  };
};

function buildPrompt(snapshot: SummarySnapshot, period: string) {
  return [
    "És o KLASSE AI, assistente administrativo para escolas em Angola.",
    "Gera um resumo operacional curto, objetivo e útil para a direção da escola.",
    "Usa apenas os dados fornecidos. Não inventes números, nomes, valores, datas ou riscos.",
    "Se um dado vier vazio, diz que não há dado suficiente para esse ponto.",
    "Estrutura a resposta em 4 blocos curtos: Visão geral, Secretaria, Financeiro, Próxima ação.",
    `Período solicitado: ${period}.`,
    "",
    "Dados reais:",
    JSON.stringify(snapshot),
  ].join("\n");
}

function localSummaryFallback(snapshot: SummarySnapshot) {
  const counts = snapshot.secretaria.counts as {
    alunos_ativos?: number | string | null;
    matriculas_total?: number | string | null;
    turmas_total?: number | string | null;
  } | null;
  const pagamentos = snapshot.financeiro.pagamentosStatus.length;
  const riscos = snapshot.financeiro.radarRisco.length;

  return [
    "Visão geral",
    `${snapshot.escola?.nome ?? "A escola"} tem ${counts?.alunos_ativos ?? "dados não disponíveis"} alunos ativos, ${counts?.matriculas_total ?? "dados não disponíveis"} matrículas e ${counts?.turmas_total ?? "dados não disponíveis"} turmas registadas.`,
    "",
    "Secretaria",
    "Os indicadores administrativos foram carregados a partir das views operacionais disponíveis.",
    "",
    "Financeiro",
    `Foram encontrados ${pagamentos} estados de pagamento e ${riscos} itens recentes no radar de inadimplência.`,
    "",
    "Próxima ação",
    "Rever os itens financeiros em risco e confirmar pendências administrativas antes do fecho do dia.",
  ].join("\n");
}

async function generateSummary(prompt: string, snapshot: SummarySnapshot, period: string) {
  const { provider, apiKey, model } = getAiProviderConfig();
  const maxTokens = Number.parseInt(process.env.AI_MAX_TOKENS ?? "2048", 10);

  if (!["gemini", "deepseek"].includes(provider) || !apiKey) {
    return {
      content: localSummaryFallback(snapshot),
      provider: provider || "local",
      model: ["gemini", "deepseek"].includes(provider) ? model : "local-summary",
      tokensInput: null,
      tokensOutput: null,
      fallback: true,
    };
  }

  const result = await callAiWithFallback({ prompt, temperature: 0.25, maxTokens });

  return {
    content: result.text,
    provider: result.provider,
    model: result.model,
    tokensInput: result.tokensInput,
    tokensOutput: result.tokensOutput,
    fallback: false,
  };
}

export async function POST(req: Request) {
  const parsed = summarySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 });
  }

  const { schoolId, period } = parsed.data;
  const supabase = await supabaseServerTyped<DBWithRPC>();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;
  if (!user) {
    return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  }

  const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
  const resolvedEscolaId = await resolveEscolaIdForUser(
    supabase,
    user.id,
    schoolId,
    metaEscolaId ? String(metaEscolaId) : null
  );
  if (!resolvedEscolaId || resolvedEscolaId !== schoolId) {
    return NextResponse.json({ ok: false, error: "Sem permissão para esta escola." }, { status: 403 });
  }

  const access = await validateAiAccess(schoolId, "summary", "admin_ai_summary");
  if (!access.ok || !access.userId) {
    return NextResponse.json({ ok: false, error: access.error ?? "Sem permissão para usar KLASSE AI." }, { status: 403 });
  }

  const [escolaRes, countsRes, kpisRes, pagamentosRes, radarRes] = await Promise.all([
    supabase
      .from("vw_escola_info")
      .select("nome, plano_atual, status")
      .eq("escola_id", schoolId)
      .maybeSingle(),
    supabase
      .from("vw_secretaria_dashboard_counts")
      .select("alunos_ativos, matriculas_total, turmas_total")
      .eq("escola_id", schoolId)
      .maybeSingle(),
    supabase
      .from("vw_secretaria_dashboard_kpis")
      .select("pendencias_importacao, resumo_status, novas_matriculas, avisos_recentes")
      .eq("escola_id", schoolId)
      .maybeSingle(),
    supabase
      .from("vw_pagamentos_status")
      .select("status, total")
      .eq("escola_id", schoolId)
      .limit(20),
    supabase
      .from("vw_radar_inadimplencia")
      .select("nome_aluno, nome_turma, valor_em_atraso, dias_em_atraso, status_risco")
      .eq("escola_id", schoolId)
      .order("dias_em_atraso", { ascending: false })
      .order("mensalidade_id", { ascending: false })
      .limit(10),
  ]);

  const queryError = escolaRes.error || countsRes.error || kpisRes.error || pagamentosRes.error || radarRes.error;
  if (queryError) {
    await updateAiUsageLog(access.usageLogId, {
      status: "error",
      inputPreview: `summary:${period}`,
      outputPreview: null,
      errorMessage: queryError.message,
    });
    return NextResponse.json({ ok: false, error: queryError.message }, { status: 500 });
  }

  const snapshot: SummarySnapshot = {
    escola: escolaRes.data ?? null,
    secretaria: {
      counts: countsRes.data ?? null,
      kpis: kpisRes.data ?? null,
    },
    financeiro: {
      pagamentosStatus: pagamentosRes.data ?? [],
      radarRisco: radarRes.data ?? [],
    },
  };
  const prompt = buildPrompt(snapshot, period);

  try {
    const result = await generateSummary(prompt, snapshot, period);
    await updateAiUsageLog(access.usageLogId, {
      status: "completed",
      inputPreview: `summary:${period}`,
      outputPreview: result.content,
      tokensInput: result.tokensInput,
      tokensOutput: result.tokensOutput,
      provider: result.provider,
      model: result.model,
    });

    const action = await createAiAction(supabase, {
      schoolId,
      createdBy: access.userId,
      actionType: "school_summary",
      sourceModule: "dashboard",
      title: "Resumo operacional da escola",
      summary: `Resumo IA do período ${period}.`,
      content: result.content,
      metadata: {
        period,
        provider: result.provider,
        model: result.model,
      },
      riskLevel: "low",
      status: "draft",
    });

    return NextResponse.json({ ok: true, content: result.content, actionId: action.id, fallback: result.fallback });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerar resumo.";
    await updateAiUsageLog(access.usageLogId, {
      status: "error",
      inputPreview: `summary:${period}`,
      outputPreview: null,
      errorMessage: message,
    });

    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
