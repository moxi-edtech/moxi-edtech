import { NextResponse } from "next/server";

import { requireSuperAdminRoute } from "@/lib/auth/requireSuperAdminRoute";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MarketingLeadRow = {
  id: string;
  escola: string | null;
  nome: string | null;
  afiliado_codigo: string | null;
  status: string | null;
  crm_lead_id: string | null;
  created_at: string;
};

type CrmLeadRow = {
  id: string;
  afiliado_codigo: string;
  nome_escola: string;
  nome_contacto: string | null;
  etapa: string;
  plano_estimado: string | null;
  onboarding_request_id: string | null;
  created_at: string;
  updated_at: string | null;
  converted_at: string | null;
};

type OnboardingRow = {
  id: string;
  crm_lead_id: string | null;
  escola_id: string | null;
  escola_nome: string;
  status: string;
  tracking_token: string;
  implantation_status: string | null;
  crm_risk_level: "baixo" | "medio" | "alto";
  crm_risk_score: number;
  created_at: string;
  updated_at: string | null;
  financeiro: Record<string, unknown> | null;
};

type SchoolRow = {
  id: string;
  nome: string | null;
  plano_atual: string | null;
  status: string | null;
  created_at: string | null;
};

type SubscriptionRow = {
  id: string;
  escola_id: string;
  plano: string | null;
  status: "pendente" | "activa" | "suspensa" | "cancelada" | null;
  valor_kz: number | null;
  data_inicio: string | null;
  data_renovacao: string | null;
  created_at: string | null;
};

type CommissionRow = {
  id: string;
  afiliado_codigo: string;
  escola_id: string;
  onboarding_request_id: string | null;
  crm_lead_id: string | null;
  assinatura_id: string | null;
  tipo: "ativacao" | "recorrente";
  status: "pending" | "approved" | "blocked" | "paid" | "cancelled";
  valor_kz: number | null;
  created_at: string;
};

type AffiliateRow = {
  id: string;
  codigo: string;
  nome: string | null;
  ativo: boolean | null;
};

type FunnelStage = {
  id: string;
  label: string;
  count: number;
  hint: string;
};

type Bottleneck = {
  id: string;
  label: string;
  count: number;
  severity: "high" | "medium" | "low";
  action: string;
};

type PipelineRow = {
  id: string;
  affiliate_code: string | null;
  affiliate_name: string | null;
  school_name: string;
  current_stage: string;
  current_stage_label: string;
  lead_stage: string | null;
  onboarding_status: string | null;
  subscription_status: string | null;
  activation_commission_status: string | null;
  recurring_commission_status: string | null;
  risk_level: "baixo" | "medio" | "alto" | null;
  latest_activity_at: string;
  action_href: string;
};

type AffiliateRollup = {
  affiliate_code: string;
  affiliate_name: string;
  marketing_leads: number;
  crm_leads: number;
  won_leads: number;
  onboardings: number;
  active_subscriptions: number;
  pending_commissions: number;
  paid_commissions: number;
};

