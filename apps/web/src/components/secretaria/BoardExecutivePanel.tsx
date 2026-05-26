"use client";

import { Activity, AlertCircle, ArrowDownRight, ArrowUpRight } from "lucide-react";

type BoardExecutivePanelProps = {
  financialInsights: Array<{
    type: "success" | "warning" | "info" | "goal";
    text: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
  formatCurrency: (value: number) => string;
  healthScore: number;
  saldoFinalResultado: number;
  selectedMonthLabel: string;
  totalEntradasResultado: number;
  totalSaidasResultado: number;
  totalAtraso: number;
  renderInsights: React.ReactNode;
};

export function BoardExecutivePanel({
  formatCurrency,
  healthScore,
  saldoFinalResultado,
  selectedMonthLabel,
  totalEntradasResultado,
  totalSaidasResultado,
  totalAtraso,
  renderInsights,
}: BoardExecutivePanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Sala de Diretoria</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">Leitura macro do período</h2>
            <p className="mt-1 text-sm text-slate-500">
              {selectedMonthLabel} com foco em saúde financeira e sinais vitais.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Score de Saúde</p>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`text-2xl font-black ${
                    healthScore >= 80 ? "text-emerald-600" : healthScore >= 50 ? "text-amber-500" : "text-rose-600"
                  }`}
                >
                  {healthScore}/100
                </span>
                <Activity
                  className={`h-5 w-5 ${
                    healthScore >= 80 ? "text-emerald-500" : healthScore >= 50 ? "text-amber-500" : "text-rose-500"
                  }`}
                />
              </div>
            </div>
            <div className="h-12 w-px bg-slate-100" />
            <div className="rounded-2xl bg-slate-900 px-4 py-3 text-right text-white">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-300">Saldo acumulado</p>
              <p className="mt-2 text-2xl font-bold">{formatCurrency(saldoFinalResultado)}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {[
            { label: "Entradas", value: totalEntradasResultado, tone: "text-emerald-700 bg-emerald-50", icon: ArrowUpRight },
            { label: "Saidas", value: totalSaidasResultado, tone: "text-rose-700 bg-rose-50", icon: ArrowDownRight },
            { label: "Atraso", value: totalAtraso, tone: "text-amber-800 bg-amber-50", icon: AlertCircle },
          ].map((card) => (
            <div key={card.label} className={`rounded-2xl p-4 ${card.tone}`}>
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide">{card.label}</p>
                <card.icon className="h-4 w-4 opacity-50" />
              </div>
              <p className="mt-2 text-2xl font-bold">{formatCurrency(card.value)}</p>
            </div>
          ))}
        </div>
      </div>

      {renderInsights}
    </div>
  );
}
