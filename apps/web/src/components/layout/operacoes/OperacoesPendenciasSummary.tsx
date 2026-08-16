"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertCircle, ClipboardCheck, FileText, RefreshCw } from "lucide-react";
import { useUserRoleContext } from "@/components/auth/UserRoleProvider";

type AulaResponse = { ok: boolean; items?: Array<{ status: string | null }>; summary?: Record<string, number> };
type CountResponse = { ok: boolean; items?: unknown[] };

type PendingSummary = {
  aulasAguardando: number;
  aulasAndamento: number;
  relatoriosRecebidos: number;
  planosRevisao: number;
  reaberturasNotas: number;
};

const EMPTY: PendingSummary = {
  aulasAguardando: 0,
  aulasAndamento: 0,
  relatoriosRecebidos: 0,
  planosRevisao: 0,
  reaberturasNotas: 0,
};

function todayInLuanda() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Luanda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function OperacoesPendenciasSummary() {
  const { userRole } = useUserRoleContext();
  const [summary, setSummary] = useState<PendingSummary>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const date = todayInLuanda();
      const [aulasRes, planosRes, reaberturasRes] = await Promise.all([
        fetch(`/api/secretaria/aulas?data=${date}`, { cache: "no-store" }),
        fetch("/api/secretaria/planos-aula", { cache: "no-store" }),
        fetch("/api/secretaria/notas/reabertura", { cache: "no-store" }),
      ]);
      const [aulas, planos, reaberturas] = await Promise.all([
        aulasRes.json() as Promise<AulaResponse>,
        planosRes.json() as Promise<CountResponse>,
        reaberturasRes.json() as Promise<CountResponse>,
      ]);
      if (!aulasRes.ok || !aulas.ok || !planosRes.ok || !planos.ok || !reaberturasRes.ok || !reaberturas.ok) {
        throw new Error("Não foi possível atualizar as pendências operacionais.");
      }
      const aulaSummary = aulas.summary ?? {};
      setSummary({
        aulasAguardando: aulaSummary.aguardando_confirmacao ?? 0,
        aulasAndamento: aulaSummary.em_andamento ?? 0,
        relatoriosRecebidos: aulaSummary.finalizada ?? 0,
        planosRevisao: planos.items?.length ?? 0,
        reaberturasNotas: reaberturas.items?.length ?? 0,
      });
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar as pendências operacionais.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const cards = useMemo(() => [
    { id: "operacoes-aulas", label: "Aulas aguardando confirmação", value: summary.aulasAguardando, hint: `${summary.aulasAndamento} em andamento`, icon: Activity, tone: "warning" },
    { id: "operacoes-planos-revisao", label: "Planos para revisar", value: summary.planosRevisao, hint: "Secretaria e gestão pedagógica", icon: FileText, tone: "default" },
    { id: "operacoes-reabertura-notas", label: "Reaberturas de notas", value: summary.reaberturasNotas, hint: "Decisões pendentes", icon: ClipboardCheck, tone: "default" },
    { id: "operacoes-relatorios", label: "Relatórios recebidos", value: summary.relatoriosRecebidos, hint: "Aulas finalizadas hoje", icon: AlertCircle, tone: "success" },
  ] as const, [summary]);

  const profileQueues = useMemo(() => [
    {
      label: "Secretaria",
      description: "Acompanhamento académico e retornos",
      count: summary.aulasAguardando + summary.planosRevisao + summary.reaberturasNotas,
      active: userRole === "secretaria",
    },
    {
      label: "Admin escola",
      description: "Visão completa da operação escolar",
      count: summary.aulasAguardando + summary.aulasAndamento + summary.planosRevisao + summary.reaberturasNotas,
      active: userRole === "admin",
    },
    {
      label: "Admin financeiro",
      description: "Acompanhamento transversal autorizado",
      count: summary.aulasAguardando + summary.planosRevisao + summary.reaberturasNotas,
      active: userRole === "financeiro" || userRole === "operacoes",
    },
  ], [summary, userRole]);

  const focus = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6" aria-label="Pendências operacionais">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-klasse-green">Visão operacional</p>
          <h2 className="mt-1 text-lg font-black text-slate-900">O que precisa de atenção agora</h2>
          <p className="mt-1 text-sm text-slate-500">Atalhos compartilhados para secretaria, gestão escolar e financeiro.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={refreshing} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </header>
      {loading ? <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{cards.map((card) => <div key={card.id} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}</div> : error ? (
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700"><p className="font-bold">{error}</p><button type="button" onClick={() => void load()} className="mt-2 font-black underline">Tentar novamente</button></div>
      ) : <>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{cards.map((card) => {
          const Icon = card.icon;
          const tone = card.tone === "warning"
            ? "border-klasse-gold/30 bg-klasse-gold/5 text-klasse-gold-700"
            : card.tone === "success"
              ? "border-slate-200 bg-white text-klasse-green"
              : "border-slate-200 bg-white text-slate-600";
          const iconTone = card.tone === "warning"
            ? "bg-klasse-gold/15 text-klasse-gold-700"
            : card.tone === "success"
              ? "bg-klasse-green/10 text-klasse-green"
              : "bg-slate-100 text-slate-600";
          return <button key={card.id} type="button" onClick={() => focus(card.id)} className={`rounded-xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tone}`}>
            <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconTone}`}><Icon className="h-4 w-4" /></span>
            <p className="mt-3 text-2xl font-black text-slate-900">{card.value}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">{card.label}</p>
            <p className="mt-1 text-[11px] font-medium text-slate-400">{card.hint}</p>
          </button>;
        })}</div>
        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
          <div className="mb-2 flex items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Fila por perfil</p><p className="text-[11px] text-slate-400">Ações pendentes no contexto autorizado</p></div>
          <div className="grid gap-2 md:grid-cols-3">{profileQueues.map((queue) => <div key={queue.label} className={`rounded-lg border bg-white px-3 py-2 ${queue.active ? "border-klasse-green/30 ring-2 ring-klasse-green/10" : "border-slate-100"}`}><div className="flex items-center justify-between gap-2"><p className="text-xs font-black text-slate-800">{queue.label}{queue.active ? " · você" : ""}</p><span className="text-lg font-black text-slate-900">{queue.count}</span></div><p className="mt-1 text-[11px] text-slate-500">{queue.description}</p></div>)}</div>
        </div>
      </>}
    </section>
  );
}
