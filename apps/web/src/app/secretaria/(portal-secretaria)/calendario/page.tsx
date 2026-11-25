"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CalendarDays, CalendarOff, ChevronRight, Plus, Search, Users, BookOpen, RefreshCw } from "lucide-react";
import { usePathname } from "next/navigation";
import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { ModalShell } from "@/components/ui/ModalShell";
import { CALENDAR_ZONE, calendarDate as validDate, calendarDayKey as dateKey, eventStatus, eventCategory, categoryLabels, isScheduledPedagogicalInterruption, type EventStatus, type EventCategory } from "@/lib/academico/calendar-agenda-presentation";

interface Event {
  id: string;
  nome: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string | null;
  tipo: string;
  publico_alvo: string | null;
  offering_id?: string | null;
  curso_nome?: string | null;
}
interface AcademicYear {
  id: string;
  ano: number;
  ativo?: boolean | null;
  data_inicio: string;
  data_fim: string;
}
type Course = { course_id: string; offering_id: string; nome: string; subsistema: string };
const zone = CALENDAR_ZONE;
const monthFormat = new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric", timeZone: zone });
const dayFormat = new Intl.DateTimeFormat("pt-PT", { day: "2-digit", timeZone: zone });
const shortMonth = new Intl.DateTimeFormat("pt-PT", { month: "short", timeZone: zone });
const fullDate = new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "short", year: "numeric", timeZone: zone });
const timeFormat = new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: zone });
const inputClass = "mt-1.5 block w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-klasse-gold focus:outline-none focus:ring-4 focus:ring-klasse-gold/20 disabled:opacity-60";
const primaryClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-klasse-gold px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/30 disabled:opacity-50";
const secondaryClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 disabled:opacity-50";
function searchText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt").trim();
}
function visibleDescription(event: Event) {
  const description = event.descricao?.trim() ?? "";
  if (description === "Evento geral do calendário académico" || (event.offering_id && description.startsWith("Evento do calendário · "))) return "";
  return description;
}
function audienceLabel(value: string | null) {
  const labels: Record<string, string> = { alunos: "Alunos", professores: "Professores", responsaveis: "Encarregados" };
  return value && value.toLowerCase() !== "todos" && value.toLowerCase() !== "curso" ? labels[value.toLowerCase()] ?? value : "";
}
const statusStyles: Record<EventStatus, { label: string; text: string; tile: string }> = {
  scheduled: { label: "Agendado", text: "text-amber-700 dark:text-amber-300", tile: "bg-amber/10 text-amber-700 dark:text-amber-300" },
  ongoing: { label: "Em curso", text: "text-emerald dark:text-emerald-300", tile: "bg-emerald/10 text-emerald dark:text-emerald-300" },
  finished: { label: "Terminado", text: "text-muted-foreground", tile: "bg-muted text-muted-foreground" },
  unknown: { label: "Data indisponível", text: "text-muted-foreground", tile: "bg-muted text-muted-foreground" },
};
function EventRow({ event, now }: { event: Event; now: Date }) {
  const status = eventStatus(event, now);
  const style = statusStyles[status];
  const category = eventCategory(event.tipo);
  const interruption = isScheduledPedagogicalInterruption(event.tipo);
  const start = validDate(event.data_inicio);
  const end = validDate(event.data_fim);
  const description = visibleDescription(event);
  const audience = audienceLabel(event.publico_alvo);
  const hasEnd = start && end && dateKey(start) !== dateKey(end);
  const hasTime = event.tipo === "EVENTO_GERAL" && event.data_inicio.includes("T") && start;
  return (
    <li className="flex min-w-0 items-start gap-4 px-4 py-4 sm:gap-5 sm:px-6">
      <div className={`flex w-14 shrink-0 flex-col items-center justify-center rounded-xl px-2 py-2 ${style.tile}`} aria-hidden="true">
        <span className="text-xl font-semibold leading-6 tabular-nums">{start ? dayFormat.format(start) : "—"}</span>
        <span className="text-xs font-medium capitalize">{start ? shortMonth.format(start).replace(/\.$/, "") : "Data"}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><p className={`min-w-0 flex-1 break-words text-sm font-semibold leading-5 ${status === "finished" ? "text-muted-foreground" : "text-foreground"}`}>{event.nome}</p><span className={`shrink-0 text-xs font-medium ${style.text}`}>{style.label}</span></div>
        <p className="text-sm leading-5 text-muted-foreground">
          {start ? fullDate.format(start) : "Data indisponível"}{hasEnd && end ? " – " + fullDate.format(end) : ""}
          {hasTime && start ? " · " + timeFormat.format(start) + (end && !hasEnd && end.getTime() !== start.getTime() ? " – " + timeFormat.format(end) : "") : ""}
        </p>
        {(category === "holiday" || category === "pause") && <p className="flex items-start gap-1.5 text-xs font-medium text-muted-foreground"><CalendarOff className="mt-0.5 size-3.5 shrink-0 text-emerald dark:text-emerald-300" aria-hidden="true" /><span>{category === "holiday" ? "Feriado" : event.tipo === "FERIAS_ALUNOS" ? "Férias dos alunos" : "Pausa pedagógica"}{interruption ? " · Interrupção pedagógica" : ""}</span></p>}
        {description && <p className="whitespace-pre-wrap break-words text-sm leading-5 text-muted-foreground">{description}</p>}
        {event.offering_id && <p className="flex items-start gap-1.5 text-xs font-medium text-muted-foreground"><BookOpen className="mt-0.5 size-3.5 shrink-0 text-emerald dark:text-emerald-300" aria-hidden="true" /><span>Aplicável ao curso: {event.curso_nome || "Curso identificado"}</span></p>}
        {!event.offering_id && audience && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="size-3.5 text-emerald dark:text-emerald-300" aria-hidden="true" />{audience}</p>}
      </div>
    </li>
  );
}

