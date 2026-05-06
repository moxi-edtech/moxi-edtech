"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, BookOpen, Calendar, CheckCircle2, ChevronRight, Clock, FileText, Megaphone } from "lucide-react";

type AulaPreview = {
  id: string;
  cohort_id: string;
  data: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  status: string;
  conteudo_previsto: string | null;
  conteudo_realizado: string | null;
  horas_ministradas: number | null;
};

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
  aulas_hoje?: AulaPreview[];
  proxima_aula?: AulaPreview | null;
};

type DashboardTask = {
  id: string;
  type: string;
  label: string;
  description: string;
  href: string;
  tone: "primary" | "neutral" | "warning";
};

type DashboardAlert = {
  id: string;
  type: string;
  label: string;
  description: string;
  severity: "high" | "medium" | "low";
};

type AgendaSummary = {
  turmas_atribuidas: number;
  aulas_hoje: number;
  proximas_aulas: AulaPreview[];
  pendencias: {
    presencas: number;
    sumarios: number;
    notas: number;
    materiais: number;
  };
  alertas: {
    baixa_presenca: number;
    notas_baixas: number;
    pagamentos_bloqueantes: number;
  };
};

const emptySummary: AgendaSummary = {
  turmas_atribuidas: 0,
  aulas_hoje: 0,
  proximas_aulas: [],
  pendencias: {
    presencas: 0,
    sumarios: 0,
    notas: 0,
    materiais: 0,
  },
  alertas: {
    baixa_presenca: 0,
    notas_baixas: 0,
    pagamentos_bloqueantes: 0,
  },
};

