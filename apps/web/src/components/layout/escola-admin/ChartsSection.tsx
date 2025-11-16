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

export default function ChartsSection({ meses, alunosPorMes, pagamentos }: ChartsSectionProps) {
  const labels = useMemo(() => meses ?? [], [meses]);
  const dadosAlunos = useMemo(() => alunosPorMes ?? [], [alunosPorMes]);
  const resumo = useMemo(() => pagamentos ?? null, [pagamentos]);

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

  const barData = useMemo(() => {
    const r = resumo ?? { pago: 0, pendente: 0, inadimplente: 0 };
    return {
      labels: ["Pago", "Pendente", "Inadimplente"],
      datasets: [
        {
          label: "Mensalidades",
          data: [r.pago, r.pendente, r.inadimplente],
          borderWidth: 1,
        },
      ],
    };
  }, [resumo]);

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
          {labels.length && dadosAlunos.length ? (
            <Line data={lineData} options={lineOptions} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">Sem dados.</div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-800">Mensalidades</h3>
        </div>
        <div className="h-64">
          {resumo ? (
            <Bar data={barData} options={barOptions} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">Sem dados.</div>
          )}
        </div>
      </div>
    </div>
  );
}