type CrmMetric = {
  escola_id: string;
  escola_nome: string;
  activation_score: number;
  engagement_score: number;
  payment_risk: number;
  support_pressure: number;
  expansion_signal: number;
  churn_risk: number;
  plano: string | null;
  action_href: string;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function numeric(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function daysSince(value: string | null | undefined) {
  if (!value) return 365;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 365;
  return Math.max(0, (Date.now() - date.getTime()) / 86_400_000);
}

function normalize(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function latestDate(...values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? new Date(0).toISOString();
}

function stageLabel(stage: string) {
  switch (stage) {
    case "marketing":
      return "Lead de marketing";
    case "crm_prospeccao":
      return "CRM · Prospecção";
    case "crm_contacto":
      return "CRM · Contacto";
    case "crm_apresentacao":
      return "CRM · Apresentação";
    case "crm_negociacao":
      return "CRM · Negociação";
    case "crm_ganho":
      return "CRM · Fechado ganho";
    case "crm_perdido":
      return "CRM · Perdido";
    case "onboarding_pendente":
      return "Onboarding · Pendente";
    case "onboarding_em_configuracao":
      return "Onboarding · Em configuração";
    case "onboarding_activo":
      return "Onboarding · Activo";
    case "assinatura_pendente":
      return "Assinatura · Pendente";
    case "assinatura_activa":
      return "Assinatura · Activa";
    case "assinatura_suspensa":
      return "Assinatura · Suspensa";
    case "comissao_ativacao":
      return "Faturamento de activação";
    case "comissao_recorrente":
      return "Faturamento recorrente";
    case "comissao_paga":
      return "Faturamento pago";
    default:
      return stage;
  }
}

function currentStageForPipeline(args: {
  crmLead: CrmLeadRow | null;
  onboarding: OnboardingRow | null;
  subscription: SubscriptionRow | null;
  activationCommission: CommissionRow | null;
  recurringCommission: CommissionRow | null;
}) {
  const { crmLead, onboarding, subscription, activationCommission, recurringCommission } = args;

  if (recurringCommission?.status === "paid" || activationCommission?.status === "paid") return "comissao_paga";
  if (recurringCommission) return "comissao_recorrente";
  if (activationCommission) return "comissao_ativacao";
  if (subscription?.status === "suspensa") return "assinatura_suspensa";
  if (subscription?.status === "activa") return "assinatura_activa";
  if (subscription?.status === "pendente") return "assinatura_pendente";
  if (onboarding?.status === "activo") return "onboarding_activo";
  if (onboarding?.status === "em_configuracao") return "onboarding_em_configuracao";
  if (onboarding?.status === "pendente") return "onboarding_pendente";
  if (crmLead?.etapa) return `crm_${crmLead.etapa}`;
  return "marketing";
}

export async function GET() {
  const auth = await requireSuperAdminRoute();
  if (!auth.ok) return auth.response;

  try {
    const supabase = auth.supabase;

    const [
      marketingRes,
      crmRes,
      onboardingRes,
      schoolRes,
      subscriptionRes,
      commissionRes,
      affiliateRes,
      healthRes,
      paymentRes,
    ] = await Promise.all([
      supabase.from("marketing_leads").select("id,escola,nome,afiliado_codigo,status,crm_lead_id,created_at").order("created_at", { ascending: false }).limit(1000),
      (supabase as any).from("crm_leads").select("id,afiliado_codigo,nome_escola,nome_contacto,etapa,plano_estimado,onboarding_request_id,created_at,updated_at,converted_at").order("created_at", { ascending: false }).limit(1000),
      (supabase as any).from("onboarding_requests").select("id,crm_lead_id,escola_id,escola_nome,status,tracking_token,implantation_status,crm_risk_level,crm_risk_score,created_at,updated_at,financeiro").order("created_at", { ascending: false }).limit(1000),
      supabase.from("escolas").select("id,nome,plano_atual,status,created_at").limit(1000),
      supabase.from("assinaturas").select("id,escola_id,plano,status,valor_kz,data_inicio,data_renovacao,created_at").limit(1000),
      (supabase as any).from("partner_commissions").select("id,afiliado_codigo,escola_id,onboarding_request_id,crm_lead_id,assinatura_id,tipo,status,valor_kz,created_at").order("created_at", { ascending: false }).limit(1000),
      supabase.from("afiliados").select("id,codigo,nome,ativo").eq("ativo", true).limit(500),
      supabase.rpc("admin_get_escola_health_metrics"),
      supabase.from("vw_pagamentos_status").select("escola_id,status,total").limit(2000),
    ]);

    const firstError =
      marketingRes.error ||
      crmRes.error ||
      onboardingRes.error ||
      schoolRes.error ||
      subscriptionRes.error ||
      commissionRes.error ||
      affiliateRes.error ||
      healthRes.error ||
      paymentRes.error;

    if (firstError) {
      return NextResponse.json(
        {
          ok: false,
          error: firstError.message,
          next_step: "Revise a consulta das fontes do funil em /api/super-admin/crm/overview.",
        },
        { status: 500 },
      );
    }

    const marketingLeads = ((marketingRes.data as MarketingLeadRow[] | null) ?? []);
    const crmLeads = ((crmRes.data as CrmLeadRow[] | null) ?? []);
    const onboardings = ((onboardingRes.data as OnboardingRow[] | null) ?? []).map((row) => ({
      ...row,
      crm_risk_score: numeric(row.crm_risk_score),
    }));
    const schools = ((schoolRes.data as SchoolRow[] | null) ?? []);
    const subscriptions = ((subscriptionRes.data as SubscriptionRow[] | null) ?? []).map((row) => ({
      ...row,
      valor_kz: numeric(row.valor_kz),
    }));
    const commissions = ((commissionRes.data as CommissionRow[] | null) ?? []).map((row) => ({
      ...row,
      valor_kz: numeric(row.valor_kz),
    }));
    const affiliates = ((affiliateRes.data as AffiliateRow[] | null) ?? []);

    const schoolMap = new Map(schools.map((row) => [row.id, row]));
    const affiliateMap = new Map(affiliates.map((row) => [row.codigo, row]));
    const crmById = new Map(crmLeads.map((row) => [row.id, row]));
    const onboardingByCrmLeadId = new Map(
      onboardings.filter((row) => row.crm_lead_id).map((row) => [row.crm_lead_id as string, row]),
    );
    const subscriptionsBySchoolId = subscriptions.reduce((acc, item) => {
      const list = acc.get(item.escola_id) ?? [];
      list.push(item);
      acc.set(item.escola_id, list);
      return acc;
    }, new Map<string, SubscriptionRow[]>());
    const commissionsByOnboardingId = commissions.reduce((acc, item) => {
      if (!item.onboarding_request_id) return acc;
      const list = acc.get(item.onboarding_request_id) ?? [];
      list.push(item);
      acc.set(item.onboarding_request_id, list);
      return acc;
    }, new Map<string, CommissionRow[]>());
    const commissionsByCrmLeadId = commissions.reduce((acc, item) => {
      if (!item.crm_lead_id) return acc;
      const list = acc.get(item.crm_lead_id) ?? [];
      list.push(item);
      acc.set(item.crm_lead_id, list);
      return acc;
    }, new Map<string, CommissionRow[]>());

    const crmMatchByAffiliateAndSchool = new Map<string, CrmLeadRow>();
    for (const lead of crmLeads) {
      const key = `${lead.afiliado_codigo}::${normalize(lead.nome_escola)}`;
      if (!crmMatchByAffiliateAndSchool.has(key)) crmMatchByAffiliateAndSchool.set(key, lead);
    }

    const marketingOrphans: MarketingLeadRow[] = [];
    for (const lead of marketingLeads) {
      if (lead.crm_lead_id) {
        continue;
      }
      const affiliateCode = (lead.afiliado_codigo || "").trim().toUpperCase();
      const key = `${affiliateCode}::${normalize(lead.escola)}`;
      const matched = affiliateCode ? crmMatchByAffiliateAndSchool.get(key) : null;
      if (!matched) {
        marketingOrphans.push(lead);
      }
    }

    const crmOpen = crmLeads.filter((item) => !["ganho", "perdido"].includes(item.etapa));
    const crmWon = crmLeads.filter((item) => item.etapa === "ganho");
    const crmLost = crmLeads.filter((item) => item.etapa === "perdido");
    const onboardingActive = onboardings.filter((item) => item.status === "activo");
    const onboardingRiskHigh = onboardings.filter((item) => item.crm_risk_level === "alto");
    const activeSubscriptions = subscriptions.filter((item) => item.status === "activa");
    const pendingSubscriptions = subscriptions.filter((item) => item.status === "pendente");
    const suspendedSubscriptions = subscriptions.filter((item) => item.status === "suspensa");
    const pendingCommissions = commissions.filter((item) => item.status === "pending");
    const paidCommissions = commissions.filter((item) => item.status === "paid");
    const activationPending = commissions.filter((item) => item.tipo === "ativacao" && ["pending", "approved", "blocked"].includes(item.status));
    const recurringPending = commissions.filter((item) => item.tipo === "recorrente" && ["pending", "approved", "blocked"].includes(item.status));

    const marketingLast7d = marketingLeads.filter((item) => daysSince(item.created_at) <= 7).length;

    const funnelSummary = {
      marketing_total: marketingLeads.length,
      marketing_last_7d: marketingLast7d,
      crm_total: crmLeads.length,
      crm_open: crmOpen.length,
      crm_won: crmWon.length,
      crm_lost: crmLost.length,
      onboarding_total: onboardings.length,
      onboarding_active: onboardingActive.length,
      onboarding_risk_high: onboardingRiskHigh.length,
      subscriptions_total: subscriptions.length,
      subscriptions_active: activeSubscriptions.length,
      subscriptions_pending: pendingSubscriptions.length,
      subscriptions_suspended: suspendedSubscriptions.length,
      commissions_total: commissions.length,
      commissions_pending: pendingCommissions.length,
      commissions_paid: paidCommissions.length,
      commissions_pending_kz: pendingCommissions.reduce((acc, item) => acc + numeric(item.valor_kz), 0),
      commissions_paid_kz: paidCommissions.reduce((acc, item) => acc + numeric(item.valor_kz), 0),
      crm_to_onboarding_rate: clamp((onboardings.length / Math.max(crmWon.length, 1)) * 100),
      onboarding_to_subscription_rate: clamp((subscriptions.length / Math.max(onboardings.length, 1)) * 100),
      subscription_to_paid_commission_rate: clamp((paidCommissions.length / Math.max(subscriptions.length, 1)) * 100),
    };

    const funnelStages: FunnelStage[] = [
      {
        id: "marketing",
        label: "Marketing",
        count: marketingLeads.length,
        hint: `${marketingLast7d} novos nos últimos 7 dias`,
      },
      {
        id: "crm",
        label: "CRM comercial",
        count: crmLeads.length,
        hint: `${crmOpen.length} abertos · ${crmWon.length} ganhos`,
      },
      {
        id: "onboarding",
        label: "Onboarding",
        count: onboardings.length,
        hint: `${onboardingActive.length} activos · ${onboardingRiskHigh.length} risco alto`,
      },
      {
        id: "subscriptions",
        label: "Assinaturas",
        count: subscriptions.length,
        hint: `${activeSubscriptions.length} activas · ${suspendedSubscriptions.length} suspensas`,
      },
      {
        id: "commissions",
        label: "Faturamentos",
        count: commissions.length,
        hint: `${pendingCommissions.length} pendentes · ${paidCommissions.length} pagas`,
      },
    ];

    const bottlenecks: Bottleneck[] = [
      {
        id: "marketing_orphans",
        label: "Leads de marketing ainda sem entrada no CRM",
        count: marketingOrphans.length,
        severity: (marketingOrphans.length > 10 ? "high" : marketingOrphans.length > 4 ? "medium" : "low") as Bottleneck["severity"],
        action: "Fechar a passagem landing → CRM com dono comercial explícito.",
      },
      {
        id: "crm_negociacao",
        label: "Leads parados em negociação",
        count: crmLeads.filter((item) => item.etapa === "negociacao" && !item.onboarding_request_id).length,
        severity: (crmLeads.filter((item) => item.etapa === "negociacao" && !item.onboarding_request_id).length > 8 ? "high" : "medium") as Bottleneck["severity"],
        action: "Revisar propostas, aceite e próximos passos comerciais.",
      },
      {
        id: "onboarding_pending",
        label: "Onboardings não activados",
        count: onboardings.filter((item) => item.status !== "activo").length,
        severity: (onboardings.filter((item) => item.status !== "activo").length > 12 ? "high" : "medium") as Bottleneck["severity"],
        action: "Priorizar pendente/em_configuração com risco alto e sem aceite validado.",
      },
      {
        id: "subscription_suspended",
        label: "Assinaturas suspensas",
        count: suspendedSubscriptions.length,
        severity: (suspendedSubscriptions.length > 0 ? "high" : "low") as Bottleneck["severity"],
        action: "Cruzar suspensão com cobrança e carteira do parceiro.",
      },
      {
        id: "activation_pending",
        label: "Faturamento de activação pendente de liquidação",
        count: activationPending.length,
        severity: (activationPending.length > 5 ? "medium" : "low") as Bottleneck["severity"],
        action: "Validar aceite, aprovação e payout das activações concluídas.",
      },
      {
        id: "recurring_pending",
        label: "Faturamento recorrente em aberto",
        count: recurringPending.length,
        severity: (recurringPending.length > 10 ? "medium" : "low") as Bottleneck["severity"],
        action: "Confirmar pagamentos SaaS e fila financeira de aprovação.",
      },
    ].sort((a, b) => b.count - a.count);

    const pipelineRows: PipelineRow[] = [];

    for (const onboarding of onboardings) {
      const crmLead = onboarding.crm_lead_id ? crmById.get(onboarding.crm_lead_id) ?? null : null;
      const school = onboarding.escola_id ? schoolMap.get(onboarding.escola_id) ?? null : null;
      const subscription = onboarding.escola_id ? (subscriptionsBySchoolId.get(onboarding.escola_id) ?? [])[0] ?? null : null;
      const relatedCommissions = commissionsByOnboardingId.get(onboarding.id) ?? (crmLead ? commissionsByCrmLeadId.get(crmLead.id) ?? [] : []);
      const activationCommission = relatedCommissions.find((item) => item.tipo === "ativacao") ?? null;
      const recurringCommission = relatedCommissions.find((item) => item.tipo === "recorrente") ?? null;
      const currentStage = currentStageForPipeline({ crmLead, onboarding, subscription, activationCommission, recurringCommission });
      const affiliateCode = (crmLead?.afiliado_codigo || String(onboarding.financeiro?.influencer_codigo || "")).trim().toUpperCase() || null;
      const affiliate = affiliateCode ? affiliateMap.get(affiliateCode) ?? null : null;

      pipelineRows.push({
        id: onboarding.id,
        affiliate_code: affiliateCode,
        affiliate_name: affiliate?.nome ?? affiliateCode,
        school_name: school?.nome ?? onboarding.escola_nome,
        current_stage: currentStage,
        current_stage_label: stageLabel(currentStage),
        lead_stage: crmLead?.etapa ?? null,
        onboarding_status: onboarding.status,
        subscription_status: subscription?.status ?? null,
        activation_commission_status: activationCommission?.status ?? null,
        recurring_commission_status: recurringCommission?.status ?? null,
        risk_level: onboarding.crm_risk_level ?? null,
        latest_activity_at: latestDate(
          recurringCommission?.created_at,
          activationCommission?.created_at,
          subscription?.created_at,
          onboarding.updated_at,
          onboarding.created_at,
          crmLead?.updated_at,
        ),
        action_href: onboarding.escola_id ? `/super-admin/escolas/${onboarding.escola_id}` : "/super-admin/onboarding",
      });
    }

    for (const crmLead of crmLeads.filter((item) => !item.onboarding_request_id)) {
      const currentStage = currentStageForPipeline({
        crmLead,
        onboarding: onboardingByCrmLeadId.get(crmLead.id) ?? null,
        subscription: null,
        activationCommission: null,
        recurringCommission: null,
      });
      const affiliate = affiliateMap.get(crmLead.afiliado_codigo) ?? null;
      pipelineRows.push({
        id: crmLead.id,
        affiliate_code: crmLead.afiliado_codigo,
        affiliate_name: affiliate?.nome ?? crmLead.afiliado_codigo,
        school_name: crmLead.nome_escola,
        current_stage: currentStage,
        current_stage_label: stageLabel(currentStage),
        lead_stage: crmLead.etapa,
        onboarding_status: null,
        subscription_status: null,
        activation_commission_status: null,
        recurring_commission_status: null,
        risk_level: null,
        latest_activity_at: latestDate(crmLead.updated_at, crmLead.created_at),
        action_href: "/super-admin/parceiros",
      });
    }

    for (const marketingLead of marketingOrphans) {
      const affiliateCode = (marketingLead.afiliado_codigo || "").trim().toUpperCase() || null;
      const affiliate = affiliateCode ? affiliateMap.get(affiliateCode) ?? null : null;
      pipelineRows.push({
        id: marketingLead.id,
        affiliate_code: affiliateCode,
        affiliate_name: affiliate?.nome ?? affiliateCode,
        school_name: marketingLead.escola ?? "Lead sem escola",
        current_stage: "marketing",
        current_stage_label: stageLabel("marketing"),
        lead_stage: null,
        onboarding_status: null,
        subscription_status: null,
        activation_commission_status: null,
        recurring_commission_status: null,
        risk_level: null,
        latest_activity_at: marketingLead.created_at,
        action_href: "/super-admin/marketing",
      });
    }

    const recentPipeline = pipelineRows
      .sort((a, b) => new Date(b.latest_activity_at).getTime() - new Date(a.latest_activity_at).getTime())
      .slice(0, 12);

    const affiliateRollupMap = new Map<string, AffiliateRollup>();
    const ensureAffiliate = (code: string | null | undefined) => {
      const normalized = (code || "").trim().toUpperCase();
      if (!normalized) return null;
      if (!affiliateRollupMap.has(normalized)) {
        affiliateRollupMap.set(normalized, {
          affiliate_code: normalized,
          affiliate_name: affiliateMap.get(normalized)?.nome ?? normalized,
          marketing_leads: 0,
          crm_leads: 0,
          won_leads: 0,
          onboardings: 0,
          active_subscriptions: 0,
          pending_commissions: 0,
          paid_commissions: 0,
        });
      }
      return affiliateRollupMap.get(normalized)!;
    };

    for (const lead of marketingLeads) {
      const entry = ensureAffiliate(lead.afiliado_codigo);
      if (entry) entry.marketing_leads += 1;
    }
    for (const lead of crmLeads) {
      const entry = ensureAffiliate(lead.afiliado_codigo);
      if (!entry) continue;
      entry.crm_leads += 1;
      if (lead.etapa === "ganho") entry.won_leads += 1;
    }
    for (const onboarding of onboardings) {
      const code = String(onboarding.financeiro?.influencer_codigo || crmById.get(onboarding.crm_lead_id || "")?.afiliado_codigo || "").trim().toUpperCase();
      const entry = ensureAffiliate(code);
      if (!entry) continue;
      entry.onboardings += 1;
      if (onboarding.escola_id) {
        const subscription = (subscriptionsBySchoolId.get(onboarding.escola_id) ?? []).find((item) => item.status === "activa");
        if (subscription) entry.active_subscriptions += 1;
      }
    }
    for (const commission of commissions) {
      const entry = ensureAffiliate(commission.afiliado_codigo);
      if (!entry) continue;
      if (commission.status === "paid") entry.paid_commissions += 1;
      if (["pending", "approved", "blocked"].includes(commission.status)) entry.pending_commissions += 1;
    }

    const affiliateRollup = Array.from(affiliateRollupMap.values())
      .sort((a, b) =>
        (b.active_subscriptions + b.pending_commissions + b.won_leads) -
        (a.active_subscriptions + a.pending_commissions + a.won_leads),
      )
      .slice(0, 8);

    const healthRows = (healthRes.data as Array<Record<string, unknown>> | null) ?? [];
    const paymentRows = (paymentRes.data as Array<Record<string, unknown>> | null) ?? [];
    const paymentMap = new Map<string, { total: number; risk: number }>();

    for (const row of paymentRows) {
      const escolaId = String(row.escola_id ?? "");
      if (!escolaId) continue;
      const entry = paymentMap.get(escolaId) ?? { total: 0, risk: 0 };
      const total = numeric(row.total);
      const status = String(row.status ?? "").toLowerCase();
      entry.total += total;
      if (status.includes("inad") || status.includes("pend") || status.includes("atras")) {
        entry.risk += total;
      }
      paymentMap.set(escolaId, entry);
    }

    const lifecycleRows: CrmMetric[] = healthRows.map((metric) => {
      const escolaId = String(metric.escola_id ?? metric.id ?? "");
      const school = schoolMap.get(escolaId) ?? null;
      const payment = paymentMap.get(escolaId) ?? { total: 0, risk: 0 };
      const onboardingProgress = numeric(metric.progresso_onboarding ?? metric.onboarding_progress ?? 0);
      const onboardingDone = Boolean(metric.onboarding_finalizado ?? metric.onboarding_done ?? onboardingProgress >= 100);
      const alunosAtivos = numeric(metric.total_alunos ?? metric.alunos_ativos ?? metric.students ?? 0);
      const supportTickets = numeric(metric.support_tickets ?? metric.chamados_abertos ?? 0);
      const daysFromAccess = daysSince(String(metric.ultimo_acesso ?? metric.last_access ?? "") || null);

      const activationScore = clamp(onboardingDone ? 100 : onboardingProgress * 0.85 + (alunosAtivos > 0 ? 15 : 0));
      const engagementScore = clamp(100 - daysFromAccess * 4 + Math.min(alunosAtivos / 8, 20));
      const paymentRisk = clamp(payment.total > 0 ? (payment.risk / payment.total) * 100 : 0);
      const supportPressure = clamp(supportTickets * 15 + (daysFromAccess > 5 ? 20 : 0));
      const expansionSignal = clamp((activationScore * 0.35) + (engagementScore * 0.4) + ((100 - paymentRisk) * 0.25));
      const churnRisk = clamp(((100 - activationScore) * 0.25) + ((100 - engagementScore) * 0.35) + (paymentRisk * 0.3) + (supportPressure * 0.1));

      return {
        escola_id: escolaId,
        escola_nome: String(metric.escola_nome ?? school?.nome ?? "Escola sem nome"),
        activation_score: activationScore,
        engagement_score: engagementScore,
        payment_risk: paymentRisk,
        support_pressure: supportPressure,
        expansion_signal: expansionSignal,
        churn_risk: churnRisk,
        plano: school?.plano_atual ?? null,
        action_href: `/super-admin/escolas/${escolaId}`,
      };
    });

    const topChurn = [...lifecycleRows].sort((a, b) => b.churn_risk - a.churn_risk).slice(0, 10);
    const readyForUpgrade = lifecycleRows
      .filter((row) => row.expansion_signal >= 70 && row.payment_risk <= 35 && row.plano !== "premium")
      .sort((a, b) => b.expansion_signal - a.expansion_signal)
      .slice(0, 10);

    return NextResponse.json(
      {
        ok: true,
        summary: {
          avg_activation_score: clamp(lifecycleRows.reduce((acc, row) => acc + row.activation_score, 0) / Math.max(lifecycleRows.length, 1)),
          avg_engagement_score: clamp(lifecycleRows.reduce((acc, row) => acc + row.engagement_score, 0) / Math.max(lifecycleRows.length, 1)),
          avg_payment_risk: clamp(lifecycleRows.reduce((acc, row) => acc + row.payment_risk, 0) / Math.max(lifecycleRows.length, 1)),
          avg_support_pressure: clamp(lifecycleRows.reduce((acc, row) => acc + row.support_pressure, 0) / Math.max(lifecycleRows.length, 1)),
          avg_expansion_signal: clamp(lifecycleRows.reduce((acc, row) => acc + row.expansion_signal, 0) / Math.max(lifecycleRows.length, 1)),
          schools_count: lifecycleRows.length,
        },
        funnel_summary: funnelSummary,
        funnel_stages: funnelStages,
        bottlenecks,
        recent_pipeline: recentPipeline,
        affiliate_rollup: affiliateRollup,
        top_churn_risk: topChurn,
        ready_for_upgrade: readyForUpgrade,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Erro interno.",
        next_step: "Verifique logs da API /api/super-admin/crm/overview e as fontes do funil.",
      },
      { status: 500 },
    );
  }
}
