"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertCircle, BookOpen, CheckCircle2, Clock3, Filter, Loader2, RefreshCw, Search, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type AulaItem = {
  id: string;
  data: string;
  inicio_previsto: string | null;
  fim_previsto: string | null;
  inicio_real: string | null;
  fim_real: string | null;
  status: string | null;
  resumo: string | null;
  turma_nome: string | null;
  disciplina_nome: string | null;
  professor_nome: string | null;
  presencas?: { presentes: number; faltas: number; atrasos: number; total: number };
  plano_aula?: { status: string; tema: string | null } | null;
};

type AulaResponse = { ok: boolean; items?: AulaItem[]; summary?: Record<string, number> };
type RealtimeState = "live" | "polling";

const POLLING_MS = 30_000;
const REALTIME_ENABLED = process.env.NEXT_PUBLIC_SUPABASE_REALTIME_ENABLED !== "false";

const statusConfig: Record<string, { label: string; className: string; icon: typeof Clock3 }> = {
  agendada: { label: "Agendada", className: "bg-slate-100 text-slate-600", icon: Clock3 },
  aguardando_confirmacao: { label: "Aguardando confirmação", className: "bg-amber-50 text-amber-700", icon: AlertCircle },
  em_andamento: { label: "Em andamento", className: "bg-emerald-50 text-emerald-700", icon: Activity },
  finalizada: { label: "Finalizada", className: "bg-blue-50 text-blue-700", icon: CheckCircle2 },
  nao_realizada: { label: "Não realizada", className: "bg-rose-50 text-rose-700", icon: AlertCircle },
  cancelada: { label: "Cancelada", className: "bg-slate-100 text-slate-500", icon: AlertCircle },
};

