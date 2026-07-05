"use client";

import Link from "next/link";
import { UsersRound, Megaphone, BarChart3, ChevronRight, Clock, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { WidgetError, WidgetSkeleton } from "@/components/super-admin/WidgetStates";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

type MarketingSummary = {
  total_leads: number;
  active_afiliados: number;
};

type RecentLead = {
  id: string;
  escola: string;
  nome: string;
  score: number;
  created_at: string;
};

type MarketingPayload = {
  ok: boolean;
  summary?: MarketingSummary;
  recent_leads?: RecentLead[];
  error?: string;
};

export default function MarketingSection() {
  const [data, setData] = useState<MarketingPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let canceled = false;
    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/super-admin/marketing/summary", { cache: "no-store" });
        const payload = (await response.json()) as MarketingPayload;
        if (!canceled) setData(payload);
      } catch (error) {
        if (!canceled) setData({ ok: false, error: String(error) });
      } finally {
        if (!canceled) setLoading(false);
      }
    };
    load();
    return () => { canceled = true; };
  }, []);

  if (loading) return <WidgetSkeleton lines={3} />;

  if (!data?.ok || !data.summary) {
    return (
      <WidgetError
        title="Falha ao carregar métricas de Marketing"
        message={data?.error ?? "Dados indisponíveis."}
        nextStep="Verifique a conectividade da API e permissões de acesso ao banco de dados."
      />
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-50 pb-4 mb-2">
        <div>
          <h2 className="text-xl font-bold text-slate-950 flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-klasse-green" />
            Marketing & Parceiros
          </h2>
          <p className="text-sm text-slate-500 font-medium">Pipeline de prospecção e suporte a parceiros.</p>
        </div>
        <div className="flex gap-2">
           <Link href="/super-admin/parceiros" className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
              GERIR PARCEIROS
           </Link>
           <Link href="/super-admin/marketing" className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
              MATERIAIS
           </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl bg-slate-50 p-5 border border-slate-100">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total de Leads (Diagnóstico)</p>
           <p className="text-3xl font-black text-slate-900">{data.summary.total_leads}</p>
        </article>
        <article className="rounded-xl bg-slate-50 p-5 border border-slate-100">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Influencers Ativos</p>
           <p className="text-3xl font-black text-slate-900">{data.summary.active_afiliados}</p>

        </article>
        
        <div className="md:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Últimas Atividades</h3>
            <Link href="/super-admin/onboarding" className="text-[10px] font-bold text-klasse-green hover:underline flex items-center">
              VER PIPELINE COMPLETO <ChevronRight size={10} />
            </Link>
          </div>
          
          <div className="space-y-2">
            {data.recent_leads?.length === 0 ? (
              <p className="text-xs italic text-slate-400">Nenhuma atividade recente.</p>
            ) : (
              data.recent_leads?.map(lead => (
                <div key={lead.id} className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-100 hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <BarChart3 size={14} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{lead.escola}</p>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock size={10} /> {format(new Date(lead.created_at), "dd MMM, HH:mm", { locale: pt })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-black ${lead.score >= 15 ? 'text-emerald-600' : 'text-amber-500'}`}>Score: {lead.score}/20</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
