import { NextResponse } from "next/server";
import type { FormacaoSupabaseClient } from "@/lib/db-types";
import { requireFormacaoRoles } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

const allowedRoles = ["formacao_admin", "formacao_secretaria", "super_admin", "global_admin"];

type CohortInfo = {
  id: string;
  nome: string | null;
  curso_nome: string | null;
  data_inicio: string | null;
};

type StagingRow = {
  id: string;
  cohort_id: string;
  nome_completo: string;
  bi_passaporte: string;
  email: string | null;
  telefone: string | null;
  comprovativo_url: string | null;
  status: "PENDENTE" | "APROVADA" | "REJEITADA";
  created_at: string;
  cohort?: CohortInfo | null;
};

type InscricaoRow = {
  id: string;
  cohort_id: string;
  nome_snapshot: string | null;
  email_snapshot: string | null;
  telefone_snapshot: string | null;
  estado: string;
  status_pagamento: string;
  created_at: string;
  updated_at: string;
  cohort?: CohortInfo | null;
};

type NotificacaoRow = {
  id: string;
  titulo: string;
  corpo: string | null;
  prioridade: "info" | "aviso" | "urgente";
  action_label: string | null;
  action_url: string | null;
  lida: boolean;
  created_at: string;
};

function hoursSince(value: string | null | undefined) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, (Date.now() - timestamp) / (1000 * 60 * 60));
}

function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return (timestamp - Date.now()) / (1000 * 60 * 60 * 24);
}

function priorityFor(row: StagingRow, valor: number) {
  const ageHours = hoursSince(row.created_at);
  const daysToStart = daysUntil(row.cohort?.data_inicio);
  const reasons: string[] = [];
  let score = 0;

  if (daysToStart !== null) {
    if (daysToStart <= 3) {
      score += 55;
      reasons.push("Turma inicia em até 3 dias");
    } else if (daysToStart <= 7) {
      score += 35;
      reasons.push("Turma inicia em até 7 dias");
    } else if (daysToStart <= 14) {
      score += 20;
      reasons.push("Turma inicia em até 14 dias");
    }
  }

  if (valor >= 500000) {
    score += 30;
    reasons.push("Valor elevado");
  } else if (valor >= 200000) {
    score += 20;
    reasons.push("Valor relevante");
  } else if (valor > 0) {
    score += 10;
    reasons.push("Valor informado");
  }

  if (ageHours >= 72) {
    score += 25;
    reasons.push("Pendente há mais de 72h");
  } else if (ageHours >= 24) {
    score += 15;
    reasons.push("Pendente há mais de 24h");
  } else if (ageHours >= 8) {
    score += 8;
    reasons.push("Pendente há mais de 8h");
  }

  const level = score >= 70 ? "alta" : score >= 35 ? "media" : "baixa";
  let recommendation = "Validar comprovativo";
  let recommendationReason = "Dados mínimos presentes para triagem.";

  if (!row.comprovativo_url) {
    recommendation = "Pedir comprovativo";
    recommendationReason = "A inscrição não tem talão anexado.";
  } else if (!row.email && !row.telefone) {
    recommendation = "Pedir contacto";
    recommendationReason = "Falta email e telefone para comunicação operacional.";
  } else if (daysToStart !== null && daysToStart <= 3) {
    recommendation = "Aprovar hoje";
    recommendationReason = "A turma está próxima do início.";
  } else if (ageHours >= 24) {
    recommendation = "Priorizar validação";
    recommendationReason = "A pendência já ultrapassou 24h.";
  }

  return {
    priority_score: score,
    priority_level: level,
    priority_reasons: reasons,
    operational_recommendation: recommendation,
    operational_recommendation_reason: recommendationReason,
  };
}

