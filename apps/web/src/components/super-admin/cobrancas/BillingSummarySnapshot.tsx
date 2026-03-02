"use client";

import { useEffect, useState } from "react";

type DashboardSummary = {
  mrr: number;
  arr: number;
  pendentes_comprovativo: number;
  vencidas_gt_7d: number;
};

export default function BillingSummarySnapshot() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/super-admin/billing/dashboard/summary", { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json?.ok) setSummary(json.summary as DashboardSummary);
    };
    load();
  }, []);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-left">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">MRR</p>
        <p className="font-bold text-slate-900">Kz {(summary?.mrr ?? 0).toLocaleString()}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">ARR</p>
        <p className="font-bold text-slate-900">Kz {(summary?.arr ?? 0).toLocaleString()}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Pendentes comprovativo</p>
        <p className="font-bold text-amber-700">{summary?.pendentes_comprovativo ?? 0}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Vencidas {'>'}7d</p>
        <p className="font-bold text-rose-700">{summary?.vencidas_gt_7d ?? 0}</p>
      </div>
    </div>
  );
}
