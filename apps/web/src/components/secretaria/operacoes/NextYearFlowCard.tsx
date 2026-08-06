"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, Sparkles, TriangleAlert } from "lucide-react";

type FlowState = {
  current_year: number | null;
  next_year: number | null;
  target_year?: { ano?: number } | null;
  steps: {
    next_year_created: boolean;
    academic_structure_ready: boolean;
    intake_window_open: boolean;
    pending_reclassification: number;
    candidates_next_year: number;
  };
  primary_action: { label: string; href: string };
};

const items = [
  ["next_year_created", "Ano letivo preparado"],
  ["academic_structure_ready", "Estrutura académica pronta"],
  ["intake_window_open", "Inscrições e rematrículas abertas"],
] as const;

export function NextYearFlowCard({ href }: { href: (path: string) => string }) {
  const [state, setState] = useState<FlowState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/secretaria/operacoes-academicas/proximo-ano", { cache: "no-store" })
      .then((response) => response.json())
      .then((json) => { if (!cancelled && json?.ok) setState(json); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />A preparar o próximo passo…</div>;
  if (!state) return null;

  const pending = state.steps.pending_reclassification;
  const done = items.filter(([key]) => state.steps[key]).length;
  const action = state.primary_action;

  if (!action?.href) return null;

  return (
    <section className="rounded-2xl border border-[#E3B23C]/30 bg-gradient-to-br from-[#fffdf5] to-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#9a7010]"><Sparkles className="h-4 w-4" /> Próximo ano letivo</div>
          <h2 className="text-lg font-bold text-slate-900">{state.next_year ? `Prepare ${state.next_year} sem saltos` : "Prepare o próximo ano sem saltos"}</h2>
          <p className="mt-1 text-xs text-slate-600">O sistema encontrou o próximo passo mais importante para a escola.</p>
        </div>
        <Link href={href(action.href)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800">{action.label}<ArrowRight className="h-4 w-4" /></Link>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([key, label]) => {
          const ok = state.steps[key];
          return <div key={key} className={`rounded-xl border px-3 py-2 text-xs ${ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
            {ok ? <CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5" /> : <TriangleAlert className="mr-1.5 inline h-3.5 w-3.5" />}{label}
          </div>;
        })}
      </div>
      <p className="mt-3 text-[11px] text-slate-500">{done}/3 etapas principais concluídas{pending > 0 ? ` · ${pending} finalistas aguardam resolução` : ""}{state.steps.candidates_next_year > 0 ? ` · ${state.steps.candidates_next_year} candidaturas no próximo ano` : ""}</p>
    </section>
  );
}
