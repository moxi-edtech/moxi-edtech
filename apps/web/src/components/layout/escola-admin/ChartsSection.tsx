"use client";

import { useMemo, useState } from "react";
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
import { klasseColors } from "@moxi/design-tokens";
import type { PagamentosResumo } from "./definitions";

// ─── Klasse design tokens ─────────────────────────────────────────────────────

const KLASSE_GREEN  = klasseColors.green.DEFAULT;
const KLASSE_GOLD   = klasseColors.gold.DEFAULT;
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
  isOperacoes = false,
}: {
  icon:     React.ReactNode;
  iconBg:   string;
  title:    string;
  subtitle: string;
  children: React.ReactNode;
  isOperacoes?: boolean;
}) {
  return (
    <div className={`min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md`}>
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        <div className={`p-2 rounded-lg ${iconBg}`}>{icon}</div>
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
  pagamentosValores?: {
    pago: number;
    pendente: number;
    inadimplente: number;
  };
  mode?:         "admin" | "operacoes";
}

// ─── Component ────────────────────────────────────────────────────────────────

const moeda = new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 });

export default function ChartsSection({ meses, alunosPorMes, pagamentos, pagamentosValores, mode = "admin" }: ChartsSectionProps) {
  const labels     = useMemo(() => meses        ?? [], [meses]);
  const dadosAlunos = useMemo(() => alunosPorMes ?? [], [alunosPorMes]);
  const resumo     = pagamentos ?? null;
  const [billingView, setBillingView] = useState<"quantidade" | "valor">("quantidade");

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
    const v = pagamentosValores ?? { pago: 0, pendente: 0, inadimplente: 0 };
    const useValues = billingView === "valor";
    return [
      { status: "Pago", valor: Number(useValues ? v.pago : r.pago), fill: KLASSE_GREEN },
      { status: "Pendente", valor: Number(useValues ? v.pendente : r.pendente), fill: KLASSE_GOLD },
      { status: "Inadimplente", valor: Number(useValues ? v.inadimplente : r.inadimplente), fill: "#dc2626" },
    ];
  }, [billingView, pagamentosValores, resumo]);

  const hasLineData = labels.length > 0 && dadosAlunos.length > 0;

  const isOperacoes = mode === "operacoes";

  return (
    <div className="grid min-w-0 grid-cols-1 lg:grid-cols-2 gap-5">

      {/* Matrículas por mês */}
      <ChartCard
        iconBg="bg-klasse-green/10 text-klasse-green"
        icon={<TrendingUp className="h-4 w-4" />}
        title={isOperacoes ? "Fluxo de Matrículas" : "Matrículas por Mês"}
        subtitle={isOperacoes ? "Ritmo operacional do ano letivo" : "Evolução do ano letivo"}
        isOperacoes={isOperacoes}
      >
        <div className="h-56 min-w-0">
          {hasLineData ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
        iconBg="bg-klasse-gold/10 text-klasse-gold"
        icon={<Wallet className="h-4 w-4" />}
        title={isOperacoes ? "Saúde da Cobrança" : "Status das Mensalidades"}
        subtitle={isOperacoes ? "Distribuição operacional da carteira" : "Distribuição atual"}
        isOperacoes={isOperacoes}
      >
        <div className="mb-4 flex items-center justify-end">
          <div className={`inline-flex border border-slate-200 bg-slate-50 p-1 rounded-lg`}>
            <button
              type="button"
              onClick={() => setBillingView("quantidade")}
              className={`rounded-md px-3 py-1.5 text-[11px] font-bold transition ${
                billingView === "quantidade" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              Faturas
            </button>
            <button
              type="button"
              onClick={() => setBillingView("valor")}
              className={`rounded-md px-3 py-1.5 text-[11px] font-bold transition ${
                billingView === "valor" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              Valor AOA
            </button>
          </div>
        </div>
        <div className="h-56 min-w-0">
          {resumo ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={barData} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid stroke={SLATE_GRID} vertical={false} />
                <XAxis dataKey="status" tick={axisTick} tickLine={false} axisLine={false} />
                <YAxis
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  tickFormatter={(value) =>
                    billingView === "valor" ? `${Math.round(Number(value) / 1000)}k` : String(value)
                  }
                />
                <Tooltip
                  content={<ChartTooltip />}
                  formatter={(value) =>
                    billingView === "valor"
                      ? moeda.format(Number(value ?? 0))
                      : Number(value ?? 0).toLocaleString("pt-AO")
                  }
                />
                <Bar
                  dataKey="valor"
                  name={billingView === "valor" ? "Valor total" : "Mensalidades"}
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </div>
      </ChartCard>

    </div>
  );
}
