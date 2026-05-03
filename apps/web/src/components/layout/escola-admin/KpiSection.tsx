// apps/web/src/components/layout/escola-admin/KpiSection.tsx
"use client";

import { UsersRound, Users, UserCheck, Wallet, AlertCircle } from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import type { SetupStatus } from "./setupStatus";
import { useEscolaId } from "@/hooks/useEscolaId";

// ─── Types ────────────────────────────────────────────────────────────────────

export type KpiStats = {
  turmas:      number;
  alunos:      number;
  professores: number;
  avaliacoes:  number;
  financeiro?: number;
};

type Props = {
  escolaId:        string;
  stats:           KpiStats;
  loading?:        boolean;
  error?:          string | null;
  setupStatus:     SetupStatus;
  financeiroHref?: string;
};

// ─── Mock Data for Sparklines ────────────────────────────────────────────────
const mockChartData = [
  { value: 400 }, { value: 300 }, { value: 500 }, { value: 450 },
  { value: 600 }, { value: 550 }, { value: 700 }, { value: 680 }
];

// ─── Skeleton card ────────────────────────────────────────────────────────────
function KpiSkeleton() {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm h-32">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <div className="h-2.5 w-16 bg-slate-100 animate-pulse rounded" />
          <div className="h-7 w-20 bg-slate-100 animate-pulse rounded-md" />
        </div>
        <div className="h-10 w-10 bg-slate-100 animate-pulse rounded-xl" />
      </div>
      <div className="h-8 w-full bg-slate-50/50 animate-pulse rounded-b-xl mt-4" />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function KpiSection({
  escolaId,
  stats,
  loading = false,
  error,
  setupStatus,
  financeiroHref,
}: Props) {
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-red-600 bg-red-50 rounded-xl border border-red-100 font-medium">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        Não foi possível carregar os indicadores.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
      </div>
    );
  }

  const s = stats ?? { turmas: 0, alunos: 0, professores: 0, avaliacoes: 0 };
  const { turmasOk } = setupStatus;

  const adminHref = (path: string) => `/escola/${escolaParam}/admin/${path}`;
  const financeHref = financeiroHref ?? `/escola/${escolaParam}/financeiro`;

  const kpis = [
    {
      label: "Turmas",
      value: s.turmas,
      icon: UsersRound,
      href: adminHref("turmas"),
      variant: "default" as const,
      trend: { value: 12, isPositive: true },
      chartData: mockChartData,
      description: "Em operação este ano",
    },
    {
      label: "Alunos",
      value: s.alunos,
      icon: Users,
      href: adminHref("alunos"),
      variant: turmasOk ? ("brand" as const) : ("warning" as const),
      trend: { value: 8, isPositive: true },
      chartData: mockChartData.map(d => ({ value: d.value * 1.2 })),
      description: "Matrículas confirmadas",
    },
    {
      label: "Professores",
      value: s.professores,
      icon: UserCheck,
      href: adminHref("professores"),
      variant: "default" as const,
      trend: { value: 2, isPositive: false },
      chartData: mockChartData.map(d => ({ value: 1000 - d.value })),
      description: "Corpo docente ativo",
    },
    {
      label: "Financeiro",
      value: `${s.financeiro ?? 0}%`,
      icon: Wallet,
      href: financeHref,
      variant: s.financeiro && s.financeiro > 80 ? ("success" as const) : ("brand" as const),
      trend: { value: 5, isPositive: true },
      chartData: mockChartData.map(d => ({ value: d.value * 0.8 })),
      description: "Receita realizada / prevista",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <KpiCard
          key={kpi.label}
          label={kpi.label}
          value={kpi.value}
          icon={kpi.icon}
          href={kpi.href}
          variant={kpi.variant}
          trend={kpi.trend}
          chartData={kpi.chartData}
          description={kpi.description}
        />
      ))}
    </div>
  );
}