export default function CalendarioPage() {
  const pathname = usePathname() ?? "";
  const parts = pathname.split("/").filter(Boolean);
  const schoolPortal = parts[0] === "escola" && parts.length >= 3;
  const operacoes = schoolPortal && parts[2] === "operacoes";
  const portalHref = schoolPortal ? "/" + parts.slice(0, 3).join("/") : "/secretaria";
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState("");
  const [resolvedYearId, setResolvedYearId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [courseOfferings, setCourseOfferings] = useState<Course[]>([]);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<"all" | EventStatus>("all");
  const [category, setCategory] = useState<"all" | EventCategory>("all");
  const [now, setNow] = useState(() => new Date());
  const [revision, setRevision] = useState(0);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [inicioAt, setInicioAt] = useState("");
  const [fimAt, setFimAt] = useState("");
  const [publicoAlvo, setPublicoAlvo] = useState("");
  const submitLock = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    setEvents([]);
    setResolvedYearId("");
    const params = new URLSearchParams();
    if (selectedYearId) params.set("ano_letivo_id", selectedYearId);
    if (selectedCourseId) params.set("curso_id", selectedCourseId);
    const query = params.size ? "?" + params.toString() : "";
    void (async () => {
      try {
        const res = await fetch("/api/secretaria/calendario" + query, { cache: "no-store", signal: controller.signal });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao carregar calendário académico.");
        if (!active) return;
        setEvents(Array.isArray(json.items) ? json.items : []);
        setYears(json.anos_letivos || []);
        setCourseOfferings(json.course_offerings || []);
        setResolvedYearId(json.ano_letivo?.id || "");
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Falha ao carregar eventos.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [selectedYearId, selectedCourseId, revision]);

  // Update locally at minute boundaries and when returning to the page.
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("focus", update);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", update); };
  }, []);

  const effectiveYearId = selectedYearId || resolvedYearId;
  const selectedYear = years.find((year) => year.id === effectiveYearId);
  const courses = useMemo(() => [...new Map(courseOfferings.map((item) => [item.course_id, item])).values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt")), [courseOfferings]);
  const filtered = useMemo(() => {
    const q = searchText(search);
    return events.filter((event) => {
      if (period !== "all" && eventStatus(event, now) !== period) return false;
      if (category !== "all" && eventCategory(event.tipo) !== category) return false;
      return !q || searchText([event.nome, visibleDescription(event), event.curso_nome ?? "", categoryLabels[eventCategory(event.tipo)]].join(" ")).includes(q);
    });
  }, [events, search, period, category, now]);
  const groups = useMemo(() => {
    const result = new Map<string, Event[]>();
    for (const event of filtered) {
      const date = validDate(event.data_inicio);
      const key = date ? monthFormat.format(date) : "Data indisponível";
      const items = result.get(key) ?? [];
      items.push(event);
      result.set(key, items);
    }
    return [...result.entries()];
  }, [filtered]);

  const closeModal = () => {
    if (submitLock.current) return;
    setOpen(false);
    setFormError(null);
    window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  };
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitLock.current) return;
    if (!titulo.trim() || !inicioAt || !effectiveYearId || loading) {
      setFormError("Preencha o título e a data de início e selecione um ano lectivo.");
      return;
    }
    if (fimAt && fimAt < inicioAt) {
      setFormError("O fim do evento não pode ser anterior ao início.");
      return;
    }
    submitLock.current = true;
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/secretaria/calendario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: titulo.trim(), descricao: descricao.trim(),
          inicio_at: inicioAt, fim_at: fimAt || null, publico_alvo: publicoAlvo,
          ano_letivo_id: effectiveYearId,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao criar evento.");
      setTitulo(""); setDescricao(""); setInicioAt(""); setFimAt(""); setPublicoAlvo("");
      setOpen(false);
      setNotice("Evento criado com sucesso.");
      setSearch(""); setPeriod("all"); setCategory("all");
      setRevision((value) => value + 1);
      window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Falha ao criar evento.");
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  };

  return (
    <div className={`${PORTAL_PAGE_INSET} space-y-8`}>
      <DashboardHeader title="Calendário escolar" description="Agenda académica e eventos da escola."
        breadcrumbs={[{ label: "Início", href: "/" }, { label: operacoes ? "Operações" : "Secretaria", href: portalHref }, { label: "Calendário" }]}
        actions={<button ref={triggerRef} type="button" className={primaryClass} aria-haspopup="dialog" aria-expanded={open} disabled={loading || Boolean(error) || !effectiveYearId} onClick={() => { setNotice(""); setOpen(true); }}><Plus className="size-4" aria-hidden="true" /> Novo evento</button>}
      />

      <section aria-label="Filtros do calendário" className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="min-w-0 text-sm font-medium text-foreground">Ano lectivo
            <select aria-label="Ano lectivo" value={effectiveYearId} onChange={(e) => { setSelectedYearId(e.target.value); setNotice(""); }} className={inputClass} disabled={loading || saving}>
              {!effectiveYearId && <option value="">Seleccionar ano</option>}
              {years.map((year) => <option key={year.id} value={year.id}>{year.ano}/{year.ano + 1}{year.ativo ? " · activo" : ""}</option>)}
            </select>
          </label>
          <label className="min-w-0 text-sm font-medium text-foreground">Curso
            <select aria-label="Filtrar calendário por curso" value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} className={inputClass} disabled={loading || saving}>
              <option value="">Todos os cursos</option>
              {courses.map((item) => <option key={item.course_id} value={item.course_id}>{item.nome}</option>)}
            </select>
          </label>
        </div>
      </section>

      {notice && <p role="status" className="text-sm font-medium text-emerald dark:text-emerald-300">{notice}</p>}
      <section aria-labelledby="agenda-title" className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="agenda-title" className="text-base font-semibold text-foreground">Eventos e datas importantes</h2>
            {!loading && !error && <p className="mt-1 text-xs text-muted-foreground">{filtered.length} {filtered.length === 1 ? "evento" : "eventos"}{events.length >= 300 ? " · limite de consulta atingido" : ""}</p>}
          </div>
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
            <label className="relative min-w-0 flex-1 sm:w-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input aria-label="Pesquisar eventos" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar eventos" className="w-full min-w-0 rounded-xl border border-border bg-card py-2.5 pl-9 pr-3 text-sm focus:border-klasse-gold focus:outline-none focus:ring-4 focus:ring-klasse-gold/20" />
            </label>
            <div className="flex flex-wrap rounded-xl border border-border bg-card p-1" role="group" aria-label="Estado dos eventos">
              {([["all", "Todos"], ["scheduled", "Agendados"], ["ongoing", "Em curso"], ["finished", "Terminados"]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)} className={`rounded-xl px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-klasse-gold ${period === value ? "bg-emerald/10 text-emerald dark:text-emerald-300" : "text-muted-foreground hover:bg-muted"}`}>{label}</button>)}
            </div>
            <select aria-label="Categoria dos eventos" value={category} onChange={(e) => setCategory(e.target.value as "all" | EventCategory)} className="min-w-0 max-w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm focus:border-klasse-gold focus:outline-none focus:ring-4 focus:ring-klasse-gold/20">
              <option value="all">Todas as categorias</option>
              {Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
        </div>
        {error ? <div role="alert" className="rounded-xl border border-border bg-card p-5 text-sm"><p className="text-red-600 dark:text-red-300">{error}</p><button type="button" className={secondaryClass + " mt-4"} onClick={() => setRevision((value) => value + 1)}><RefreshCw className="size-4" aria-hidden="true" /> Tentar novamente</button></div> :
          loading ? <div role="status" className="space-y-3"><span className="sr-only">A carregar calendário</span>{[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-xl border border-border bg-card motion-safe:animate-pulse" />)}</div> :
          groups.length === 0 ? <div className="rounded-xl border border-border bg-card px-4 py-12 text-center"><CalendarDays className="mx-auto size-8 text-emerald dark:text-emerald-300" aria-hidden="true" /><p className="mt-3 text-sm font-semibold">{search || period !== "all" || category !== "all" ? "Nenhum evento corresponde aos filtros." : "Nenhum evento agendado."}</p>{(search || period !== "all" || category !== "all") && <button type="button" className="mt-3 text-sm font-medium text-emerald underline dark:text-emerald-300" onClick={() => { setSearch(""); setPeriod("all"); setCategory("all"); }}>Limpar filtros</button>}</div> :
          <div className="space-y-6">{groups.map(([month, items]) => <section key={month} className="space-y-3"><h3 className="text-sm font-semibold capitalize text-muted-foreground">{month}</h3><ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-sm">{items.map((event) => <EventRow key={event.id} event={event} now={now} />)}</ul></section>)}</div>
        }
      </section>

      <ModalShell open={open} title="Novo evento" description="Evento geral da escola, independente do filtro de curso." onClose={closeModal}
        footer={<div className="flex flex-wrap justify-end gap-2"><button type="button" className={secondaryClass} disabled={saving} onClick={closeModal}>Cancelar</button><button type="submit" form="calendar-event-form" className={primaryClass} disabled={saving || loading}>{saving ? "A guardar..." : "Guardar evento"}<ChevronRight className="size-4" aria-hidden="true" /></button></div>}>
        <form id="calendar-event-form" onSubmit={handleSubmit} className="space-y-5">
          <p className="text-sm text-muted-foreground">Ano lectivo: {selectedYear ? selectedYear.ano + "/" + (selectedYear.ano + 1) : "—"}</p>
          <label className="block text-sm font-medium">Título<input required autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} className={inputClass} disabled={saving} /></label>
          <label className="block text-sm font-medium">Descrição <span className="font-normal text-muted-foreground">(opcional)</span><textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} className={inputClass} disabled={saving} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="min-w-0 text-sm font-medium">Início<input type="datetime-local" required value={inicioAt} onChange={(e) => setInicioAt(e.target.value)} className={inputClass} disabled={saving} /></label>
            <label className="min-w-0 text-sm font-medium">Fim <span className="font-normal text-muted-foreground">(opcional)</span><input type="datetime-local" min={inicioAt || undefined} value={fimAt} onChange={(e) => setFimAt(e.target.value)} className={inputClass} disabled={saving} /></label>
          </div>
          <label className="block text-sm font-medium">Público-alvo<select value={publicoAlvo} onChange={(e) => setPublicoAlvo(e.target.value)} className={inputClass} disabled={saving}><option value="">Todos</option><option value="alunos">Alunos</option><option value="professores">Professores</option><option value="responsaveis">Encarregados</option></select></label>
          {formError && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{formError}</p>}
        </form>
      </ModalShell>
    </div>
  );
}
