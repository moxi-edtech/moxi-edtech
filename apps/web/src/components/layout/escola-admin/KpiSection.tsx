// apps/web/src/components/layout/escola-admin/KpiSection.tsx
"use client";

import { UsersRound, Users, UserCheck, Wallet, AlertCircle } from "lucide-react";
import StatCard from "@/components/shared/StatCard";
import type { SetupStatus } from "./setupStatus";

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

// ─── Skeleton card ────────────────────────────────────────────────────────────
// Full-card skeleton — avoids the partial skeleton (value-only) that leaves
// title and badge visible during loading, which looks broken.

function KpiSkeleton() {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <div className="h-2.5 w-16 bg-slate-100 animate-pulse rounded" />
          <div className="h-7 w-20 bg-slate-100 animate-pulse rounded-md" />
          <div className="h-4 w-14 bg-slate-100 animate-pulse rounded-full" />
        </div>
        <div className="h-9 w-9 bg-slate-100 animate-pulse rounded-xl" />
      </div>
      <div className="mt-4 h-3 w-16 bg-slate-100 animate-pulse rounded" />
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

  // financeiroHref comes scoped from the server — fallback mirrors that scope
  const adminHref   = (path: string) => `/escola/${escolaId}/admin/${path}`;
  const financeHref = financeiroHref ?? `/escola/${escolaId}/financeiro`;

  const kpis = [
    {
      label: "Turmas",
      value: s.turmas,
      icon: <UsersRound size={16} />,
      href: adminHref("turmas"),
      tone: "default" as const,
      disabled: false,
    },
    {
      label: "Alunos",
      value: s.alunos,
      icon: <Users size={16} />,
      href: adminHref("alunos"),
      tone: turmasOk ? ("default" as const) : ("warning" as const),
      disabled: !turmasOk,
    },
    {
      label: "Professores",
      value: s.professores,
      icon: <UserCheck size={16} />,
      href: adminHref("professores"),
      tone: turmasOk ? ("default" as const) : ("warning" as const),
      disabled: !turmasOk,
    },
    {
      label: "Financeiro",
      value: `${s.financeiro ?? 0}%`,
      icon: <Wallet size={16} />,
      href: financeHref,
      tone: turmasOk ? ("default" as const) : ("warning" as const),
      disabled: !turmasOk,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <StatCard
          key={kpi.label}
          label={kpi.label}
          value={kpi.value}
          icon={kpi.icon}
          href={kpi.disabled ? undefined : kpi.href}
          tone={kpi.tone}
          disabled={kpi.disabled}
        />
      ))}
    </div>
  );
}
