"use client";

import type { FinancialHealthInsight } from "@/hooks/useFinancialHealthInsights";

type FinancialHealthInsightsPanelProps = {
  insights: FinancialHealthInsight[];
};

export function FinancialHealthInsightsPanel({
  insights,
}: FinancialHealthInsightsPanelProps) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Insights Automáticos</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {insights.map((insight, index) => (
          <div
            key={`${insight.type}-${index}`}
            className={`flex items-start gap-3 rounded-2xl border p-4 transition hover:shadow-sm ${
              insight.type === "success"
                ? "border-emerald-100 bg-emerald-50/30"
                : insight.type === "warning"
                  ? "border-rose-100 bg-rose-50/30"
                  : insight.type === "goal"
                    ? "border-sky-100 bg-sky-50/30"
                    : "border-slate-100 bg-slate-50/30"
            }`}
          >
            <div
              className={`mt-0.5 rounded-full p-1.5 ${
                insight.type === "success"
                  ? "bg-emerald-100 text-emerald-600"
                  : insight.type === "warning"
                    ? "bg-rose-100 text-rose-600"
                    : insight.type === "goal"
                      ? "bg-sky-100 text-sky-600"
                      : "bg-slate-200 text-slate-600"
              }`}
            >
              <insight.icon className="h-4 w-4" />
            </div>
            <p
              className={`text-sm leading-relaxed ${
                insight.type === "success"
                  ? "text-emerald-900"
                  : insight.type === "warning"
                    ? "text-rose-900"
                    : insight.type === "goal"
                      ? "text-sky-900"
                      : "text-slate-900"
              }`}
            >
              {insight.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
