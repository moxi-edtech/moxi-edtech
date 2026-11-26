"use client";

import { PortalSheet } from "@/components/portal/ui/PortalSheet";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";
import { ProfessorCalendarSkeleton } from "@/components/professor/ProfessorLoadingSkeletons";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref, getEscolaParamFromPath } from "@/lib/navigation";
import {
  AlertCircle,
  CalendarDays,
  Printer,
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
  const [showPeriodsOnMobile, setShowPeriodsOnMobile] = useState(false);
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventOpen, setEventOpen] = useState(false);
  const selectedEvent = items.find(item => item.id === eventId) ?? null;
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
    () => items.filter((item) => item.data_fim >= todayIso).sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))[0] ?? null,
    [items, todayIso]
  );

  const upcomingItems = useMemo(
    () => items.filter((item) => item.data_fim >= todayIso),
    [items, todayIso]
  );

  const pastEventsCount = items.filter((item) => item.data_fim < todayIso).length;

  const eventGroups = useMemo<EventGroup[]>(() => {
    const groups = new Map<string, EventGroup>();

    for (const item of [...items].sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))) {
      if (!showPastEvents && item.data_fim < todayIso) continue;
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
  }, [items, showPastEvents, todayIso]);

  const periodContent = (<>
                {periodos.length === 0 ? (
                  <div className="mt-6 rounded-2xl border border-dashed border-border bg-muted p-4 text-sm font-medium text-muted-foreground">
                    Os períodos lectivos ainda não foram configurados para este ano.
                  </div>
                ) : (
                  <div className="mt-3 space-y-2 sm:mt-6 sm:space-y-3">
                    {periodos.map((periodo) => {
                      const isActive = periodo.data_inicio <= todayIso && periodo.data_fim >= todayIso;
                      return (
                        <div
                          key={periodo.id}
                          className={`rounded-xl border p-3 transition sm:rounded-2xl sm:p-4 ${
                            isActive ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40" : "border-border bg-muted"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-black text-foreground">{getPeriodLabel(periodo)}</p>
                              <p className="mt-1 text-xs font-medium text-muted-foreground">
                                {formatDateRange(periodo.data_inicio, periodo.data_fim)}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                                isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200" : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {isActive ? "Em curso" : periodo.data_inicio > todayIso ? "A seguir" : "Fechado"}
                            </span>
                          </div>
                          {periodo.trava_notas_em ? (
                            <p className="mt-3 text-[11px] font-semibold text-muted-foreground">
                              Fecho de notas: {formatSingleDate(periodo.trava_notas_em)}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}

                {currentPeriodo ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 p-3 sm:mt-6 sm:rounded-2xl sm:p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">Período actual</p>
                    <p className="mt-2 text-sm font-black text-foreground">{getPeriodLabel(currentPeriodo)}</p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">
                      {formatCompactDateRange(currentPeriodo.data_inicio, currentPeriodo.data_fim)}
                    </p>
                  </div>
                ) : null}
                </>);
  return (
    <div className="min-h-screen bg-background">
      <div className={`${PORTAL_PAGE_INSET} max-md:px-0 max-md:py-0 flex flex-col gap-4 sm:gap-6`}>
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
          <ProfessorCalendarSkeleton />
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
            <div className="grid gap-3 sm:gap-4 lg:grid-cols-[1.4fr_1fr]">
              <section className="min-w-0 rounded-xl border border-border bg-card p-4 text-foreground sm:p-6">
                <div className="space-y-4 sm:space-y-6">
                  <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
                    <div className="space-y-1 sm:space-y-2">
                      <p className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-1 text-[10px] font-semibold text-muted-foreground sm:gap-2 sm:px-3 sm:text-[11px] sm:font-semibold sm:uppercase sm:tracking-[0.18em]">
                        <Sparkles className="h-3.5 w-3.5" />
                        Sincronizado com o portal
                      </p>
                      <h2 className="text-xl font-semibold tracking-tight text-primary sm:text-2xl sm:font-semibold">
                        {anoLetivo ? `Ano Lectivo ${anoLetivo.data_inicio.slice(0, 4)}/${anoLetivo.data_fim.slice(0, 4)}` : "Calendário activo da escola"}
                      </h2>
                      <p className="max-w-2xl text-xs font-medium text-muted-foreground sm:text-sm">
                        {anoLetivo ? (
                          <>
                            <span className="sm:hidden">Período: {anoLetivo.data_inicio.slice(8, 10)}/{anoLetivo.data_inicio.slice(5, 7)}/{anoLetivo.data_inicio.slice(0, 4)} – {anoLetivo.data_fim.slice(8, 10)}/{anoLetivo.data_fim.slice(5, 7)}/{anoLetivo.data_fim.slice(0, 4)}</span>
                            <span className="hidden sm:inline">Período escolar: {formatDateRange(anoLetivo.data_inicio, anoLetivo.data_fim)}.</span>
                          </>
                        ) : "Ainda não há ano letivo activo. Consulta os próximos eventos disponíveis."}
                      </p>
                    </div>
                    <div className="w-full rounded-xl border border-border bg-muted/40 p-3 sm:w-auto sm:rounded-xl sm:p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Próximo marco</p>
                      {nextEvent ? (
                        <div className="mt-2 space-y-1">
                          <p className="text-sm font-semibold leading-snug sm:text-lg sm:font-semibold">{nextEvent.nome}</p>
                          <p className="text-xs font-medium text-muted-foreground">
                            {formatCompactDateRange(nextEvent.data_inicio, nextEvent.data_fim)}
                          </p>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                            {getRelativeLabel(nextEvent.data_inicio, nextEvent.data_fim, todayIso)}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm font-medium text-muted-foreground">Sem eventos futuros registados.</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {[
                      { label: "Eventos no período", value: items.length, icon: CalendarRange },
                      { label: "Próximos eventos", value: upcomingItems.length, icon: Clock3 },
                      { label: "Períodos lectivos", value: periodos.length, icon: GraduationCap },
                    ].map((stat) => (
                      <div key={stat.label} className="min-w-0 rounded-xl border border-border bg-muted/40 p-2 sm:rounded-xl sm:p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-medium leading-tight text-muted-foreground sm:text-[11px] sm:font-semibold sm:uppercase sm:tracking-[0.18em]">{stat.label}</p>
                          <stat.icon className="hidden h-4 w-4 text-muted-foreground sm:block" />
                        </div>
                        <p className="mt-1 text-xl font-semibold tabular-nums text-primary sm:mt-3 sm:text-3xl sm:font-semibold">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <aside className="rounded-xl border border-border bg-card p-4 sm:p-6">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Ritmo lectivo</p>
                    <h2 className="text-sm font-semibold text-foreground sm:text-lg sm:font-black">Períodos do ano</h2>
                  </div>
                  <button type="button" onClick={() => setShowPeriodsOnMobile(true)} aria-haspopup="dialog" aria-expanded={showPeriodsOnMobile} className="ml-auto min-h-10 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground lg:hidden">
                    Ver períodos
                  </button>
                </div>

                <div className="hidden lg:block">{periodContent}</div>
                <PortalSheet open={showPeriodsOnMobile} onClose={() => setShowPeriodsOnMobile(false)} title="Períodos lectivos" description={anoLetivo ? `Ano lectivo ${anoLetivo.data_inicio.slice(0,4)}/${anoLetivo.data_fim.slice(0,4)}` : "Calendário académico"} size="expanded">{periodContent}</PortalSheet>
              </aside>
            </div>

            <section id="avaliacoes" className="space-y-3 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold text-klasse-green">Calendário de Avaliações</h2><a href="/api/professor/calendario?modo=imprimir" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium"><Printer size={16}/> Imprimir calendário</a></div>
              {items.filter(e=>e.tipo==="AVALIACAO_ESCOLAR"&&e.data_fim>=todayIso).slice(0,3).map(e=><div key={e.id} className="border-t border-border pt-2 text-sm"><p className="font-medium">{e.nome}</p><p className="text-xs text-muted-foreground">{e.data_inicio.split("-").reverse().join("/")} · {e.descricao}</p></div>)}
              {!items.some(e=>e.tipo==="AVALIACAO_ESCOLAR"&&e.data_fim>=todayIso)&&<p className="text-sm text-muted-foreground">Nenhuma avaliação próxima na agenda.</p>}
            </section>
            <section className="rounded-xl border border-border bg-card p-3 shadow-sm sm:rounded-[2rem] sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Linha do tempo</p>
                  <h2 className="text-lg font-bold text-foreground sm:text-xl sm:font-black">Calendário do professor</h2>
                </div>
                {pastEventsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowPastEvents((value) => !value)}
                    aria-pressed={showPastEvents}
                    className="inline-flex min-h-10 items-center rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:border-klasse-green"
                  >
                    {showPastEvents ? "Só próximos" : `Ver anteriores (${pastEventsCount})`}
                  </button>
                )}
                <div className="hidden items-center gap-2 rounded-full border border-border bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground sm:inline-flex">
                  <Loader2 className="h-3.5 w-3.5" />
                  Fonte: calendário académico + eventos gerais da escola
                </div>
              </div>

              {eventGroups.length === 0 ? (
                <div className="mt-8 rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
                  <CalendarDays className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-4 text-sm font-black text-foreground">{items.length > 0 ? "Não há próximos eventos." : "Ainda não há eventos sincronizados."}</p>
                  <p className="mt-2 text-sm font-medium text-slate-500">
                    {items.length > 0 ? "Consulta os eventos anteriores para rever o histórico." : "Assim que a secretaria ou o admin actualizarem o calendário oficial, ele aparece aqui automaticamente."}
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-5 sm:mt-8 sm:space-y-8">
                  {eventGroups.map((group) => (
                    <div key={group.key} className="space-y-2 sm:space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-slate-200" />
                        <h3 className="text-xs font-semibold text-muted-foreground sm:text-sm sm:font-black sm:uppercase sm:tracking-[0.18em]">{group.label}</h3>
                        <div className="h-px flex-1 bg-slate-200" />
                      </div>

                      <div className="grid gap-2 sm:gap-4 lg:grid-cols-2">
                        {group.items.map((item) => {
                          const status = getRelativeLabel(item.data_inicio, item.data_fim, todayIso);
                          const eventMonth = capitalize(new Intl.DateTimeFormat(locale, { month: "short" }).format(parseLocalDate(item.data_inicio)));
                          return (
                            <article key={item.id} className="rounded-xl border border-border bg-muted p-3 transition-colors hover:border-ring sm:rounded-[1.5rem] sm:p-5">
                              <div className="flex items-start gap-3">
                                <time dateTime={item.data_inicio} className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-border bg-card px-2 py-2 text-foreground">
                                  <span className="text-xl font-bold leading-none">{item.data_inicio.slice(8, 10)}</span>
                                  <span className="mt-1 text-[11px] font-medium capitalize text-muted-foreground">{eventMonth}</span>
                                </time>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-[10px] font-semibold text-foreground">
                                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                                      {capitalize(getEventTypeLabel(item.tipo))}
                                    </span>
                                    <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{status}</span>
                                  </div>
                                  <h4 className="mt-1.5 text-sm font-semibold leading-snug text-foreground sm:text-lg sm:font-black">{item.nome}</h4>
                                  <p className="mt-1 text-xs font-medium text-muted-foreground">{formatCompactDateRange(item.data_inicio, item.data_fim)}</p>
                                  {item.descricao ? (
                                    <>
                                      <p className="mt-1 hidden text-sm leading-relaxed text-muted-foreground sm:block">{item.descricao}</p>
                                      <button type="button" aria-haspopup="dialog" aria-expanded={eventOpen && eventId === item.id} aria-label={`Ver detalhes de ${item.nome}`} onClick={() => { setEventId(item.id); setEventOpen(true); }} className="mt-1 block min-h-11 w-full rounded-xl text-left text-xs text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-klasse-gold sm:hidden">
                                        <span className="line-clamp-2">{item.descricao}</span>
                                        <span className="mt-1 inline-flex font-semibold text-klasse-green">Ver detalhes</span>
                                      </button>
                                    </>
                                  ) : null}
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
            <PortalSheet open={eventOpen && Boolean(selectedEvent)} onClose={() => setEventOpen(false)}
              title={selectedEvent?.nome ?? "Evento académico"} description={selectedEvent ? formatDateRange(selectedEvent.data_inicio, selectedEvent.data_fim) : "Calendário académico"} size="medium">
              {selectedEvent && <>
                <div className="flex flex-wrap gap-2 text-xs font-medium">
                  <span className="rounded-full bg-muted px-3 py-1">{capitalize(getEventTypeLabel(selectedEvent.tipo))}</span>
                  <span className="rounded-full bg-muted px-3 py-1">{getRelativeLabel(selectedEvent.data_inicio, selectedEvent.data_fim, todayIso)}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{selectedEvent.descricao || "Sem descrição adicional."}</p>
              </>}
            </PortalSheet>
          </>
        )}
      </div>
    </div>
  );
}
