"use client";

import {
  Wallet,
  TrendingUp,
  Users,
  ArrowRight,
  Radar,
  Receipt,
  Scale,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function FinanceiroDashboardPage() {
  const [loading, setLoading] = useState(true);

  const [resumo, setResumo] = useState({
    inadimplencia: {
      total: 0,
      percentual: 0,
    },
    risco: {
      total: 0,
    },
    confirmados: {
      total: 0,
    },
    pendentes: {
      total: 0,
    },
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/financeiro/dashboard');
        if (!response.ok) {
          throw new Error('Failed to fetch financial data');
        }
        const data = await response.json();
        setResumo(data);
      } catch (error) {
        console.error('Error fetching financial data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <main className="space-y-8 p-4 md:p-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-moxinexa-navy">Financeiro</h1>
        <p className="text-slate-500 text-sm">
          Gestão completa de receita, cobranças e fluxo financeiro da escola.
        </p>
      </div>

      {/* Cards Principais */}
      <section className="grid gap-4 md:grid-cols-4">
        {/* CARD: INADIMPLÊNCIA */}
        <Card
          title="Taxa de Inadimplência"
          value={
            loading
              ? "..."
              : (resumo.inadimplencia?.percentual ?? 0).toFixed(1) + "%"
          }
          icon={<TrendingUp className="text-red-500" />}
          color="bg-red-50"
        />

        {/* CARD: EM RISCO */}
        <Card
          title="Total em Risco"
          value={
            loading
              ? "..."
              : (resumo?.risco?.total ?? 0).toLocaleString("pt-AO") + " Kz"
          }
          icon={<Wallet className="text-orange-600" />}
          color="bg-orange-50"
        />

        {/* CARD: PAGAMENTOS CONFIRMADOS */}
        <Card
          title="Pagamentos Confirmados"
          value={loading ? "..." : resumo?.confirmados?.total ?? 0}
          icon={<TrendingUp className="text-moxinexa-teal" />}
          color="bg-teal-50"
        />

        {/* CARD: ALUNOS PENDENTES */}
        <Card
          title="Alunos Pendentes"
          value={loading ? "..." : resumo.inadimplencia?.total ?? 0}
          icon={<Users className="text-moxinexa-navy" />}
          color="bg-slate-100"
        />
      </section>

      {/* Secção de acessos rápidos */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-moxinexa-navy">
          Acessos Rápidos
        </h2>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <QuickLink
            href="/financeiro/radar"
            title="Radar de Inadimplência"
            description="Acompanhe alunos em atraso e envie cobranças automáticas."
            icon={<Radar className="h-6 w-6" />}
            color="text-red-600"
          />

          <QuickLink
            href="/financeiro/cobrancas"
            title="Histórico de Cobranças"
            description="Veja respostas, pagamentos e eficiência das mensagens."
            icon={<Receipt className="h-6 w-6" />}
            color="text-orange-500"
          />

          <QuickLink
            href="/financeiro/conciliacao"
            title="Conciliação TPA"
            description="Confirme pagamentos Multicaixa/TPA com total precisão."
            icon={<Scale className="h-6 w-6" />}
            color="text-moxinexa-teal"
          />

          <QuickLink
            href="/financeiro/relatorios"
            title="Relatórios Financeiros"
            description="Taxas, gráficos, projeções e análise completa."
            icon={<BarChart3 className="h-6 w-6" />}
            color="text-moxinexa-navy"
          />
        </div>
      </section>

      {/* Secção menor (atividade recente) */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-moxinexa-navy">Resumo da Semana</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <MiniStat
            label="Cobranças Enviadas"
            value={0}
            color="text-moxinexa-teal"
          />

          <MiniStat
            label="Pagamentos Confirmados"
            value={resumo?.confirmados?.total ?? 0}
            color="text-green-600"
          />

          <MiniStat
            label="Conciliações Pendentes"
            value={resumo?.pendentes?.total ?? 0}
            color="text-orange-600"
          />
        </div>
      </section>
    </main>
  );
}

//
// --- COMPONENTES DE APOIO ---
//

function Card({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div
      className={`p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2 ${color}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-600">{title}</span>
        <div>{icon}</div>
      </div>
      <div className="text-xl font-bold text-moxinexa-navy">{value}</div>
    </div>
  );
}

function QuickLink({
  href,
  title,
  description,
  icon,
  color,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="group bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col gap-3"
    >
      <div className={`w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center ${color}`}>
        {icon}
      </div>

      <div>
        <h3 className="text-moxinexa-navy font-bold text-sm">{title}</h3>
        <p className="text-slate-500 text-xs leading-relaxed">{description}</p>
      </div>

      <div className="flex items-center gap-1 text-moxinexa-teal text-sm font-medium group-hover:underline">
        Aceder
        <ArrowRight className="h-4 w-4" />
      </div>
    </Link>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-slate-500 text-xs mt-1">{label}</div>
    </div>
  );
}