export default function AgendaClient() {
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [summary, setSummary] = useState<AgendaSummary>(emptySummary);
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/formacao/agenda", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as
          | {
              ok: boolean;
              error?: string;
              items?: AgendaItem[];
              summary?: AgendaSummary;
              tasks?: DashboardTask[];
              alerts?: DashboardAlert[];
            }
          | null;
        if (!res.ok || !json?.ok || !Array.isArray(json.items)) {
          throw new Error(json?.error || "Falha ao carregar agenda");
        }
        setItems(json.items);
        setSummary(json.summary ?? emptySummary);
        setTasks(Array.isArray(json.tasks) ? json.tasks : []);
        setAlerts(Array.isArray(json.alerts) ? json.alerts : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro inesperado");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const aulaHojeItem = items.find((item) => (item.aulas_hoje ?? []).length > 0);
  const aulaHoje = aulaHojeItem?.aulas_hoje?.[0] ?? null;
  const activeItem = aulaHojeItem ?? items.find((item) => isCohortActiveToday(item.formacao_cohorts));
  const totalPendencias =
    summary.pendencias.presencas +
    summary.pendencias.sumarios +
    summary.pendencias.notas +
    summary.pendencias.materiais;
  const totalAlertas =
    summary.alertas.baixa_presenca +
    summary.alertas.notas_baixas +
    summary.alertas.pagamentos_bloqueantes;

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-12">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1F6B3B]/10 text-[#1F6B3B]">
            <Calendar size={24} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">pedagógico</p>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Painel do Formador</h1>
        <p className="mt-2 text-sm text-slate-500 font-medium">
          Aulas, pendências e ações rápidas para operar a formação em sala.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-2">
        <MetricCard icon={<Calendar size={18} />} label="Aulas hoje" value={summary.aulas_hoje} tone="green" />
        <MetricCard icon={<BookOpen size={18} />} label="Turmas" value={summary.turmas_atribuidas} tone="slate" />
        <MetricCard icon={<CheckCircle2 size={18} />} label="Pendências" value={totalPendencias} tone={totalPendencias > 0 ? "amber" : "slate"} />
        <MetricCard icon={<AlertTriangle size={18} />} label="Alertas" value={totalAlertas} tone={totalAlertas > 0 ? "rose" : "slate"} />
      </section>

      {activeItem && (
        <section className="rounded-2xl border border-[#1F6B3B]/20 bg-[#1F6B3B] p-4 text-white shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">aula de hoje</p>
              <h2 className="mt-1 truncate text-lg font-black">
                {activeItem.formacao_cohorts?.curso_nome ?? "Turma atribuída"}
              </h2>
              <p className="mt-1 text-xs font-semibold text-white/75">
                {aulaHoje
                  ? `${formatDate(aulaHoje.data)} · ${formatTimeRange(aulaHoje)}`
                  : "Turma em acompanhamento hoje"}
              </p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <Clock size={20} />
            </div>
          </div>

          <Link
            href={`/formador/turma/${activeItem.cohort_id}${aulaHoje ? `?aula=${aulaHoje.id}&acao=presencas` : ""}`}
            className="mt-4 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-black uppercase tracking-[0.12em] text-[#1F6B3B] active:scale-[0.98]"
          >
            {aulaHoje ? "Abrir presenças" : "Abrir turma"}
            <ChevronRight size={18} />
          </Link>
        </section>
      )}

      {tasks.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">ações rápidas</p>
              <h2 className="text-sm font-black text-slate-900">Trabalho de sala</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {tasks.map((task) => (
              <Link
                key={task.id}
                href={task.href}
                className={`flex min-h-[86px] flex-col justify-between rounded-xl p-3 active:scale-[0.98] ${taskClass(task.tone)}`}
              >
                <div className="flex items-center justify-between gap-2">
                  {taskIcon(task.type)}
                  <ChevronRight size={16} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.1em]">{task.label}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] font-semibold opacity-75">{task.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">pendências</p>
          <h2 className="text-sm font-black text-slate-900">O que falta fechar</h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <PendingCard label="Presenças" value={summary.pendencias.presencas} />
          <PendingCard label="Sumários" value={summary.pendencias.sumarios} />
          <PendingCard label="Notas" value={summary.pendencias.notas} />
          <PendingCard label="Materiais" value={summary.pendencias.materiais} />
        </div>
      </section>

      {alerts.length > 0 && (
        <section className="grid gap-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-2xl border p-4 ${alert.severity === "high" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-sm font-black">{alert.label}</p>
                  <p className="mt-1 text-xs font-semibold opacity-80">{alert.description}</p>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {summary.proximas_aulas.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">próximas aulas</p>
            <h2 className="text-sm font-black text-slate-900">Agenda operacional</h2>
          </div>
          <div className="grid gap-2">
            {summary.proximas_aulas.map((aula) => {
              const item = items.find((candidate) => candidate.cohort_id === aula.cohort_id);
              return (
                <Link
                  key={aula.id}
                  href={`/formador/turma/${aula.cohort_id}?aula=${aula.id}&acao=presencas`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900">{item?.formacao_cohorts?.curso_nome ?? "Aula"}</p>
                    <p className="mt-1 text-[11px] font-bold text-slate-400">
                      {formatDate(aula.data)} · {formatTimeRange(aula)}
                    </p>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-slate-300" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

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
              className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-[#1F6B3B]/20 hover:shadow-lg sm:p-6"
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
                    <span>Início: {formatDate(item.formacao_cohorts?.data_inicio)}</span>
                  </div>
                  <div className="flex items-center justify-end gap-1.5 text-[11px] font-bold text-[#1F6B3B]">
                    <Clock size={14} className="text-[#1F6B3B]/40" />
                    <span>{item.percentual_honorario ?? 0}% de Honorário</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Link
                  href={`/formador/turma/${item.cohort_id}${item.proxima_aula ? `?aula=${item.proxima_aula.id}&acao=presencas` : ""}`}
                  className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[#1F6B3B] px-4 text-xs font-black uppercase tracking-[0.12em] text-white transition-all active:scale-[0.98]"
                >
                  {item.proxima_aula ? "Presenças" : "Abrir turma"} <ChevronRight size={14} />
                </Link>
                <Link
                  href={`/formador/turma/${item.cohort_id}`}
                  className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-slate-50 px-4 text-xs font-black uppercase tracking-[0.12em] text-slate-500 transition-all hover:bg-slate-100"
                >
                  Diário <ChevronRight size={14} />
                </Link>
              </div>
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

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-AO", { day: "2-digit", month: "short" }).format(date);
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: "green" | "slate" | "amber" | "rose";
}) {
  const className = {
    green: "border-[#1F6B3B]/20 bg-[#1F6B3B]/10 text-[#1F6B3B]",
    slate: "border-slate-200 bg-white text-slate-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/70">{icon}</span>
        <strong className="text-2xl font-black">{value}</strong>
      </div>
      <p className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] opacity-75">{label}</p>
    </div>
  );
}

function PendingCard({ label, value }: { label: string; value: number }) {
  return (
    <div className={`rounded-xl border px-3 py-3 ${value > 0 ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-slate-50"}`}>
      <p className={`text-xl font-black ${value > 0 ? "text-amber-700" : "text-slate-500"}`}>{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
    </div>
  );
}

function taskClass(tone: DashboardTask["tone"]) {
  if (tone === "primary") return "bg-[#1F6B3B] text-white";
  if (tone === "warning") return "bg-amber-50 text-amber-800 border border-amber-200";
  return "bg-slate-50 text-slate-700 border border-slate-100";
}

function taskIcon(type: string) {
  if (type === "presenca") return <CheckCircle2 size={18} />;
  if (type === "material") return <FileText size={18} />;
  if (type === "aviso") return <Megaphone size={18} />;
  return <BookOpen size={18} />;
}

function formatTimeRange(aula: AulaPreview) {
  const inicio = aula.hora_inicio?.slice(0, 5);
  const fim = aula.hora_fim?.slice(0, 5);
  if (inicio && fim) return `${inicio}-${fim}`;
  return inicio || fim || "Horário por definir";
}

function isCohortActiveToday(cohort: AgendaItem["formacao_cohorts"]) {
  if (!cohort?.data_inicio || !cohort.data_fim) return false;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Luanda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return cohort.data_inicio <= today && cohort.data_fim >= today;
}

function statusPill(status: string) {
  const value = String(status).toLowerCase();
  if (value.includes("andamento") || value.includes("curso")) return "bg-emerald-50 text-emerald-600 border border-emerald-100";
  if (value.includes("cancel")) return "bg-rose-50 text-rose-600 border border-rose-100";
  if (value.includes("concl")) return "bg-slate-50 text-slate-500 border border-slate-100";
  return "bg-amber-50 text-amber-600 border border-amber-100";
}
