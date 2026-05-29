"use client";

import React from "react";
import { QuickViewTimeline } from "@/components/secretaria/QuickViewTimeline";
import { FinanceInsightsPanel } from "@/components/secretaria/FinanceInsightsPanel";
import { FinancialHealthInsightsPanel } from "@/components/secretaria/FinancialHealthInsightsPanel";
import { BoardExecutivePanel } from "@/components/secretaria/BoardExecutivePanel";
import { BoardPressurePanel } from "@/components/secretaria/BoardPressurePanel";
import { RecoveryCalculator } from "./RecoveryCalculator";
import { ResumoFinanceiro, PorTurma, InadimplenciaClasseItem } from "./types";
import { kwanza } from "./utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface TabResumoProps {
  availableMonths: any[];
  selectedMonth: string;
  selectedMonthLabel: string;
  setSelectedMonth: (m: string) => void;
  resumo: ResumoFinanceiro;
  prevResumo?: ResumoFinanceiro | null;
  anoLetivoAtivo: number;
  highlightedDebtMonth: string;
  onOpenInsight: (target: string, month?: string) => void;
  insights: any[];
  boardMode: boolean;
  financialInsights: any[];
  healthScore: number;
  totalEntradasResultado: number;
  totalSaidasResultado: number;
  saldoFinalResultado: number;
  diamondTurmas: PorTurma[];
  executiveHighlights: InadimplenciaClasseItem[];
}

function TrendIndicator({ 
  current, 
  previous, 
  inverse = false,
  format = "currency" 
}: { 
  current: number; 
  previous?: number; 
  inverse?: boolean;
  format?: "currency" | "percent" | "number"
}) {
  if (previous === undefined || previous === null || previous === 0 || current === previous) {
    return null;
  }

  const diff = current - previous;
  const pct = (diff / previous) * 100;
  const isPositive = diff > 0;
  
  // Para 'Atraso', positivo (aumento) é ruim (vermelho)
  const isGood = inverse ? !isPositive : isPositive;

  return (
    <div className={`mt-2 flex items-center gap-1 text-[10px] font-bold ${isGood ? "text-emerald-600" : "text-rose-600"}`}>
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      <span>{Math.abs(pct).toFixed(1)}% vs mês ant.</span>
    </div>
  );
}

export function TabResumo({
  availableMonths,
  selectedMonth,
  selectedMonthLabel,
  setSelectedMonth,
  resumo,
  prevResumo,
  anoLetivoAtivo,
  highlightedDebtMonth,
  onOpenInsight,
  insights,
  boardMode,
  financialInsights,
  healthScore,
  totalEntradasResultado,
  totalSaidasResultado,
  saldoFinalResultado,
  diamondTurmas,
  executiveHighlights,
}: TabResumoProps) {
  return (
    <div className="space-y-4">
      <QuickViewTimeline
        months={availableMonths}
        selectedMonth={selectedMonth}
        selectedMonthLabel={selectedMonthLabel}
        onSelectMonth={setSelectedMonth}
        onResetMonth={() => setSelectedMonth("all")}
        formatCurrency={kwanza.format}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 print:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:rounded-xl print:shadow-none">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Ano letivo</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{anoLetivoAtivo}</p>
          <p className="mt-1 text-xs text-slate-500">{resumo.mensalidades} mensalidades no período</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:rounded-xl print:shadow-none">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Previsto</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{kwanza.format(resumo.previsto)}</p>
          <TrendIndicator current={resumo.previsto} previous={prevResumo?.previsto} />
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm print:rounded-xl print:shadow-none">
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-700">Pago</p>
          <p className="mt-2 text-2xl font-bold text-emerald-800">{kwanza.format(resumo.pago)}</p>
          <TrendIndicator current={resumo.pago} previous={prevResumo?.pago} />
        </div>
        <button
          type="button"
          onClick={() => {
            if (highlightedDebtMonth !== "all") onOpenInsight("inadimplencia-por-classe", highlightedDebtMonth);
            else onOpenInsight("inadimplencia-por-classe");
          }}
          className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md print:pointer-events-none print:rounded-xl print:shadow-none"
        >
          <p className="text-xs uppercase tracking-[0.18em] text-rose-700">Em atraso</p>
          <p className="mt-2 text-2xl font-bold text-rose-800">{kwanza.format(resumo.atraso)}</p>
          <TrendIndicator current={resumo.atraso} previous={prevResumo?.atraso} inverse />
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 print:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:rounded-xl print:shadow-none">
          <p className="text-xs uppercase tracking-wide text-slate-400">Pagas adiantadas</p>
          <p className="mt-2 text-xl font-bold text-sky-700">{resumo.pagasAdiantadas}</p>
          <TrendIndicator current={resumo.pagasAdiantadas} previous={prevResumo?.pagasAdiantadas} />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:rounded-xl print:shadow-none">
          <p className="text-xs uppercase tracking-wide text-slate-400">Parciais</p>
          <p className="mt-2 text-xl font-bold text-amber-700">{resumo.parciais}</p>
          <TrendIndicator current={resumo.parciais} previous={prevResumo?.parciais} inverse />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:rounded-xl print:shadow-none">
          <p className="text-xs uppercase tracking-wide text-slate-400">Saldo parcial</p>
          <p className="mt-2 text-xl font-bold text-amber-800">{kwanza.format(resumo.parcialEmAberto)}</p>
          <TrendIndicator current={resumo.parcialEmAberto} previous={prevResumo?.parcialEmAberto} inverse />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:rounded-xl print:shadow-none">
          <p className="text-xs uppercase tracking-wide text-slate-400">Taxa de atraso</p>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {resumo.taxaAtrasoPct.toFixed(1)}%
          </p>
          <TrendIndicator current={resumo.taxaAtrasoPct} previous={prevResumo?.taxaAtrasoPct} inverse />
        </div>
      </div>

      <FinanceInsightsPanel insights={insights} onAction={onOpenInsight} />

      {boardMode && (
        <div className="grid gap-4 lg:grid-cols-[1fr_0.7fr_0.3fr] print:hidden">
          <BoardExecutivePanel
            financialInsights={financialInsights}
            formatCurrency={kwanza.format}
            healthScore={healthScore}
            saldoFinalResultado={saldoFinalResultado}
            selectedMonthLabel={selectedMonthLabel}
            totalEntradasResultado={totalEntradasResultado}
            totalSaidasResultado={totalSaidasResultado}
            totalAtraso={resumo.atraso}
            renderInsights={<FinancialHealthInsightsPanel insights={financialInsights} />}
          />

          <BoardPressurePanel
            diamondTurmas={diamondTurmas}
            executiveHighlights={executiveHighlights}
            formatCurrency={kwanza.format}
            totalAtraso={resumo.atraso}
          />

          <RecoveryCalculator totalAtraso={resumo.atraso} />
        </div>
      )}
    </div>
  );
}
