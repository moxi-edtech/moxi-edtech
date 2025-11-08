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
import type { PagamentosResumo } from "./definitions";
import { MESES_PT_CURTOS } from "./definitions";

// registra no cliente
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
);

// import dinâmico p/ evitar SSR
const Line = dynamic(() => import("react-chartjs-2").then(m => m.Line), { ssr: false });
const Bar = dynamic(() => import("react-chartjs-2").then(m => m.Bar), { ssr: false });

interface ChartsSectionProps {
  meses?: string[];            // labels dos meses
  alunosPorMes?: number[];     // dados da linha
  pagamentos?: PagamentosResumo; // dados do gráfico de barras
}

export default function ChartsSection({
  meses,
  alunosPorMes,
  pagamentos,
}: ChartsSectionProps) {
  const labels = useMemo(() => meses ?? MESES_PT_CURTOS, [meses]);

  const dadosAlunos = useMemo(
    () =>
      alunosPorMes ?? [12, 18, 22, 30, 28, 35, 40, 44, 50, 55, 58, 60],
    [alunosPorMes]
  );

  const resumo = useMemo(
    () =>
      pagamentos ?? { pago: 120, pendente: 35, inadimplente: 8 },
    [pagamentos]
  );

  const lineData = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: "Alunos matriculados",
          data: dadosAlunos,
          borderWidth: 2,
          // não setamos cor explicitamente para manter paleta do tema/ambiente
          tension: 0.35,
          pointRadius: 3,
        },
      ],
    }),
    [labels, dadosAlunos]
  );

  const lineOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false as const,
      plugins: {
        legend: { display: true },
        tooltip: { mode: "index" as const, intersect: false },
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true },
      },
    }),
    []
  );

  const barData = useMemo(
    () => ({
      labels: ["Pago", "Pendente", "Inadimplente"],
      datasets: [
        {
          label: "Mensalidades",
          data: [resumo.pago, resumo.pendente, resumo.inadimplente],
          borderWidth: 1,
        },
      ],
    }),
    [resumo]
  );

  const barOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false as const,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, ticks: { stepSize: 20 } },
      },
    }),
    []
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-800">Matrículas por mês</h3>
        </div>
        <div className="h-64">
          <Line data={lineData} options={lineOptions} />
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-800">Mensalidades</h3>
        </div>
        <div className="h-64">
          <Bar data={barData} options={barOptions} />
        </div>
      </div>
    </div>
  );
}
