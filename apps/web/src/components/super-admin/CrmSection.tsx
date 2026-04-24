"use client";

import Link from "next/link";
import { BarChart3, Eye, Shield, Wallet, Settings } from "lucide-react";
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

type CrmPayload = {
  ok: boolean;
  summary?: CrmSummary;
  top_churn_risk?: CrmMetric[];
  ready_for_upgrade?: CrmMetric[];
  error?: string;
  next_step?: string;
};

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

  if (loading) return <WidgetSkeleton lines={5} />;

  if (!data?.ok || !data.summary) {
    return (
      <WidgetError
        title="Falha ao carregar priorização CRM"
        message={data?.error ?? "Dados CRM indisponíveis."}
        nextStep={data?.next_step ?? "Valide endpoint /api/super-admin/crm/overview e recarregue o dashboard."}
      />
    );
  }

  const cards = [
    {
      title: "Activation Score",
      value: `${data.summary.avg_activation_score}%`,
      icon: Eye,
      owner: "Owner: Onboarding CS",
      action: "Próximo passo: atacar tenants com score < 60.",
    },
    {
      title: "Engagement Score",
      value: `${data.summary.avg_engagement_score}%`,
      icon: BarChart3,
      owner: "Owner: CSM",
      action: "Próximo passo: criar cadência para escolas com baixa atividade.",
    },
    {
      title: "Payment Risk",
      value: `${data.summary.avg_payment_risk}%`,
      icon: Wallet,
      owner: "Owner: Cobrança",
      action: "Próximo passo: priorizar régua de cobrança em risco alto.",
    },
    {
      title: "Support Pressure",
      value: `${data.summary.avg_support_pressure}%`,
      icon: Settings,
      owner: "Owner: Suporte",
      action: "Próximo passo: reduzir backlog crítico por tenant.",
    },
    {
      title: "Expansion Signal",
      value: `${data.summary.avg_expansion_signal}%`,
      icon: Shield,
      owner: "Owner: Revenue Ops",
      action: "Próximo passo: abrir proposta de upgrade para sinais > 70.",
    },
  ];

  const churnRows = data.top_churn_risk ?? [];
  const upgradeRows = data.ready_for_upgrade ?? [];

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Zona 3 — CRM</h2>
          <p className="text-sm text-slate-500">Ciclo de vida por tenant com foco em churn, suporte e expansão.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">{data.summary.schools_count} escolas</span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <article key={card.title} className="rounded-xl border border-slate-200 p-4 transition hover:ring-1 hover:ring-klasse-gold/25">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <card.icon className="h-4 w-4 text-slate-400" />
              {card.title}
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{card.value}</p>
            <p className="mt-1 text-sm text-slate-600">{card.owner}</p>
            <p className="text-sm text-slate-500">{card.action}</p>
          </article>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700">Top 10 escolas em risco de churn</h3>
          {churnRows.length === 0 ? (
            <WidgetEmpty
              title="Sem churn crítico"
              message="Não há escolas com churn elevado neste momento."
              nextStep="Revalidar métricas de risco e revisar variações semanais."
            />
          ) : (
            <ul className="mt-3 space-y-2">
              {churnRows.map((row) => (
                <li key={row.escola_id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{row.escola_nome}</p>
                    <p className="text-sm text-slate-500">churn: {row.churn_risk}% · payment risk: {row.payment_risk}%</p>
                  </div>
                  <Link href={row.action_href} className="text-sm font-semibold text-klasse-gold hover:underline">
                    Ver escola
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700">Escolas prontas para upgrade de plano</h3>
          {upgradeRows.length === 0 ? (
            <WidgetEmpty
              title="Sem candidatos a upgrade"
              message="Não há tenants com sinal de expansão suficiente agora."
              nextStep="Refinar engajamento e adimplência para abrir oportunidade comercial."
            />
          ) : (
            <ul className="mt-3 space-y-2">
              {upgradeRows.map((row) => (
                <li key={row.escola_id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{row.escola_nome}</p>
                    <p className="text-sm text-slate-500">expansion: {row.expansion_signal}% · plano atual: {row.plano ?? "n/d"}</p>
                  </div>
                  <Link href={row.action_href} className="text-sm font-semibold text-klasse-gold hover:underline">
                    Abrir ação
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <QuickActionsSection />
    </section>
  );
}
