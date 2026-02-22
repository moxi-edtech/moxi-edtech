"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { BarChart3, TrendingUp, Wallet } from "lucide-react";
import type { PagamentosResumo } from "./definitions";

// ─── Chart.js registration ────────────────────────────────────────────────────

ChartJS.register(
  CategoryScale, LinearScale,
  PointElement, LineElement,
  BarElement, ArcElement,
  Tooltip, Legend
);

// ─── Dynamic imports (no SSR) ─────────────────────────────────────────────────

const Line = dynamic(() => import("react-chartjs-2").then((m) => m.Line), { ssr: false });
const Bar  = dynamic(() => import("react-chartjs-2").then((m) => m.Bar),  { ssr: false });

// ─── Klasse design tokens ─────────────────────────────────────────────────────

const KLASSE_GREEN  = "#1F6B3B";
const KLASSE_GOLD   = "#E3B23C";
const SLATE_GRID    = "rgba(148, 163, 184, 0.08)";
const SLATE_TICK    = "#94a3b8";
const TOOLTIP_BG    = "rgba(15, 23, 42, 0.92)";

// ─── Shared chart defaults ────────────────────────────────────────────────────

const sharedTooltip = {
  backgroundColor: TOOLTIP_BG,
  titleColor:      "#f1f5f9",
  bodyColor:       "#cbd5e1",
  borderColor:     "#334155",
  borderWidth:     1,
  padding:         10,
  cornerRadius:    8,
};

const sharedAxisX = {
  grid:  { display: false },
  ticks: { color: SLATE_TICK, font: { size: 11 } },
};

const sharedAxisY = {
  beginAtZero: true,
  grid:        { color: SLATE_GRID },
  ticks:       { color: SLATE_TICK, font: { size: 11 } },
};

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
  const lineData = useMemo(() => ({
    labels,
    datasets: [{
      label:                "Alunos matriculados",
      data:                 dadosAlunos,
      borderWidth:          2.5,
      borderColor:          KLASSE_GREEN,
      backgroundColor:      `${KLASSE_GREEN}18`,
      tension:              0.4,
      pointRadius:          4,
      pointBackgroundColor: KLASSE_GREEN,
      pointBorderColor:     "#ffffff",
      pointBorderWidth:     2,
      fill:                 true,
    }],
  }), [labels, dadosAlunos]);

  const lineOptions = useMemo(() => ({
    responsive:          true,
    maintainAspectRatio: false as const,
    plugins: {
      legend: {
        display:  true,
        position: "top" as const,
        labels:   { usePointStyle: true, padding: 14, color: SLATE_TICK, font: { size: 11 } },
      },
      tooltip: { ...sharedTooltip, mode: "index" as const, intersect: false },
    },
    scales: { x: sharedAxisX, y: sharedAxisY },
  }), []);

  // ── Bar chart (mensalidades) ───────────────────────────────────────────────
  const barData = useMemo(() => {
    const r = resumo ?? { pago: 0, pendente: 0, inadimplente: 0 };
    return {
      labels: ["Pago", "Pendente", "Inadimplente"],
      datasets: [{
        label:           "Mensalidades",
        data:            [r.pago, r.pendente, r.inadimplente],
        // Klasse-aligned palette: green / gold / rose
        backgroundColor: [`${KLASSE_GREEN}cc`, `${KLASSE_GOLD}cc`, "rgba(239,68,68,0.75)"],
        borderColor:     [KLASSE_GREEN,          KLASSE_GOLD,          "#dc2626"],
        borderWidth:     1.5,
        borderRadius:    6,
      }],
    };
  }, [resumo]);

  const barOptions = useMemo(() => ({
    responsive:          true,
    maintainAspectRatio: false as const,
    plugins: {
      legend:  { display: false },
      tooltip: sharedTooltip,
    },
    scales: {
      x: sharedAxisX,
      y: {
        ...sharedAxisY,
        ticks: {
          ...sharedAxisY.ticks,
          // Let Chart.js auto-calculate stepSize — avoids broken scale on large values
          precision: 0,
        },
      },
    },
  }), []);

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
          {hasLineData ? <Line data={lineData} options={lineOptions} /> : <EmptyState />}
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
          {resumo ? <Bar data={barData} options={barOptions} /> : <EmptyState />}
        </div>
      </ChartCard>

    </div>
  );
}