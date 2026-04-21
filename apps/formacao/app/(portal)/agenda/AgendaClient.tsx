"use client";

import { useEffect, useState } from "react";
import { Calendar, BookOpen, Users, Clock, ChevronRight } from "lucide-react";

type AgendaItem = {
  id: string;
  cohort_id: string;
  formador_user_id: string;
  percentual_honorario: number;
  formacao_cohorts: {
    id: string;
    codigo: string;
    nome: string;
    curso_nome: string;
    data_inicio: string;
    data_fim: string;
    status: string;
    carga_horaria_total: number;
    vagas: number;
  } | null;
};

export default function AgendaClient() {
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/formacao/agenda", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as
          | { ok: boolean; error?: string; items?: AgendaItem[] }
          | null;
        if (!res.ok || !json?.ok || !Array.isArray(json.items)) {
          throw new Error(json?.error || "Falha ao carregar agenda");
        }
        setItems(json.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro inesperado");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  return (
    <div className="max-w-lg mx-auto space-y-8 pb-12">
      <header className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1F6B3B]/10 text-[#1F6B3B]">
            <Calendar size={24} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">pedagógico</p>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Minha Agenda</h1>
        <p className="mt-2 text-sm text-slate-500 font-medium">
          Consulte as turmas atribuídas e o seu calendário de sessões.
        </p>
      </header>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 text-sm font-bold">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="h-40 rounded-[2rem] bg-white border border-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <article 
              key={item.id} 
              className="group relative flex flex-col rounded-[2.2rem] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:border-[#1F6B3B]/20"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-[#1F6B3B] group-hover:bg-[#1F6B3B] group-hover:text-white transition-colors">
                  <BookOpen size={24} />
                </div>
                <span className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest ${statusPill(item.formacao_cohorts?.status ?? "")}`}>
                  {item.formacao_cohorts?.status.replace('_', ' ') ?? "-"}
                </span>
              </div>

              <div className="flex-1">
                <h3 className="text-base font-black text-slate-900 leading-tight">
                  {item.formacao_cohorts?.curso_nome ?? "-"}
                </h3>
                <p className="mt-1 text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {item.formacao_cohorts?.nome ?? "-"} ({item.formacao_cohorts?.codigo ?? "-"})
                </p>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                    <Calendar size={14} className="text-slate-300" />
                    <span>Início: {item.formacao_cohorts?.data_inicio ?? "-"}</span>
                  </div>
                  <div className="flex items-center justify-end gap-1.5 text-[11px] font-bold text-[#1F6B3B]">
                    <Clock size={14} className="text-[#1F6B3B]/40" />
                    <span>{item.percentual_honorario ?? 0}% de Honorário</span>
                  </div>
                </div>
              </div>

              <button className="mt-6 flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-slate-50 text-slate-400 font-black text-[10px] uppercase tracking-widest group-hover:bg-[#1F6B3B] group-hover:text-white transition-all">
                Abrir Diário de Turma <ChevronRight size={14} />
              </button>
            </article>
          ))}

          {!loading && items.length === 0 && (
            <div className="py-20 text-center rounded-[2.2rem] bg-white border border-dashed border-slate-200">
              <Calendar size={48} className="mx-auto text-slate-200 mb-4" />
              <p className="text-slate-400 font-bold">Nenhuma turma atribuída no momento.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function statusPill(status: string) {
  const value = String(status).toLowerCase();
  if (value.includes("andamento") || value.includes("curso")) return "bg-emerald-50 text-emerald-600 border border-emerald-100";
  if (value.includes("cancel")) return "bg-rose-50 text-rose-600 border border-rose-100";
  if (value.includes("concl")) return "bg-slate-50 text-slate-500 border border-slate-100";
  return "bg-amber-50 text-amber-600 border border-amber-100";
}
