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
import { BarChart3, TrendingUp, AlertTriangle } from "lucide-react";

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
          borderWidth: 3,
          borderColor: "#0ea5e9",
          backgroundColor: "rgba(14, 165, 233, 0.1)",
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: "#0ea5e9",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2,
          fill: true,
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
        legend: { 
          display: true,
          position: 'top' as const,
          labels: {
            usePointStyle: true,
            padding: 15,
          }
        },
        tooltip: { 
          mode: "index" as const, 
          intersect: false,
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleColor: '#f1f5f9',
          bodyColor: '#f1f5f9',
          borderColor: '#475569',
          borderWidth: 1,
        },
      },
      scales: {
        x: { 
          grid: { 
            display: false,
            color: 'rgba(148, 163, 184, 0.1)'
          },
          ticks: {
            color: '#64748b'
          }
        },
        y: { 
          beginAtZero: true,
          grid: {
            color: 'rgba(148, 163, 184, 0.1)'
          },
          ticks: {
            color: '#64748b'
          }
        },
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
          backgroundColor: [
            'rgba(34, 197, 94, 0.8)',
            'rgba(249, 115, 22, 0.8)',
            'rgba(239, 68, 68, 0.8)'
          ],
          borderColor: [
            '#16a34a',
            '#ea580c',
            '#dc2626'
          ],
          borderWidth: 2,
          borderRadius: 6,
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
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleColor: '#f1f5f9',
          bodyColor: '#f1f5f9',
          borderColor: '#475569',
          borderWidth: 1,
        },
      },
      scales: {
        x: { 
          grid: { 
            display: false,
          },
          ticks: {
            color: '#64748b'
          }
        },
        y: { 
          beginAtZero: true, 
          ticks: { 
            stepSize: 20,
            color: '#64748b'
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.1)'
          },
        },
      },
    }),
    []
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Gráfico de Matrículas */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-moxinexa-navy flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Matrículas por Mês
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Evolução do número de matrículas ao longo do tempo
            </p>
          </div>
        </div>
        <div className="h-64">
          {labels.length && dadosAlunos.length ? (
            <Line data={lineData} options={lineOptions} />
          ) : (
            <div className="flex flex-col h-full items-center justify-center text-slate-500">
              <BarChart3 className="h-12 w-12 text-slate-300 mb-2" />
              <div className="text-sm">Sem dados disponíveis</div>
            </div>
          )}
        </div>
      </div>

      {/* Gráfico de Mensalidades */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-moxinexa-navy flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Status das Mensalidades
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Distribuição atual das situações financeiras
            </p>
          </div>
        </div>
        <div className="h-64">
          {resumo ? (
            <Bar data={barData} options={barOptions} />
          ) : (
            <div className="flex flex-col h-full items-center justify-center text-slate-500">
              <BarChart3 className="h-12 w-12 text-slate-300 mb-2" />
              <div className="text-sm">Sem dados disponíveis</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}