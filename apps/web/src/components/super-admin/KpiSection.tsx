"use client";

import { Building2, GraduationCap, TrendingUp, Users } from "lucide-react";
import { WidgetError, WidgetSkeleton } from "@/components/super-admin/WidgetStates";

interface KpiData {
  escolas?: number;
  usuarios?: number;
  matriculas?: number;
  financeiro?: number;
}

export default function KpiSection({ data, isLoading = false }: { data?: KpiData; isLoading?: boolean }) {
  if (isLoading) return <WidgetSkeleton lines={4} />;

  if (!data) {
    return (
      <WidgetError
        title="Falha ao carregar KPIs de gestão"
        message="As métricas de gestão não foram carregadas nesta sessão."
        nextStep="Atualize o dashboard; se persistir, valide a view `vw_admin_dashboard_counts`."
      />
    );
  }

  const cards = [
    {
      title: "Escolas Ativas",
      value: (data.escolas ?? 0).toLocaleString(),
      desc: "Instituições conectadas",
      icon: Building2,
      iconClass: "text-klasse-green bg-klasse-green/10",
      valueClass: "text-klasse-green",
    },
    {
      title: "Pessoas na Rede",
      value: (data.usuarios ?? 0).toLocaleString(),
      desc: "Utilizadores com acesso",
      icon: Users,
      iconClass: "text-klasse-gold bg-klasse-gold/10",
      valueClass: "text-slate-950",
    },
    {
      title: "Alunos Matriculados",
      value: (data.matriculas ?? 0).toLocaleString(),
      desc: "Total agregado no sistema",
      icon: GraduationCap,
      iconClass: "text-slate-950 bg-slate-100",
      valueClass: "text-slate-950",
    },
    {
      title: "Saúde Financeira",
      value: `${data.financeiro ?? 0}%`,
      desc: "Taxa de pagamentos",
      icon: TrendingUp,
      iconClass: "text-klasse-green bg-klasse-green/10",
      valueClass: "text-klasse-green",
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <article
          key={card.title}
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:ring-1 hover:ring-klasse-gold/25"
        >
          <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${card.iconClass}`}>
            <card.icon className="h-5 w-5" />
          </div>

          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{card.title}</p>
          <p className={`text-3xl font-bold tracking-tight ${card.valueClass}`}>{card.value}</p>
          <p className="mt-2 text-sm text-slate-500">{card.desc}</p>
        </article>
      ))}
    </section>
  );
}
