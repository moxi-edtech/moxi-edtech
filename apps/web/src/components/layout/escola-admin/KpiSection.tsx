// apps/web/src/components/layout/escola-admin/KpiSection.tsx
"use client";

import { UsersRound, Users, UserCheck, Wallet, AlertCircle } from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import type { SetupStatus } from "./setupStatus";
import type { KpiStats, OperationalSnapshot } from "./dashboard.types";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref } from "@/lib/navigation";

type Props = {
  escolaId:        string;
  stats:           KpiStats;
  mode?:           "admin" | "operacoes";
  loading?:        boolean;
  error?:          string | null;
  setupStatus:     SetupStatus;
  operationalSnapshot?: OperationalSnapshot;
  financeiroHref?: string;
  portalBase?:     "admin" | "operacoes";
  alunoSeries?:    number[];
};

function toChartData(series?: number[]) {
  if (!series || series.length < 2) return undefined;
  return series.map((value) => ({ value: Number(value ?? 0) }));
}

function trendFromSeries(series?: number[]) {
  if (!series || series.length < 2) return undefined;
  const prev = Number(series[series.length - 2] ?? 0);
  const curr = Number(series[series.length - 1] ?? 0);
  if (prev === 0 && curr === 0) return undefined;
  if (prev === 0) return { value: 100, isPositive: curr >= prev };
  return {
    value: Math.round(Math.abs(((curr - prev) / prev) * 100)),
    isPositive: curr >= prev,
  };
}

// ─── Skeleton card ────────────────────────────────────────────────────────────
function KpiSkeleton() {
  return (
    <div className="flex h-28 flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
  mode = "admin",
  loading = false,
  error,
  setupStatus,
  operationalSnapshot,
  financeiroHref,
  portalBase = "admin",
  alunoSeries,
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

  const portalHref = (path: string) => buildPortalHref(escolaParam, `/${portalBase}/${path}`);
  const financeHref = financeiroHref ?? buildPortalHref(escolaParam, "/financeiro");
  const financeRadarHref = mode === "operacoes"
    ? buildPortalHref(escolaParam, "/operacoes/turmas-alunos")
    : `${financeHref}/radar`;
  const op = operationalSnapshot ?? {
    mensalidadesPendentes: 0,
    mensalidadesInadimplentes: 0,
    turmasPendentes: 0,
    curriculoHorarioPendencias: 0,
    setupBlockers: 0,
    admissoesPendentes: 0,
    matriculasPendentes: 0,
    documentosEmProcessamento: 0,
    turmasSemHorarioPublicado: 0,
  };
  const alunosChartData = toChartData(alunoSeries);
  const alunosTrend = trendFromSeries(alunoSeries) ?? { value: 0, isPositive: true };
  const kpis = mode === "operacoes"
    ? [
        {
          label: "Alunos",
          value: s.alunos,
          icon: Users,
          href: portalHref("alunos"),
          variant: turmasOk ? ("brand" as const) : ("warning" as const),
          trend: undefined,
          chartData: undefined,
          description: "Base activa",
        },
        {
          label: "Turmas",
          value: s.turmas,
          icon: UsersRound,
          href: portalHref("turmas"),
          variant: "default" as const,
          trend: undefined,
          chartData: undefined,
          description: "Em circulação",
        },
        {
          label: "Pendentes",
          value: op.mensalidadesPendentes,
          icon: Wallet,
          href: buildPortalHref(escolaParam, "/operacoes/recebimentos"),
          variant: op.mensalidadesPendentes > 0 ? ("warning" as const) : ("success" as const),
          trend: undefined,
          chartData: undefined,
          description: "Cobranças por tratar",
        },
        {
          label: "Em Atraso",
          value: op.mensalidadesInadimplentes,
          icon: UserCheck,
          href: financeRadarHref,
          variant: op.mensalidadesInadimplentes > 0 ? ("warning" as const) : ("success" as const),
          trend: undefined,
          chartData: undefined,
          description: "Cobrança crítica",
        },
      ]
    : [
        {
          label: "Turmas",
          value: s.turmas,
          icon: UsersRound,
          href: portalHref("turmas"),
          variant: "default" as const,
          trend: { value: 12, isPositive: true },
          description: "Em operação este ano",
        },
        {
          label: "Alunos",
          value: s.alunos,
          icon: Users,
          href: portalHref("alunos"),
          variant: turmasOk ? ("brand" as const) : ("warning" as const),
          trend: alunosTrend,
          chartData: alunosChartData,
          description: "Matrículas confirmadas",
        },
        {
          label: "Professores",
          value: s.professores,
          icon: UserCheck,
          href: portalHref("professores"),
          variant: "default" as const,
          trend: { value: 2, isPositive: false },
          description: "Corpo docente ativo",
        },
        {
          label: "Financeiro",
          value: `${s.financeiro ?? 0}%`,
          icon: Wallet,
          href: financeHref,
          variant: s.financeiro && s.financeiro > 80 ? ("success" as const) : ("brand" as const),
          trend: { value: 5, isPositive: true },
          description: "Cobrança da competência",
        },
      ];

  const gridClasses =
    mode === "operacoes"
      ? "grid grid-cols-2 gap-3 xl:grid-cols-4"
      : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div className={gridClasses}>
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
          compact={mode === "operacoes"}
        />
      ))}
    </div>
  );
}
