"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRightLeft, BarChart3, Layers3, Shield, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

import QuickActionsSection from "@/components/super-admin/QuickActionsSection";
import { WidgetEmpty, WidgetError, WidgetSkeleton } from "@/components/super-admin/WidgetStates";

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

type CrmSummary = {
  avg_activation_score: number;
  avg_engagement_score: number;
  avg_payment_risk: number;
  avg_support_pressure: number;
  avg_expansion_signal: number;
  schools_count: number;
};

type FunnelSummary = {
  marketing_total: number;
  marketing_last_7d: number;
  crm_total: number;
  crm_open: number;
  crm_won: number;
  crm_lost: number;
  onboarding_total: number;
  onboarding_active: number;
  onboarding_risk_high: number;
  subscriptions_total: number;
  subscriptions_active: number;
  subscriptions_pending: number;
  subscriptions_suspended: number;
  commissions_total: number;
  commissions_pending: number;
  commissions_paid: number;
  commissions_pending_kz: number;
  commissions_paid_kz: number;
  crm_to_onboarding_rate: number;
  onboarding_to_subscription_rate: number;
  subscription_to_paid_commission_rate: number;
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

type CrmPayload = {
  ok: boolean;
  summary?: CrmSummary;
  funnel_summary?: FunnelSummary;
  funnel_stages?: FunnelStage[];
  bottlenecks?: Bottleneck[];
  recent_pipeline?: PipelineRow[];
  affiliate_rollup?: AffiliateRollup[];
  top_churn_risk?: CrmMetric[];
  ready_for_upgrade?: CrmMetric[];
  error?: string;
  next_step?: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
    maximumFractionDigits: 0,
  })
    .format(value || 0)
    .replace("AOA", "Kz");
}

function badgeTone(severity: Bottleneck["severity"]) {
  if (severity === "high") return "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-900/60";
  if (severity === "medium") return "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900/60";
  return "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/60";
}

function riskTone(level: PipelineRow["risk_level"]) {
  if (level === "alto") return "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-900/60";
  if (level === "medio") return "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900/60";
  if (level === "baixo") return "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/60";
  return "bg-muted text-muted-foreground border border-border";
}

