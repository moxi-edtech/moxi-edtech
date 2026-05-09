"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, TrendingUp, Wallet } from "lucide-react";
import type { PagamentosResumo } from "./definitions";

// ─── Klasse design tokens ─────────────────────────────────────────────────────

const KLASSE_GREEN  = "#1F6B3B";
const KLASSE_GOLD   = "#E3B23C";
const SLATE_GRID    = "rgba(148, 163, 184, 0.08)";
const SLATE_TICK    = "#94a3b8";

// ─── Shared chart defaults ────────────────────────────────────────────────────

const axisTick = { fill: SLATE_TICK, fontSize: 11 };

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ color?: string; name?: string; value?: number | string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2 text-xs shadow-lg">
      {label ? <p className="mb-1 font-semibold text-slate-100">{label}</p> : null}
      {payload.map((item) => (
        <p key={`${item.name}-${item.value}`} className="font-medium text-slate-300">
          <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
          {item.name}: {Number(item.value ?? 0).toLocaleString("pt-AO")}
        </p>
      ))}
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function ChartCard({
  icon,
  iconBg,
  title,
  subtitle,
  children,
}: {
  icon:     React.ReactNode;
  iconBg:   string;
  title:    string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        <div className={`rounded-xl p-2 ${iconBg}`}>{icon}</div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col h-full items-center justify-center gap-2 text-slate-300">
      <BarChart3 className="h-10 w-10" />
      <p className="text-sm font-medium text-slate-400">Sem dados disponíveis</p>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ChartsSectionProps {
  meses?:        string[];
  alunosPorMes?: number[];
  pagamentos?:   PagamentosResumo;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChartsSection({ meses, alunosPorMes, pagamentos }: ChartsSectionProps) {
  const labels     = useMemo(() => meses        ?? [], [meses]);
  const dadosAlunos = useMemo(() => alunosPorMes ?? [], [alunosPorMes]);
  const resumo     = pagamentos ?? null;

  // ── Line chart (matrículas) ────────────────────────────────────────────────
  const lineData = useMemo(
    () =>
      labels.map((mes, index) => ({
        mes,
        alunos: Number(dadosAlunos[index] ?? 0),
      })),
    [labels, dadosAlunos]
  );

  // ── Bar chart (mensalidades) ───────────────────────────────────────────────
  const barData = useMemo(() => {
    const r = resumo ?? { pago: 0, pendente: 0, inadimplente: 0 };
    return [
      { status: "Pago", valor: Number(r.pago ?? 0), fill: KLASSE_GREEN },
      { status: "Pendente", valor: Number(r.pendente ?? 0), fill: KLASSE_GOLD },
      { status: "Inadimplente", valor: Number(r.inadimplente ?? 0), fill: "#dc2626" },
    ];
  }, [resumo]);

  const hasLineData = labels.length > 0 && dadosAlunos.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

      {/* Matrículas por mês */}
      <ChartCard
        iconBg="bg-[#1F6B3B]/10 text-[#1F6B3B]"
        icon={<TrendingUp className="h-4 w-4" />}
        title="Matrículas por Mês"
        subtitle="Evolução do ano letivo"
      >
        <div className="h-56">
          {hasLineData ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid stroke={SLATE_GRID} vertical={false} />
                <XAxis dataKey="mes" tick={axisTick} tickLine={false} axisLine={false} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ color: SLATE_TICK, fontSize: 11, paddingBottom: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="alunos"
                  name="Alunos matriculados"
                  stroke={KLASSE_GREEN}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: KLASSE_GREEN, stroke: "#ffffff", strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </div>
      </ChartCard>

      {/* Status das mensalidades */}
      <ChartCard
        iconBg="bg-[#E3B23C]/10 text-[#E3B23C]"
        icon={<Wallet className="h-4 w-4" />}
        title="Status das Mensalidades"
        subtitle="Distribuição atual"
      >
        <div className="h-56">
          {resumo ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid stroke={SLATE_GRID} vertical={false} />
                <XAxis dataKey="status" tick={axisTick} tickLine={false} axisLine={false} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="valor" name="Mensalidades" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </div>
      </ChartCard>

    </div>
  );
}
