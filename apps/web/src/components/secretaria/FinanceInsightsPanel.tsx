"use client";

import type { FinanceInsight } from "@/hooks/useFinanceInsights";

type FinanceInsightsPanelProps = {
  insights: FinanceInsight[];
  onAction: (targetId: string, monthKey?: string) => void;
};

export function FinanceInsightsPanel({
  insights,
  onAction,
}: FinanceInsightsPanelProps) {
  if (insights.length === 0) return null;

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm print:hidden">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Tesoureiro Inteligente</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">Insights automáticos do período</h2>
          <p className="mt-1 text-sm text-slate-500">
            O sistema destaca o que merece ação imediata, sem obrigar a leitura linha a linha.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {insights.map((insight) => {
          const toneClasses =
            insight.tone === "rose"
              ? "border-rose-200 bg-rose-50/70 text-rose-900"
              : insight.tone === "emerald"
                ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
                : insight.tone === "amber"
                  ? "border-amber-200 bg-amber-50/80 text-amber-950"
                  : "border-sky-200 bg-sky-50/80 text-sky-950";

          const buttonClasses =
            insight.tone === "rose"
              ? "bg-rose-900 text-white hover:bg-rose-800"
              : insight.tone === "emerald"
                ? "bg-emerald-900 text-white hover:bg-emerald-800"
                : insight.tone === "amber"
                  ? "bg-amber-900 text-white hover:bg-amber-800"
                  : "bg-sky-900 text-white hover:bg-sky-800";

          return (
            <div key={insight.id} className={`rounded-3xl border p-4 shadow-sm ${toneClasses}`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-75">{insight.kicker}</p>
              <h3 className="mt-3 text-base font-semibold">{insight.title}</h3>
              <p className="mt-2 text-sm leading-relaxed opacity-90">{insight.message}</p>
              <button
                type="button"
                onClick={() => onAction(insight.targetId, insight.monthKey)}
                className={`mt-4 inline-flex rounded-full px-4 py-2 text-xs font-semibold transition ${buttonClasses}`}
              >
                {insight.actionLabel}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
