import { Check, LayoutDashboard, Settings, Users } from "lucide-react";
import ChartsSection from "@/components/super-admin/ChartsSection";
import KpiSection from "@/components/super-admin/KpiSection";
import SchoolsSection from "@/components/super-admin/SchoolsSection";
import type { ChartsData } from "@/lib/charts";

type DashboardData = {
  escolas?: number;
  usuarios?: number;
  matriculas?: number;
  financeiro?: number;
};

type School = {
  id: string;
  nome: string;
  plano: string;
  onboarding_finalizado: boolean;
  progresso_onboarding: number;
  alunos_ativos: number;
};

function averageProgress(schools: School[]): number {
  if (!schools.length) return 0;
  const sum = schools.reduce((acc, school) => acc + Number(school.progresso_onboarding ?? 0), 0);
  return Math.round(sum / schools.length);
}

export default function ManagementSection({
  dashboard,
  charts,
  schools,
}: {
  dashboard?: DashboardData;
  charts?: ChartsData;
  schools: School[];
}) {
  const onboardingPending = schools.filter((s) => !s.onboarding_finalizado).length;
  const avgProgress = averageProgress(schools);
  const bottlenecks = schools.filter((s) => !s.onboarding_finalizado && Number(s.progresso_onboarding ?? 0) < 50).length;

  const cards = [
    {
      title: "Onboarding de Escolas",
      value: String(onboardingPending),
      owner: "Owner: Onboarding Ops",
      action: "Ação: Acionar playbook para pendências em até 24h.",
      icon: Check,
    },
    {
      title: "Performance por Tenant",
      value: `${avgProgress}%`,
      owner: "Owner: Customer Ops",
      action: "Ação: Priorizar tenants com progresso abaixo de 60%.",
      icon: Users,
    },
    {
      title: "Gargalos de Operação",
      value: String(bottlenecks),
      owner: "Owner: PMO Operacional",
      action: "Ação: Abrir incidente para bloqueios de setup críticos.",
      icon: Settings,
    },
    {
      title: "Capacidade de Gestão",
      value: String(dashboard?.usuarios ?? 0),
      owner: "Owner: Admin Global",
      action: "Ação: Rebalancear carga de gestão por tenant.",
      icon: LayoutDashboard,
    },
  ];

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-bold text-slate-950">Zona 2 — Gestão</h2>
        <p className="text-sm text-slate-500">Onboarding de escolas, performance por tenant e gargalos operacionais.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
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

      <KpiSection data={dashboard} />
      <ChartsSection data={charts} />
      <SchoolsSection escolas={schools} />
    </section>
  );
}