export async function GET() {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as FormacaoSupabaseClient;

  const [stagingRes, inscricoesRes, notificacoesRes] = await Promise.all([
    s
      .from("formacao_inscricoes_staging")
      .select(
        `
        id,
        cohort_id,
        nome_completo,
        bi_passaporte,
        email,
        telefone,
        comprovativo_url,
        status,
        created_at,
        cohort:formacao_cohorts (
          id,
          nome,
          curso_nome,
          data_inicio
        )
      `
      )
      .eq("escola_id", auth.escolaId)
      .eq("status", "PENDENTE")
      .order("created_at", { ascending: false })
      .limit(100),
    s
      .from("formacao_inscricoes")
      .select(
        `
        id,
        cohort_id,
        nome_snapshot,
        email_snapshot,
        telefone_snapshot,
        estado,
        status_pagamento,
        created_at,
        updated_at,
        cohort:formacao_cohorts (
          id,
          nome,
          curso_nome,
          data_inicio
        )
      `
      )
      .eq("escola_id", auth.escolaId)
      .in("estado", ["pre_inscrito", "inscrito"])
      .order("updated_at", { ascending: false })
      .limit(80),
    s
      .from("notificacoes")
      .select("id, titulo, corpo, prioridade, action_label, action_url, lida, created_at")
      .eq("escola_id", auth.escolaId)
      .eq("lida", false)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (stagingRes.error) return NextResponse.json({ ok: false, error: stagingRes.error.message }, { status: 400 });
  if (inscricoesRes.error) return NextResponse.json({ ok: false, error: inscricoesRes.error.message }, { status: 400 });
  if (notificacoesRes.error) return NextResponse.json({ ok: false, error: notificacoesRes.error.message }, { status: 400 });

  const stagingRows = (stagingRes.data ?? []) as unknown as StagingRow[];
  const cohortIds = Array.from(new Set(stagingRows.map((row) => row.cohort_id).filter(Boolean)));
  const financeiroByCohort = new Map<string, { valor_referencia: number; moeda: string }>();

  if (cohortIds.length > 0) {
    const { data: financeiros, error: financeiroError } = await s
      .from("formacao_cohort_financeiro")
      .select("cohort_id, valor_referencia, moeda")
      .eq("escola_id", auth.escolaId)
      .in("cohort_id", cohortIds);

    if (financeiroError) {
      return NextResponse.json({ ok: false, error: financeiroError.message }, { status: 400 });
    }

    for (const row of financeiros ?? []) {
      const typed = row as { cohort_id: string; valor_referencia: number | null; moeda: string | null };
      financeiroByCohort.set(typed.cohort_id, {
        valor_referencia: Number(typed.valor_referencia ?? 0),
        moeda: typed.moeda ?? "AOA",
      });
    }
  }

  const pagamentos = stagingRows
    .map((row) => {
      const financeiro = financeiroByCohort.get(row.cohort_id) ?? { valor_referencia: 0, moeda: "AOA" };
      return {
        id: row.id,
        nome: row.nome_completo,
        bi: row.bi_passaporte,
        email: row.email,
        telefone: row.telefone,
        comprovativo_url: row.comprovativo_url,
        status: row.status,
        created_at: row.created_at,
        cohort_id: row.cohort_id,
        cohort_nome: row.cohort?.nome ?? "Turma",
        curso_nome: row.cohort?.curso_nome ?? "Curso",
        data_inicio: row.cohort?.data_inicio ?? null,
        valor_referencia: financeiro.valor_referencia,
        moeda: financeiro.moeda,
        ...priorityFor(row, financeiro.valor_referencia),
      };
    })
    .sort((a, b) => {
      const scoreDiff = b.priority_score - a.priority_score;
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

  const acessos = ((inscricoesRes.data ?? []) as unknown as InscricaoRow[])
    .filter((row) => row.email_snapshot)
    .map((row) => ({
      id: row.id,
      nome: row.nome_snapshot ?? "Formando(a)",
      email: row.email_snapshot,
      telefone: row.telefone_snapshot,
      estado: row.estado,
      status_pagamento: row.status_pagamento,
      created_at: row.created_at,
      updated_at: row.updated_at,
      cohort_id: row.cohort_id,
      cohort_nome: row.cohort?.nome ?? "Turma",
      curso_nome: row.cohort?.curso_nome ?? "Curso",
    }));

  const notificacoes = ((notificacoesRes.data ?? []) as unknown as NotificacaoRow[]).map((row) => ({
    id: row.id,
    titulo: row.titulo,
    corpo: row.corpo,
    prioridade: row.prioridade,
    action_label: row.action_label,
    action_url: row.action_url,
    created_at: row.created_at,
  }));

  return NextResponse.json({
    ok: true,
    pagamentos,
    acessos,
    notificacoes,
    summary: {
      pagamentos_pendentes: pagamentos.length,
      prioridade_alta: pagamentos.filter((item) => item.priority_level === "alta").length,
      acessos_recentes: acessos.length,
      notificacoes_abertas: notificacoes.length,
    },
  });
}