export default function CrmSection() {
  const [data, setData] = useState<CrmPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let canceled = false;

    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/super-admin/crm/overview", { cache: "no-store" });
        const payload = (await response.json()) as CrmPayload;
        if (!canceled) setData(payload);
      } catch (error) {
        if (!canceled) {
          setData({
            ok: false,
            error: error instanceof Error ? error.message : "Falha de rede no CRM.",
            next_step: "Verifique conectividade e tente novamente.",
          });
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    };

    load();
    return () => {
      canceled = true;
    };
  }, []);

  if (loading) return <WidgetSkeleton lines={8} />;

  if (!data?.ok || !data.summary || !data.funnel_summary) {
    return (
      <WidgetError
        title="Falha ao carregar funil unificado"
        message={data?.error ?? "Dados CRM indisponíveis."}
        nextStep={data?.next_step ?? "Valide endpoint /api/super-admin/crm/overview e recarregue o dashboard."}
      />
    );
  }

  const funnel = data.funnel_summary;
  const funnelStages = data.funnel_stages ?? [];
  const bottlenecks = data.bottlenecks ?? [];
  const recentPipeline = data.recent_pipeline ?? [];
  const affiliates = data.affiliate_rollup ?? [];
  const churnRows = data.top_churn_risk ?? [];
  const upgradeRows = data.ready_for_upgrade ?? [];

  const layerCards = [
    {
      title: "Marketing",
      value: funnel.marketing_total,
      hint: `${funnel.marketing_last_7d} novos / 7 dias`,
      icon: Layers3,
    },
    {
      title: "CRM comercial",
      value: funnel.crm_total,
      hint: `${funnel.crm_open} abertos · ${funnel.crm_won} ganhos`,
      icon: BarChart3,
    },
    {
      title: "Onboarding",
      value: funnel.onboarding_total,
      hint: `${funnel.onboarding_active} activos · ${funnel.onboarding_risk_high} risco alto`,
      icon: ArrowRightLeft,
    },
    {
      title: "Assinaturas",
      value: funnel.subscriptions_total,
      hint: `${funnel.subscriptions_active} activas · ${funnel.subscriptions_suspended} suspensas`,
      icon: Shield,
    },
    {
      title: "Faturamento",
      value: funnel.commissions_total,
      hint: `${funnel.commissions_pending} pendentes · ${funnel.commissions_paid} pagas`,
      icon: Wallet,
    },
  ];

  const rateCards = [
    {
      title: "CRM → Onboarding",
      value: `${funnel.crm_to_onboarding_rate}%`,
      hint: "Leads ganhos convertidos em onboarding",
    },
    {
      title: "Onboarding → Assinatura",
      value: `${funnel.onboarding_to_subscription_rate}%`,
      hint: "Onboardings com assinatura criada",
    },
    {
      title: "Assinatura → Faturamento pago",
      value: `${funnel.subscription_to_paid_commission_rate}%`,
      hint: "Fecho operacional até parceiro receber",
    },
  ];

  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Zona 3 — CRM ponta a ponta</h2>
          <p className="text-sm text-muted-foreground">
            Marketing → CRM → onboarding → assinatura → faturamento, numa única superfície operacional.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm xl:grid-cols-3">
          <div className="rounded-xl border border-border bg-muted px-3 py-2">
            <p className="text-[11px] font-semibold text-muted-foreground">Faturamento pendente</p>
            <p className="font-bold text-foreground">{formatCurrency(funnel.commissions_pending_kz)}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted px-3 py-2">
            <p className="text-[11px] font-semibold text-muted-foreground">Faturamento pago</p>
            <p className="font-bold text-foreground">{formatCurrency(funnel.commissions_paid_kz)}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted px-3 py-2 col-span-2 xl:col-span-1">
            <p className="text-[11px] font-semibold text-muted-foreground">Base pós-venda</p>
            <p className="font-bold text-foreground">{data.summary.schools_count} escolas</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {layerCards.map((card) => (
          <article key={card.title} className="rounded-xl border border-border p-4">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <card.icon className="h-4 w-4 text-muted-foreground" />
              {card.title}
            </p>
            <p className="mt-2 text-2xl font-bold text-foreground">{card.value}</p>
            <p className="text-sm text-muted-foreground">{card.hint}</p>
          </article>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        {rateCards.map((card) => (
          <article key={card.title} className="rounded-xl border border-border bg-muted p-4">
            <p className="text-sm font-semibold text-foreground">{card.title}</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{card.value}</p>
            <p className="text-sm text-muted-foreground">{card.hint}</p>
          </article>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
        {funnelStages.map((stage) => (
          <article key={stage.id} className="rounded-xl border border-border p-4">
            <p className="text-sm font-semibold text-foreground">{stage.label}</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{stage.count}</p>
            <p className="text-sm text-muted-foreground">{stage.hint}</p>
          </article>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_1.4fr]">
        <div className="rounded-xl border border-border p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Gargalos operacionais</h3>
          </div>

          {bottlenecks.length === 0 ? (
            <WidgetEmpty
              title="Sem gargalos críticos"
              message="Não há bloqueios mapeados no funil neste momento."
              nextStep="Revalidar cálculo de bottlenecks e limites de alerta."
            />
          ) : (
            <ul className="space-y-3">
              {bottlenecks.slice(0, 6).map((item) => (
                <li key={item.id} className="rounded-xl border border-border bg-muted p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.action}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeTone(item.severity)}`}>
                      {item.count}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">Pipeline recente unificado</h3>
            <span className="text-sm text-muted-foreground">{recentPipeline.length} itens</span>
          </div>

          {recentPipeline.length === 0 ? (
            <WidgetEmpty
              title="Sem pipeline recente"
              message="Ainda não há itens suficientes para montar a visão unificada."
              nextStep="Verifique vínculos CRM/onboarding/assinatura e recarregue."
            />
          ) : (
            <div className="max-w-full overflow-x-auto" role="region" tabIndex={0} aria-label="Pipeline recente de escolas">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-semibold">Escola</th>
                    <th className="pb-2 pr-4 font-semibold">Parceiro</th>
                    <th className="pb-2 pr-4 font-semibold">Fase actual</th>
                    <th className="pb-2 pr-4 font-semibold">Risco</th>
                    <th className="pb-2 pr-4 font-semibold">Última actividade</th>
                    <th className="pb-2 font-semibold">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPipeline.map((row) => (
                    <tr key={row.id} className="border-b border-border align-top">
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-foreground">{row.school_name}</p>
                        <p className="text-muted-foreground">
                          {row.subscription_status ? `Assinatura: ${row.subscription_status}` : row.lead_stage ? `Lead: ${row.lead_stage}` : "Top of funnel"}
                        </p>
                      </td>
                      <td className="py-3 pr-4 text-foreground">{row.affiliate_name ?? row.affiliate_code ?? "Sem parceiro"}</td>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-foreground">{row.current_stage_label}</p>
                        <p className="text-muted-foreground">
                          {row.onboarding_status ? `Onboarding: ${row.onboarding_status}` : row.activation_commission_status ? `Ativação: ${row.activation_commission_status}` : "—"}
                        </p>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${riskTone(row.risk_level)}`}>
                          {row.risk_level ?? "n/a"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-foreground">
                        {new Date(row.latest_activity_at).toLocaleDateString("pt-PT")}
                      </td>
                      <td className="py-3">
                        <Link href={row.action_href} className="font-semibold text-amber hover:underline">
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground">Parceiros com maior carga de carteira</h3>
          {affiliates.length === 0 ? (
            <WidgetEmpty
              title="Sem rollup por parceiro"
              message="Não há agregados suficientes para exibir carteira por parceiro."
              nextStep="Verifique códigos de parceiro nas fontes do funil."
            />
          ) : (
            <div className="mt-3 max-w-full overflow-x-auto" role="region" tabIndex={0} aria-label="Carteiras e faturamento de parceiros">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-semibold">Parceiro</th>
                    <th className="pb-2 pr-4 font-semibold">Marketing</th>
                    <th className="pb-2 pr-4 font-semibold">CRM</th>
                    <th className="pb-2 pr-4 font-semibold">Onboarding</th>
                    <th className="pb-2 pr-4 font-semibold">Ativas</th>
                    <th className="pb-2 font-semibold">Faturamento</th>
                  </tr>
                </thead>
                <tbody>
                  {affiliates.map((row) => (
                    <tr key={row.affiliate_code} className="border-b border-border">
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-foreground">{row.affiliate_name}</p>
                        <p className="text-muted-foreground">{row.affiliate_code}</p>
                      </td>
                      <td className="py-3 pr-4 text-foreground">{row.marketing_leads}</td>
                      <td className="py-3 pr-4 text-foreground">{row.crm_leads}</td>
                      <td className="py-3 pr-4 text-foreground">{row.onboardings}</td>
                      <td className="py-3 pr-4 text-foreground">{row.active_subscriptions}</td>
                      <td className="py-3 text-foreground">
                        {row.pending_commissions} abertas · {row.paid_commissions} pagas
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground">Pós-venda em atenção</h3>
          <div className="mt-3 grid grid-cols-1 gap-4">
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">Top risco de churn</p>
              {churnRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem churn crítico agora.</p>
              ) : (
                <ul className="space-y-2">
                  {churnRows.slice(0, 4).map((row) => (
                    <li key={row.escola_id} className="flex items-center justify-between rounded-xl border border-border p-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{row.escola_nome}</p>
                        <p className="text-sm text-muted-foreground">churn: {row.churn_risk}% · cobrança: {row.payment_risk}%</p>
                      </div>
                      <Link href={row.action_href} className="text-sm font-semibold text-amber hover:underline">
                        Ver
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">Candidatas a upgrade</p>
              {upgradeRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem candidatas fortes agora.</p>
              ) : (
                <ul className="space-y-2">
                  {upgradeRows.slice(0, 4).map((row) => (
                    <li key={row.escola_id} className="flex items-center justify-between rounded-xl border border-border p-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{row.escola_nome}</p>
                        <p className="text-sm text-muted-foreground">expansão: {row.expansion_signal}% · plano: {row.plano ?? "n/d"}</p>
                      </div>
                      <Link href={row.action_href} className="text-sm font-semibold text-amber hover:underline">
                        Abrir
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      <QuickActionsSection />
    </section>
  );
}
