"use client";

import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref, getEscolaParamFromPath } from "@/lib/navigation";
import {
  AlertCircle,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Loader2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type EventoCalendario = {
  id: string;
  escola_id: string;
  nome: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string;
  tipo: string;
  publico_alvo: string | null;
  cor_hex: string | null;
};

type PeriodoLetivo = {
  id: string;
  ano_letivo_id: string;
  tipo: string | null;
  numero: number | null;
  data_inicio: string;
  data_fim: string;
  trava_notas_em: string | null;
  peso: number | null;
};

type AnoLetivo = {
  id: string;
  ano: number | null;
  ativo: boolean | null;
  data_inicio: string;
  data_fim: string;
};

type CalendarioResponse = {
  ok: boolean;
  error?: string;
  ano_letivo: AnoLetivo | null;
  periodos: PeriodoLetivo[];
  items: EventoCalendario[];
};

type EventGroup = {
  key: string;
  label: string;
  items: EventoCalendario[];
};

const locale = "pt-PT";
const monthFormatter = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
const shortDateFormatter = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" });
const longDateFormatter = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "long", year: "numeric" });

const parseLocalDate = (value: string) => new Date(`${value}T12:00:00`);

const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const formatSingleDate = (value: string) => longDateFormatter.format(parseLocalDate(value));

const formatDateRange = (start: string, end: string) => {
  if (start === end) return formatSingleDate(start);
  return `${formatSingleDate(start)} - ${formatSingleDate(end)}`;
};

const formatCompactDateRange = (start: string, end: string) => {
  if (start === end) return shortDateFormatter.format(parseLocalDate(start));
  return `${shortDateFormatter.format(parseLocalDate(start))} - ${shortDateFormatter.format(parseLocalDate(end))}`;
};

const getEventTypeLabel = (tipo: string) => {
  switch (tipo) {
    case "FERIADO":
      return "Feriado";
    case "EXAMES":
      return "Exames";
    case "PAUSA_ACADEMICA":
      return "Pausa académica";
    case "INICIO_TRIMESTRE":
      return "Início de trimestre";
    case "FIM_TRIMESTRE":
      return "Fim de trimestre";
    case "MATRICULAS":
      return "Matrículas";
    case "REUNIAO":
      return "Reunião";
    case "EVENTO_GERAL":
      return "Aviso geral";
    default:
      return tipo.split("_").join(" ").toLowerCase();
  }
};

const getPeriodLabel = (periodo: PeriodoLetivo) => {
  const base = periodo.tipo?.split("_").join(" ").toLowerCase() || "Período";
  if (periodo.numero) return `${capitalize(base)} ${periodo.numero}`;
  return capitalize(base);
};

const getRelativeLabel = (start: string, end: string, todayIso: string) => {
  if (start <= todayIso && end >= todayIso) return "Em curso";
  if (start > todayIso) {
    const diffMs = parseLocalDate(start).getTime() - parseLocalDate(todayIso).getTime();
    const diffDays = Math.ceil(diffMs / 86400000);
    if (diffDays <= 1) return "Amanhã";
    return `Em ${diffDays} dias`;
  }
  return "Concluído";
};

