"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type QuickViewMonth = {
  key: string;
  label: string;
  metric: number;
};

type QuickViewTimelineProps = {
  months: QuickViewMonth[];
  selectedMonth: string;
  selectedMonthLabel: string;
  onSelectMonth: (monthKey: string) => void;
  onResetMonth: () => void;
  formatCurrency: (value: number) => string;
};

export function QuickViewTimeline({
  months,
  selectedMonth,
  selectedMonthLabel,
  onSelectMonth,
  onResetMonth,
  formatCurrency,
}: QuickViewTimelineProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [showOverflowHint, setShowOverflowHint] = useState(false);

  const maxMonthMetric = useMemo(
    () => Math.max(...months.map((item) => item.metric), 1),
    [months]
  );

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;

    const updateOverflowHint = () => {
      setShowOverflowHint(node.scrollWidth - node.clientWidth > 16);
    };

    updateOverflowHint();
    window.addEventListener("resize", updateOverflowHint);

    return () => {
      window.removeEventListener("resize", updateOverflowHint);
    };
  }, [months.length]);

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(190,242,100,0.22),_transparent_35%),linear-gradient(135deg,_#0f172a,_#111827_55%,_#1e293b)] p-4 text-white shadow-sm print:hidden sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-lime-200/80">Quick View</p>
          <h2 className="mt-2 text-lg font-semibold sm:text-xl">Filtre o relatório por mês com um toque</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-300">
            {selectedMonth === "all"
              ? "Tudo está consolidado no período completo."
              : `Visualizando ${selectedMonthLabel}. Os blocos abaixo já foram recortados para esta competência.`}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-200">
              {months.length} meses
            </span>
            <span className="rounded-full bg-lime-300/15 px-3 py-1 text-[11px] font-semibold text-lime-100">
              {selectedMonthLabel}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onResetMonth}
          className={`hidden rounded-full px-4 py-2 text-sm font-semibold transition sm:self-start lg:inline-flex lg:self-auto ${
            selectedMonth === "all"
              ? "bg-white text-slate-900"
              : "bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          Tudo
        </button>
      </div>

      <div className="sticky top-2 z-10 -mx-1 mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/65 px-3 py-2 backdrop-blur sm:hidden">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Filtro ativo</p>
          <p className="text-sm font-semibold text-white">{selectedMonthLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {showOverflowHint ? (
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300">
              Arraste para ver mais
            </span>
          ) : null}
          <button
            type="button"
            onClick={onResetMonth}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              selectedMonth === "all"
                ? "bg-white text-slate-900"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            Tudo
          </button>
        </div>
      </div>

      <div className="relative -mx-4 mt-5 sm:mx-0">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-6 bg-gradient-to-r from-slate-950 via-slate-950/70 to-transparent sm:hidden" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-6 bg-gradient-to-l from-slate-950 via-slate-950/70 to-transparent sm:hidden" />
        <div ref={scrollRef} className="overflow-x-auto px-4 pb-2 sm:px-0">
          <div className="flex snap-x snap-mandatory gap-2.5 sm:grid sm:min-w-0 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 xl:grid-cols-7">
            {months.map((item) => {
              const heightPct = Math.max(22, Math.round((item.metric / maxMonthMetric) * 100));
              const isActive = selectedMonth === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onSelectMonth(item.key)}
                  className={`group min-w-[112px] snap-start rounded-2xl border p-2.5 text-left transition duration-200 sm:min-w-0 sm:p-3.5 ${
                    isActive
                      ? "scale-[1.02] border-lime-300 bg-white text-slate-900 shadow-[0_12px_30px_rgba(190,242,100,0.18)]"
                      : "border-white/10 bg-white/5 text-white hover:border-white/20 hover:bg-white/10 hover:translate-y-[-1px]"
                  }`}
                >
                  <div className="flex h-16 items-end sm:h-20">
                    <div
                      className={`w-full rounded-xl transition duration-300 ${
                        isActive ? "bg-lime-300 ring-2 ring-lime-200/50" : "bg-white/50 group-hover:bg-white/70"
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <p className="mt-3 text-sm font-semibold">{item.label}</p>
                  <p className={`mt-1 text-[11px] sm:text-xs ${isActive ? "text-slate-500" : "text-slate-300"}`}>
                    {formatCurrency(item.metric)}
                  </p>
                  {isActive ? (
                    <div className="mt-2 h-1.5 w-10 rounded-full bg-lime-300/80 shadow-[0_0_18px_rgba(190,242,100,0.45)]" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