function todayInLuanda() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Luanda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatTime(value: string | null) {
  if (!value) return "--:--";
  const match = value.match(/T?(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : "--:--";
}

function formatStatus(status: string | null) {
  return statusConfig[status ?? ""] ?? { label: status ?? "Sem status", className: "bg-slate-100 text-slate-600", icon: Clock3 };
}

export default function AulasOperacionaisPanel({ escolaId }: { escolaId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<AulaItem[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [realtimeState, setRealtimeState] = useState<RealtimeState>(REALTIME_ENABLED ? "live" : "polling");
  const lastFetchRef = useRef(0);
  const data = todayInLuanda();

  const fetchAulas = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const response = await fetch(`/api/secretaria/aulas?data=${data}`, { cache: "no-store" });
      const payload = (await response.json()) as AulaResponse;
      if (!response.ok || !payload.ok) throw new Error("Não foi possível carregar as aulas de hoje.");
      setItems(payload.items ?? []);
      setSummary(payload.summary ?? {});
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar as aulas de hoje.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [data]);

  const handleRealtime = useCallback(() => {
    const now = Date.now();
    if (now - lastFetchRef.current < 1_500) return;
    lastFetchRef.current = now;
    void fetchAulas(true);
  }, [fetchAulas]);

  useEffect(() => { void fetchAulas(); }, [fetchAulas]);

  useEffect(() => {
    if (!REALTIME_ENABLED) return;
    const channel = supabase
      .channel(`aulas-operacionais-${escolaId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "aulas", filter: `escola_id=eq.${escolaId}` }, () => {
        setRealtimeState("live");
        handleRealtime();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "aula_eventos", filter: `escola_id=eq.${escolaId}` }, () => {
        setRealtimeState("live");
        handleRealtime();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRealtimeState("live");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setRealtimeState("polling");
      });
    return () => { void supabase.removeChannel(channel); };
  }, [escolaId, handleRealtime, supabase]);

  useEffect(() => {
    if (realtimeState !== "polling") return;
    const timer = window.setInterval(() => void fetchAulas(true), POLLING_MS);
    return () => window.clearInterval(timer);
  }, [fetchAulas, realtimeState]);

  const totals = useMemo(() => ({
    total: items.length,
    andamento: summary.em_andamento ?? 0,
    aguardando: summary.aguardando_confirmacao ?? 0,
    finalizadas: summary.finalizada ?? 0,
  }), [items.length, summary]);

  const filteredItems = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("pt");
    return items.filter((aula) => {
      const matchesStatus = statusFilter === "todos" || aula.status === statusFilter;
      const text = [aula.turma_nome, aula.disciplina_nome, aula.professor_nome].filter(Boolean).join(" ").toLocaleLowerCase("pt");
      return matchesStatus && (!normalized || text.includes(normalized));
    });
  }, [items, search, statusFilter]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-klasse-blue-600" />
            <h2 className="text-lg font-black text-slate-900">Aulas de hoje</h2>
            <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${realtimeState === "live" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
              {realtimeState === "live" ? "Ao vivo" : "Atualização periódica"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">Acompanhe confirmações, aulas em andamento e relatórios recebidos.</p>
        </div>
        <button type="button" onClick={() => void fetchAulas()} disabled={refreshing} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[{ label: "Previstas", value: totals.total, icon: BookOpen }, { label: "Aguardando", value: totals.aguardando, icon: AlertCircle }, { label: "Em andamento", value: totals.andamento, icon: Activity }, { label: "Finalizadas", value: totals.finalizadas, icon: CheckCircle2 }].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl bg-slate-50 p-3">
            <Icon className="mb-2 h-4 w-4 text-slate-400" />
            <p className="text-2xl font-black text-slate-900">{value}</p>
            <p className="text-[11px] font-semibold text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="mb-5 flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:flex-row md:items-center">
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar turma, disciplina ou professor" className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none ring-klasse-blue-200 focus:ring-2" /></div>
        <div className="relative md:w-56"><Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none ring-klasse-blue-200 focus:ring-2"><option value="todos">Todos os estados</option>{Object.entries(statusConfig).map(([value, config]) => <option key={value} value={value}>{config.label}</option>)}</select></div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 py-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando aulas...</div>
      ) : error ? (
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center"><BookOpen className="mx-auto mb-2 h-7 w-7 text-slate-300" /><p className="font-bold text-slate-700">Nenhuma aula registada para hoje.</p><p className="mt-1 text-sm text-slate-500">As ocorrências aparecem aqui quando o professor confirmar a aula.</p></div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center"><Search className="mx-auto mb-2 h-7 w-7 text-slate-300" /><p className="font-bold text-slate-700">Nenhuma aula corresponde aos filtros.</p><button type="button" onClick={() => { setSearch(""); setStatusFilter("todos"); }} className="mt-2 text-sm font-bold text-klasse-blue-700 hover:underline">Limpar filtros</button></div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((aula) => {
            const status = formatStatus(aula.status);
            const StatusIcon = status.icon;
            return <div key={aula.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-slate-200 hover:bg-slate-50/60">
              <div className="w-16 shrink-0 text-sm font-black text-slate-700">{formatTime(aula.inicio_previsto)}</div>
              <div className="min-w-[180px] flex-1">
                <p className="font-bold text-slate-900">{aula.turma_nome ?? "Turma não identificada"}</p>
                <p className="text-xs text-slate-500">{aula.disciplina_nome ?? "Disciplina não identificada"} · {aula.professor_nome ?? "Professor não identificado"}</p>
              </div>
              <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${status.className}`}><StatusIcon className="h-3.5 w-3.5" />{status.label}</div>
              <div className="min-w-[170px] text-[11px] text-slate-500">
                {aula.presencas?.total ? <p><span className="font-bold text-emerald-700">{aula.presencas.presentes} presentes</span> · <span className="font-bold text-rose-700">{aula.presencas.faltas} faltas</span>{aula.presencas.atrasos ? ` · ${aula.presencas.atrasos} atrasos` : ""}</p> : <p>Chamada pendente</p>}
                <p className="mt-0.5">Plano: {aula.plano_aula ? `${aula.plano_aula.status}${aula.plano_aula.tema ? ` · ${aula.plano_aula.tema}` : ""}` : "não associado"}</p>
              </div>
              {aula.status === "finalizada" ? <Link href={`/escola/${escolaId}/operacoes/aulas/${aula.id}`} className="text-xs font-bold text-klasse-blue-700 hover:underline">Ver relatório</Link> : <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><Users className="h-3.5 w-3.5" /> Operacional</span>}
            </div>;
          })}
        </div>
      )}
    </section>
  );
}