export default function ProfessorCalendarioPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<EventoCalendario[]>([]);
  const [periodos, setPeriodos] = useState<PeriodoLetivo[]>([]);
  const [anoLetivo, setAnoLetivo] = useState<AnoLetivo | null>(null);
  const pathname = usePathname();
  const { escolaId, escolaSlug } = useEscolaId();
  const escolaParam = getEscolaParamFromPath(pathname) ?? escolaSlug ?? escolaId;
  const professorHref = (path: string) => buildPortalHref(escolaParam, path);
  const todayIso = useMemo(() => toIsoDate(new Date()), []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/professor/calendario", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as CalendarioResponse | null;

        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || "Falha ao carregar calendário académico.");
        }

        if (!active) return;
        setAnoLetivo(json.ano_letivo ?? null);
        setPeriodos(Array.isArray(json.periodos) ? json.periodos : []);
        setItems(Array.isArray(json.items) ? json.items : []);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Falha ao carregar calendário académico.");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const currentPeriodo = useMemo(
    () => periodos.find((periodo) => periodo.data_inicio <= todayIso && periodo.data_fim >= todayIso) ?? null,
    [periodos, todayIso]
  );

  const nextEvent = useMemo(
    () => items.find((item) => item.data_fim >= todayIso) ?? null,
    [items, todayIso]
  );

  const upcomingItems = useMemo(
    () => items.filter((item) => item.data_fim >= todayIso),
    [items, todayIso]
  );

  const eventGroups = useMemo<EventGroup[]>(() => {
    const groups = new Map<string, EventGroup>();

    for (const item of items) {
      const monthKey = item.data_inicio.slice(0, 7);
      const label = capitalize(monthFormatter.format(parseLocalDate(item.data_inicio)));
      const existing = groups.get(monthKey);
      if (existing) {
        existing.items.push(item);
        continue;
      }

      groups.set(monthKey, { key: monthKey, label, items: [item] });
    }

    return Array.from(groups.values());
  }, [items]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-5 sm:p-6">
        <DashboardHeader
          title="Calendário Académico"
          description="Eventos oficiais, marcos lectivos e janelas académicas sincronizadas com o portal da escola."
          breadcrumbs={[
            { label: "Professor", href: professorHref("/professor") },
            { label: "Calendário" },
          ]}
          actions={
            <Link
              href={professorHref("/professor")}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              <CalendarDays className="h-4 w-4" />
              Voltar ao painel
            </Link>
          }
        />

        {loading ? (
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="h-60 animate-pulse rounded-[2rem] border border-slate-200 bg-white" />
            <div className="h-60 animate-pulse rounded-[2rem] border border-slate-200 bg-white" />
          </div>
        ) : error ? (
          <div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-6 text-rose-900">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5" />
              <div className="space-y-2">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-rose-700">Falha ao sincronizar</p>
                <p className="text-sm font-medium">{error}</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-900 p-6 text-white shadow-xl shadow-slate-900/10">
                <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-klasse-gold/10 blur-3xl" />
                <div className="absolute -bottom-10 left-0 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl" />
                <div className="relative z-10 space-y-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-300">
                        <Sparkles className="h-3.5 w-3.5" />
                        Sincronizado com o portal
                      </p>
                      <h2 className="text-2xl font-black tracking-tight">
                        {anoLetivo?.ano ? `Ano Lectivo ${anoLetivo.ano}` : "Calendário activo da escola"}
                      </h2>
                      <p className="max-w-2xl text-sm font-medium text-slate-300">
                        {anoLetivo
                          ? `Janela oficial entre ${formatDateRange(anoLetivo.data_inicio, anoLetivo.data_fim)}.`
                          : "A escola ainda não definiu um ano lectivo activo; o portal mostra os próximos eventos disponíveis."}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Próximo marco</p>
                      {nextEvent ? (
                        <div className="mt-2 space-y-1">
                          <p className="text-lg font-black">{nextEvent.nome}</p>
                          <p className="text-xs font-medium text-slate-300">
                            {formatCompactDateRange(nextEvent.data_inicio, nextEvent.data_fim)}
                          </p>
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-300">
                            {getRelativeLabel(nextEvent.data_inicio, nextEvent.data_fim, todayIso)}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm font-medium text-slate-300">Sem eventos futuros registados.</p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { label: "Eventos no período", value: items.length, icon: CalendarRange },
                      { label: "Próximos eventos", value: upcomingItems.length, icon: Clock3 },
                      { label: "Períodos lectivos", value: periodos.length, icon: GraduationCap },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{stat.label}</p>
                          <stat.icon className="h-4 w-4 text-white/70" />
                        </div>
                        <p className="mt-3 text-3xl font-black">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <aside className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Ritmo lectivo</p>
                    <h2 className="text-lg font-black text-slate-900">Períodos do ano</h2>
                  </div>
                </div>

                {periodos.length === 0 ? (
                  <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-500">
                    Os períodos lectivos ainda não foram configurados para este ano.
                  </div>
                ) : (
                  <div className="mt-6 space-y-3">
                    {periodos.map((periodo) => {
                      const isActive = periodo.data_inicio <= todayIso && periodo.data_fim >= todayIso;
                      return (
                        <div
                          key={periodo.id}
                          className={`rounded-2xl border p-4 transition ${
                            isActive ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-black text-slate-900">{getPeriodLabel(periodo)}</p>
                              <p className="mt-1 text-xs font-medium text-slate-500">
                                {formatDateRange(periodo.data_inicio, periodo.data_fim)}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                                isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                              }`}
                            >
                              {isActive ? "Em curso" : periodo.data_inicio > todayIso ? "A seguir" : "Fechado"}
                            </span>
                          </div>
                          {periodo.trava_notas_em ? (
                            <p className="mt-3 text-[11px] font-semibold text-slate-600">
                              Fecho de notas: {formatSingleDate(periodo.trava_notas_em)}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}

                {currentPeriodo ? (
                  <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">Período actual</p>
                    <p className="mt-2 text-sm font-black text-slate-900">{getPeriodLabel(currentPeriodo)}</p>
                    <p className="mt-1 text-xs font-medium text-slate-600">
                      {formatCompactDateRange(currentPeriodo.data_inicio, currentPeriodo.data_fim)}
                    </p>
                  </div>
                ) : null}
              </aside>
            </div>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Linha do tempo</p>
                  <h2 className="text-xl font-black text-slate-900">Calendário do professor</h2>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                  <Loader2 className="h-3.5 w-3.5" />
                  Fonte: calendário académico + eventos gerais da escola
                </div>
              </div>

              {eventGroups.length === 0 ? (
                <div className="mt-8 rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
                  <CalendarDays className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-4 text-sm font-black text-slate-700">Ainda não há eventos sincronizados.</p>
                  <p className="mt-2 text-sm font-medium text-slate-500">
                    Assim que a secretaria ou o admin actualizarem o calendário oficial, ele aparece aqui automaticamente.
                  </p>
                </div>
              ) : (
                <div className="mt-8 space-y-8">
                  {eventGroups.map((group) => (
                    <div key={group.key} className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-slate-200" />
                        <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">{group.label}</h3>
                        <div className="h-px flex-1 bg-slate-200" />
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        {group.items.map((item) => {
                          const status = getRelativeLabel(item.data_inicio, item.data_fim, todayIso);
                          return (
                            <article
                              key={item.id}
                              className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-300 hover:bg-white"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-700"
                                      style={{
                                        backgroundColor: `${item.cor_hex ?? "#cbd5e1"}22`,
                                      }}
                                    >
                                      <span
                                        className="h-2 w-2 rounded-full"
                                        style={{ backgroundColor: item.cor_hex ?? "#64748b" }}
                                      />
                                      {capitalize(getEventTypeLabel(item.tipo))}
                                    </span>
                                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                                      {status}
                                    </span>
                                  </div>
                                  <h4 className="text-lg font-black tracking-tight text-slate-900">{item.nome}</h4>
                                  <p className="text-sm font-medium text-slate-500">
                                    {item.descricao || "Evento sincronizado com o calendário oficial da escola."}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-5 flex items-end justify-between gap-4">
                                <div>
                                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Período</p>
                                  <p className="mt-1 text-sm font-semibold text-slate-700">
                                    {formatDateRange(item.data_inicio, item.data_fim)}
                                  </p>
                                </div>
                                <div className="rounded-2xl bg-white px-4 py-3 text-right">
                                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Janela curta</p>
                                  <p className="mt-1 text-sm font-black text-slate-900">
                                    {formatCompactDateRange(item.data_inicio, item.data_fim)}
                                  </p>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
