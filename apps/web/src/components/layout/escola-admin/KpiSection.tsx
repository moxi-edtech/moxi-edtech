// apps/web/src/components/layout/escola-admin/KpiSection.tsx
"use client";

import Link from "next/link";
import {
  UsersRound,
  Users,
  UserCheck,
  Wallet,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
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

// ─── KPI card ─────────────────────────────────────────────────────────────────
// Disabled cards render as plain <div> — avoids passing href to a <div>
// via dynamic component, which causes TS warnings and broken semantics.

type KpiCardProps = {
  title:    string;
  value:    string | number;
  icon:     React.ElementType;
  status:   string;
  href:     string;
  disabled: boolean;
};

function KpiCard({ title, value, icon: Icon, status, href, disabled }: KpiCardProps) {
  const inner = (
    <div className={`
      group relative flex flex-col justify-between overflow-hidden rounded-2xl border
      bg-white p-5 shadow-sm transition-all duration-200 h-full
      ${disabled
        ? "border-slate-200 bg-slate-50/60 opacity-70 cursor-default"
        : "border-slate-200 hover:border-[#1F6B3B]/30 hover:shadow-md cursor-pointer"
      }
    `}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {title}
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900 tracking-tight">
            {value}
          </p>
          <span className={`
            mt-2 inline-flex items-center rounded-full border px-2 py-0.5
            text-[10px] font-bold uppercase tracking-wide
            ${disabled
              ? "bg-slate-100 text-slate-400 border-slate-200"
              : "bg-[#1F6B3B]/8 text-[#1F6B3B] border-[#1F6B3B]/15"
            }
          `}>
            {status}
          </span>
        </div>

        <div className={`
          rounded-xl p-2.5 transition-colors flex-shrink-0
          ${disabled
            ? "bg-slate-100 text-slate-300"
            : "bg-slate-50 text-slate-400 group-hover:bg-[#1F6B3B]/10 group-hover:text-[#1F6B3B]"
          }
        `}>
          <Icon size={18} />
        </div>
      </div>

      {!disabled && (
        <div className="mt-4 flex items-center gap-1 text-[10px] font-bold text-slate-400 group-hover:text-[#1F6B3B] transition-colors">
          Gerenciar
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </div>
      )}
    </div>
  );

  if (disabled) return <div>{inner}</div>;

  return (
    <Link href={href} className="block h-full">
      {inner}
    </Link>
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

  const kpis: KpiCardProps[] = [
    {
      title:    "Turmas",
      value:    s.turmas,
      icon:     UsersRound,
      status:   turmasOk ? "Ativas"       : "Estrutura",
      href:     adminHref("turmas"),
      disabled: false,
    },
    {
      title:    "Alunos",
      value:    s.alunos,
      icon:     Users,
      status:   turmasOk ? "Matriculados" : "Aguardando",
      href:     adminHref("alunos"),
      disabled: !turmasOk,
    },
    {
      title:    "Professores",
      value:    s.professores,
      icon:     UserCheck,
      status:   turmasOk ? "Docentes"     : "Pendente",
      href:     adminHref("professores"),
      disabled: !turmasOk,
    },
    {
      title:    "Financeiro",
      value:    `${s.financeiro ?? 0}%`,
      icon:     Wallet,
      status:   turmasOk ? "Arrecadação"  : "Configurar",
      href:     financeHref,
      disabled: !turmasOk,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.title} {...kpi} />
      ))}
    </div>
  );
}