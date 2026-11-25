"use client";

import AssignmentsBanner from "@/components/professor/AssignmentsBanner";
import { ProfessorAgendaSkeleton, ProfessorSkeletonBone, ProfessorTurmasSkeleton } from "@/components/professor/ProfessorLoadingSkeletons";
import ProfessorReopeningRequests from "@/components/professor/ProfessorReopeningRequests";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref, getEscolaParamFromPath } from "@/lib/navigation";
import { formatTurmaDisplayName } from "@/utils/formatters";
import { BookOpen, CalendarDays, ChevronDown, ClipboardCheck, Pencil, RefreshCw, School, UsersRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/feedback/FeedbackSystem";

type AtribItem = {
  turma: { id: string; nome: string | null };
  disciplina: { id: string | null; nome: string | null };
};

type AgendaItem = {
  id?: string | null;
  aula_id?: string | null;
  status?: string | null;
  slot_id?: string | null;
  turma_id?: string | null;
  disciplina_id?: string | null;
  turma_nome: string | null;
  disciplina_nome: string | null;
  sala_nome: string | null;
  dia_semana: number;
  inicio: string;
  fim: string;
};

type PendenciasResumo = {
  avaliacoes_pendentes: number;
  faltas_a_lancar: number;
};

type OverviewInfo = {
  escola_nome: string | null;
  primeiro_nome: string | null;
};

const SCHOOL_TIMEZONE = "Africa/Luanda";

function getSchoolNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHOOL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = `${values.year}-${values.month}-${values.day}`;
  const day = new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
  return {
    date,
    day,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

const dayLabel = (day: number) => {
  switch (day) {
    case 1:
      return "Segunda";
    case 2:
      return "Terça";
    case 3:
      return "Quarta";
    case 4:
      return "Quinta";
    case 5:
      return "Sexta";
    case 6:
      return "Sábado";
    case 7:
      return "Domingo";
    default:
      return "";
  }
};

export default function Page() {
  const [atribs, setAtribs] = useState<AtribItem[]>([]);
  const [academicYearLabel, setAcademicYearLabel] = useState<string | null>(null);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendenciasResumo, setPendenciasResumo] = useState<PendenciasResumo | null>(null);
  const [overview, setOverview] = useState<OverviewInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [startingKey, setStartingKey] = useState<string | null>(null);
  const [finalizingKey, setFinalizingKey] = useState<string | null>(null);
  const [finalizeSummary, setFinalizeSummary] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [expandedTurmaId, setExpandedTurmaId] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const pollingInFlight = useRef(false);
  const pollingFailures = useRef(0);
  const { success, error: toastError } = useToast();
  const pathname = usePathname();
  const { escolaId, escolaSlug } = useEscolaId();
  const escolaParam = getEscolaParamFromPath(pathname) ?? escolaSlug ?? escolaId;
  const professorHref = (path: string) => buildPortalHref(escolaParam, path);

  useEffect(() => {
    const tick = () => { if (!document.hidden) setNowTick(Date.now()); };
    const timer = window.setInterval(tick, 15_000);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        setPendenciasResumo(null);
        const todayIso = getSchoolNow().date;
        const [atribsRes, agendaRes, aulasRes, pendRes, overviewRes] = await Promise.all([
          fetch("/api/professor/atribuicoes", { cache: "no-store" }),
          fetch("/api/professor/agenda", { cache: "no-store" }),
          fetch(`/api/professor/aulas?from=${todayIso}`, { cache: "no-store" }),
          fetch("/api/professor/dashboard/pendencias", { cache: "no-store" }),
          fetch("/api/professor/dashboard/overview", { cache: "no-store" }),
        ]);
        if (![atribsRes, agendaRes, aulasRes].every((response) => response.ok)) throw new Error("Não foi possível consultar as turmas e aulas.");
        const atribsJson = await atribsRes.json().catch(() => null);
        const agendaJson = await agendaRes.json().catch(() => null);
        const aulasJson = await aulasRes.json().catch(() => null);
        const pendJson = await pendRes.json().catch(() => null);
        const overviewJson = await overviewRes.json().catch(() => null);
        if (!atribsJson?.ok || !agendaJson?.ok || !aulasJson?.ok) throw new Error("Dados académicos indisponíveis. Tente novamente.");
        if (!cancelled) {
          setAtribs((atribsJson?.items || []) as AtribItem[]);
          setAcademicYearLabel(typeof atribsJson?.context?.anoLetivoLabel === "string" ? atribsJson.context.anoLetivoLabel : null);
          const actualLessons = (aulasJson?.items || []) as AgendaItem[];
          const actualByKey = new Map(actualLessons.map((lesson) => [`${lesson.turma_id}:${lesson.disciplina_id}:${lesson.slot_id ?? lesson.inicio}`, lesson]));
          setAgenda(((agendaJson?.items || []) as AgendaItem[]).map((item) => {
            const actual = actualByKey.get(`${item.turma_id}:${item.disciplina_id}:${item.slot_id ?? item.inicio}`);
            return actual ? { ...item, aula_id: actual.id, status: actual.status } : item;
          }));
          if (pendRes.ok && pendJson?.ok) {
            setPendenciasResumo({
              avaliacoes_pendentes: Number(pendJson.avaliacoes_pendentes ?? 0),
              faltas_a_lancar: Number(pendJson.faltas_a_lancar ?? 0),
            });
          } else {
            setPendenciasResumo(null);
          }
          if (overviewRes.ok && overviewJson?.ok) {
            setOverview({
              escola_nome: overviewJson.escola_nome ?? null,
              primeiro_nome: overviewJson.primeiro_nome ?? null,
            });
          } else {
            setOverview({ escola_nome: null, primeiro_nome: null });
          }
        }
      } catch (cause) {
        if (!cancelled) setLoadError(cause instanceof Error ? cause.message : "Não foi possível carregar a home do professor.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [retryVersion]);

  useEffect(() => {
    let disposed = false;
    const poll = async () => {
      if (disposed || document.hidden || pollingInFlight.current || loadError) return;
      pollingInFlight.current = true;
      try {
      const todayIso = getSchoolNow().date;
      const response = await fetch(`/api/professor/aulas?from=${todayIso}`, { cache: "no-store" }).catch(() => null);
      const payload = response ? await response.json().catch(() => null) : null;
      if (!response?.ok || !payload?.ok) { pollingFailures.current = Math.min(pollingFailures.current + 1, 5); return; }
      pollingFailures.current = 0;
      if (disposed) return;
      const actualByKey = new Map((payload.items as AgendaItem[]).map((lesson) => [`${lesson.turma_id}:${lesson.disciplina_id}:${lesson.slot_id ?? lesson.inicio}`, lesson]));
      setAgenda((current) => current.map((item) => actualByKey.has(`${item.turma_id}:${item.disciplina_id}:${item.slot_id ?? item.inicio}`) ? { ...item, ...actualByKey.get(`${item.turma_id}:${item.disciplina_id}:${item.slot_id ?? item.inicio}`) } : item));
      } catch { pollingFailures.current = Math.min(pollingFailures.current + 1, 5); }
      finally { pollingInFlight.current = false; }
    };
    // Suspend timers while hidden, resume on focus; never overlap requests.
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (disposed || document.hidden) return;
      timeout = setTimeout(async () => {
        timeout = undefined;
        await poll();
        schedule();
      }, Math.min(30_000 * 2 ** pollingFailures.current, 300_000));
    };
    const onVisible = () => {
      if (timeout !== undefined) clearTimeout(timeout);
      timeout = undefined;
      if (!document.hidden) void poll().finally(schedule);
    };
    document.addEventListener("visibilitychange", onVisible);
    schedule();
    return () => {
      disposed = true;
      if (timeout !== undefined) clearTimeout(timeout);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadError]);

  const loadAgain = () => setRetryVersion((current) => current + 1);

  const startLesson = async (item: AgendaItem) => {
    if (!item.turma_id || !item.disciplina_id) return;
    const key = `${item.turma_id}:${item.disciplina_id}:${item.slot_id ?? item.inicio}`;
    setStartingKey(key);
    try {
      const data = getSchoolNow().date;
      const response = await fetch("/api/professor/aulas/iniciar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ turma_id: item.turma_id, disciplina_id: item.disciplina_id, data, slot_id: item.slot_id ?? undefined, inicio_previsto: item.inicio, fim_previsto: item.fim }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Não foi possível confirmar a aula.");
      const aulaId = payload.aula?.id ?? payload.aula_id ?? null;
      setAgenda((current) => current.map((candidate) => candidate.turma_id === item.turma_id && candidate.disciplina_id === item.disciplina_id && (candidate.slot_id ?? candidate.inicio) === (item.slot_id ?? item.inicio) ? { ...candidate, aula_id: aulaId ?? candidate.aula_id, status: "em_andamento" } : candidate));
      success("Aula confirmada", "A secretaria já pode acompanhar que a aula está em andamento.");
    } catch (cause) {
      toastError("Não foi possível confirmar", cause instanceof Error ? cause.message : "Tente novamente.");
    } finally {
      setStartingKey(null);
    }
  };

  const finalizeLesson = async (item: AgendaItem) => {
    if (!item.aula_id) return;
    setFinalizing(true);
    try {
      const response = await fetch("/api/professor/aulas/finalizar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aula_id: item.aula_id, resumo: finalizeSummary.trim() || null }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Não foi possível finalizar a aula.");
      setAgenda((current) => current.map((candidate) => candidate.aula_id === item.aula_id ? { ...candidate, status: "finalizada" } : candidate));
      setFinalizingKey(null);
      setFinalizeSummary("");
      const attendancePending = payload.report?.attendance_status !== "started";
      success(
        "Aula finalizada",
        attendancePending
          ? "O relatório foi enviado. A chamada ainda está pendente de lançamento."
          : "O relatório foi enviado e já existem registos de chamada para a escola consultar.",
      );
    } catch (cause) {
      toastError("Não foi possível finalizar", cause instanceof Error ? cause.message : "Tente novamente.");
    } finally {
      setFinalizing(false);
    }
  };

  const turmaMap = useMemo(() => {
    const map = new Map<string, { id: string; nome: string | null; disciplinas: string[] }>();
    for (const item of atribs) {
      const turmaId = item.turma?.id || "";
      if (!turmaId) continue;
      const entry = map.get(turmaId) || { id: turmaId, nome: item.turma?.nome ?? null, disciplinas: [] };
      const disciplinaNome = item.disciplina?.nome || "Disciplina";
      if (!entry.disciplinas.includes(disciplinaNome)) entry.disciplinas.push(disciplinaNome);
      map.set(turmaId, entry);
    }
    return Array.from(map.values());
  }, [atribs]);

  const agendaByDay = useMemo(() => {
    const map = new Map<number, AgendaItem[]>();
    for (const item of agenda) {
      const list = map.get(item.dia_semana) || [];
      list.push(item);
      map.set(item.dia_semana, list);
    }
    for (const [day, list] of map.entries()) {
      list.sort((a, b) => a.inicio.localeCompare(b.inicio));
      map.set(day, list);
    }
    return map;
  }, [agenda]);

  const todayKey = useMemo(() => {
    return getSchoolNow(new Date(nowTick)).day;
  }, [nowTick]);

  const aulasHoje = useMemo(() => {
    return agenda.filter((item) => item.dia_semana === todayKey).length;
  }, [agenda, todayKey]);

  const aulaAtiva = useMemo(() => {
    const aulasHojeList = agendaByDay.get(todayKey) || [];
    if (aulasHojeList.length === 0) return null;
    
    const nowMinutes = getSchoolNow(new Date(nowTick)).minutes;

    for (const item of aulasHojeList) {
      if (!item.inicio || !item.fim) continue;
      const [hInicio, mInicio] = item.inicio.split(":").map(Number);
      const [hFim, mFim] = item.fim.split(":").map(Number);
      const inicioMinutes = (hInicio || 0) * 60 + (mInicio || 0);
      const fimMinutes = (hFim || 0) * 60 + (mFim || 0);

      if (nowMinutes >= inicioMinutes && nowMinutes < fimMinutes) {
        return item;
      }
    }
    return null;
  }, [agendaByDay, nowTick, todayKey]);

  const turmasAtivas = turmaMap.length;
  const avaliacoesPendentes = pendenciasResumo?.avaliacoes_pendentes ?? 0;
  const faltasALancar = pendenciasResumo?.faltas_a_lancar ?? 0;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-24">
      <div className="mx-auto max-w-6xl space-y-5 p-3 sm:space-y-8 sm:p-6">
        
        {/* HEADER PREMIUM */}
        <header aria-busy={loading} className="flex flex-col justify-between gap-2 sm:gap-4 md:flex-row md:items-center">
          <div className="space-y-1">
             <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Portal do Professor</span>
             </div>
             <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Olá, {loading ? (
                  <span className="inline-block align-middle"><ProfessorSkeletonBone className="h-6 w-28 motion-safe:animate-pulse sm:h-8" /></span>
                ) : (
                  <span className="text-klasse-green">{overview?.primeiro_nome || "Professor"}</span>
                )}
             </h1>
             <p className="text-sm font-medium text-slate-500">
                {loading ? (
                  <ProfessorSkeletonBone className="h-4 w-52 max-w-full motion-safe:animate-pulse" />
                ) : (
                  overview?.escola_nome || "Bem-vindo de volta ao seu painel académico."
                )}
             </p>
          </div>
          
          <div className="hidden items-center gap-3 sm:flex">
             <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm">
                <School className="w-6 h-6" />
             </div>
             <div className="hidden sm:block">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</p>
                <p className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                   <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Painel académico
                </p>
             </div>
          </div>
        </header>

        {loadError && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
            <p className="font-bold">Não foi possível carregar os dados do professor.</p>
            <p className="mt-1">Nenhuma nota ou presença foi alterada. Verifique a ligação ou as suas permissões.</p>
            <button type="button" onClick={loadAgain} className="mt-3 rounded-lg bg-rose-800 px-4 py-2 font-bold text-white">Tentar novamente</button>
          </div>
        )}
        <AssignmentsBanner loading={loading} hasAssignments={atribs.length > 0} hasError={Boolean(loadError)} academicYearLabel={academicYearLabel} />
        {escolaParam && <Link href={professorHref("/professor/provas")} prefetch={false} className="flex min-h-14 min-w-0 items-center gap-3 rounded-xl border border-border bg-card p-3 transition hover:border-ring focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 sm:p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-klasse-green"><ClipboardCheck className="h-5 w-5" aria-hidden="true" /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-foreground">Provas</span><span className="block text-xs text-muted-foreground">Elaborar, enviar para revisão e consultar</span></span>
          <span className="shrink-0 text-xs font-semibold text-klasse-green">Abrir</span>
        </Link>}
        <ProfessorReopeningRequests assignments={atribs} notesHref={professorHref("/professor/notas")} />

        {/* Aula actual: só mostra o estado real da aula, não presume que já começou. */}
        {aulaAtiva && (
          <section className="rounded-xl border border-klasse-green-700 bg-klasse-green p-3 text-white shadow-sm sm:rounded-[2rem] sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-klasse-green-700/70 text-white sm:h-11 sm:w-11">
                  <CalendarDays className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="rounded-full bg-klasse-green-700/70 px-2 py-0.5 text-[11px] font-semibold text-white">
                      {aulaAtiva.status === "em_andamento" ? "Em andamento" : aulaAtiva.status === "finalizada" ? "Finalizada" : "Aula agora"}
                    </span>
                    <span className="text-xs font-medium tabular-nums text-white/80">
                      {aulaAtiva.inicio} – {aulaAtiva.fim}
                    </span>
                  </div>
                  <h3 className="mt-1 text-sm font-semibold leading-snug text-white sm:text-lg">
                    {aulaAtiva.disciplina_nome} · {formatTurmaDisplayName({ turma_nome: aulaAtiva.turma_nome })}
                  </h3>
                  {aulaAtiva.sala_nome && (
                    <p className="mt-0.5 text-xs text-white/75">Sala {aulaAtiva.sala_nome}</p>
                  )}
                </div>
              </div>
              {aulaAtiva.turma_id && aulaAtiva.disciplina_id && (
                <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                  <Link
                    href={professorHref(`/professor/frequencias?turma_id=${encodeURIComponent(aulaAtiva.turma_id)}&disciplina_id=${encodeURIComponent(aulaAtiva.disciplina_id)}`)}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-klasse-gold px-2.5 py-2 text-xs font-semibold text-klasse-gold-900 transition-colors hover:brightness-95 sm:px-4"
                  >
                    <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                    Fazer chamada
                  </Link>
                  <Link
                    href={professorHref(`/professor/notas?turma_id=${encodeURIComponent(aulaAtiva.turma_id)}&disciplina_id=${encodeURIComponent(aulaAtiva.disciplina_id)}`)}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-klasse-green-700 bg-klasse-green-700/60 px-2.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-klasse-green-700 sm:px-4"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Lançar notas
                  </Link>
                </div>
              )}
            </div>
          </section>
        )}

        {/* RESUMO DE IMPACTO */}
        <section aria-busy={loading} className="relative overflow-hidden rounded-xl bg-klasse-green p-3 text-white shadow-sm sm:rounded-[2rem] sm:p-6">
          {/* Background Elements */}
          <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-amber/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-emerald-500/5 blur-3xl" />
          
          <div className="relative z-10 grid gap-3 sm:gap-8 md:grid-cols-2 lg:grid-cols-4">
             <div className="col-span-full space-y-1 sm:space-y-4 lg:col-span-1">
                <div>
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400/70">Resumo do dia</p>
                   <h2 className="mt-0.5 text-lg font-bold text-white sm:mt-1 sm:text-2xl">Sua Agenda</h2>
                </div>
                <p className="hidden text-xs font-medium leading-relaxed text-white/75 sm:block">
                   Acompanhe suas aulas e tarefas pendentes para manter o ciclo académico em dia.
                </p>
             </div>

             <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4 lg:col-span-3">
                {[
                  { label: "Aulas hoje", value: aulasHoje, color: "text-white" },
                  { label: "Turmas", value: turmasAtivas, color: "text-white" },
                  { label: "Avaliações", value: avaliacoesPendentes, color: "text-amber-400", alert: avaliacoesPendentes > 0 },
                  { label: "Faltas", value: faltasALancar, color: "text-rose-400", alert: faltasALancar > 0 },
                ].map((item) => (
                  <div key={item.label} className="group relative rounded-xl border border-klasse-green-700 bg-klasse-green-700/40 p-2.5 transition-colors hover:bg-klasse-green-700/60 sm:rounded-3xl sm:p-4">
                    <p className="mb-0.5 text-[11px] font-medium text-white/75 sm:mb-1 sm:text-[9px] sm:font-black sm:uppercase sm:tracking-widest">{item.label}</p>
                    <div className="flex items-center gap-2">
                       {loading ? (
                         <ProfessorSkeletonBone inverse className="mt-1 h-6 w-9 motion-safe:animate-pulse sm:h-7" />
                       ) : (
                         <p className={`text-xl font-bold sm:text-2xl ${item.color}`}>{item.value}</p>
                       )}
                       {item.alert && <span className="h-2 w-2 rounded-full bg-current animate-ping" />}
                    </div>
                  </div>
                ))}
             </div>
          </div>
        </section>

        {/* GRID DE OPERAÇÕES */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { 
               title: "Registrar Presenças", 
               desc: "Controle diário de assiduidade", 
               icon: ClipboardCheck, 
               href: "/professor/frequencias",
               color: "from-emerald-500 to-teal-600",
               light: "bg-emerald-50 text-emerald-600"
            },
            { 
               title: "Lançar Notas", 
               desc: "Gestão de avaliações e médias", 
               icon: Pencil, 
               href: "/professor/notas",
               color: "from-amber-500 to-orange-600",
               light: "bg-amber-50 text-amber-600"
            },
            { 
               title: "Materiais de Estudo", 
               desc: "Upload de guias e manuais", 
               icon: BookOpen, 
               href: "/professor/materiais",
               color: "from-blue-500 to-indigo-600",
               light: "bg-muted text-foreground"
            },
            {
               title: "Planos de Aula",
               desc: "Preparação e revisão pedagógica",
               icon: ClipboardCheck,
               href: "/professor/planos-aula",
               color: "from-emerald-500 to-green-700",
               light: "bg-emerald-50 text-emerald-600"
            },
            { 
               title: "Calendário Académico", 
               desc: "Prazos, exames e marcos lectivos", 
               icon: CalendarDays, 
               href: "/professor/calendario",
               color: "from-slate-600 to-slate-800",
               light: "bg-slate-100 text-slate-600"
            }
          ].map((action) => (
            <Link 
               key={action.title} 
               href={professorHref(action.href)} 
               className="group relative overflow-hidden rounded-xl border border-border bg-card p-3 shadow-sm transition-colors hover:border-klasse-gold/50 sm:rounded-[2rem] sm:p-6 sm:hover:-translate-y-1 sm:hover:shadow-md last:col-span-2 sm:last:col-span-1 last:flex last:items-center last:gap-3 sm:last:block"
            >
               <div className={`mb-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 sm:mb-4 sm:h-14 sm:w-14 sm:rounded-2xl ${action.light}`}>
                  <action.icon className="h-5 w-5 sm:h-7 sm:w-7" />
               </div>
               <div className="space-y-1">
                  <h3 className="text-sm font-semibold leading-snug text-foreground sm:text-base sm:font-black">{action.title}</h3>
                  <p className="hidden text-[11px] font-medium text-muted-foreground sm:block">{action.desc}</p>
               </div>
               {/* Arrow Icon on Hover */}
               <div className="absolute bottom-6 right-6 hidden opacity-0 transition-opacity group-hover:opacity-100 sm:block">
                  <div className="h-8 w-8 rounded-full bg-slate-900 text-white flex items-center justify-center">
                     <Pencil className="h-4 w-4" />
                  </div>
               </div>
            </Link>
          ))}
        </div>

        {/* CONTEÚDO ACADÊMICO */}
        <div className="grid gap-5 sm:gap-8 lg:grid-cols-[1.5fr_1fr]">
          
          {/* TURMAS */}
          <section className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between gap-2 px-1 sm:px-2">
              <h2 className="text-sm font-semibold text-foreground">Minhas turmas</h2>
              <Link href={professorHref("/professor/frequencias")} className="text-xs font-semibold text-klasse-green hover:underline">Registar presença</Link>
            </div>

            {loadError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                <p className="font-semibold">Não foi possível carregar as turmas.</p>
                <p className="mt-1 text-xs">Verifique a ligação e tente novamente.</p>
                <button type="button" onClick={loadAgain} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-700 px-3 text-xs font-semibold text-white hover:bg-rose-800">
                  <RefreshCw className="h-4 w-4" /> Tentar novamente
                </button>
              </div>
            ) : loading ? (
              <ProfessorTurmasSkeleton />
            ) : turmaMap.length === 0 ? (
              <div role="status" className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                Ainda não existem turmas atribuídas. Contacte a direcção ou secretaria da escola.
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {turmaMap.map((turma) => {
                  const expanded = expandedTurmaId === turma.id;
                  return (
                    <div key={turma.id} className={`rounded-xl border bg-card p-3 shadow-sm transition-colors sm:p-4 ${expanded ? "border-klasse-gold/50" : "border-border hover:border-klasse-gold/30"}`}>
                      <button
                        type="button"
                        onClick={() => setExpandedTurmaId((current) => current === turma.id ? null : turma.id)}
                        aria-expanded={expanded}
                        aria-controls={`turma-acoes-${turma.id}`}
                        className="flex min-h-14 w-full items-center gap-3 text-left"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-klasse-green" aria-hidden="true">
                          <UsersRound className="h-[18px] w-[18px]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold leading-snug text-foreground">
                            {formatTurmaDisplayName({ nome: turma.nome })}
                          </span>
                          <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {turma.disciplinas.join(" · ")}
                          </span>
                        </span>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
                      </button>
                      <div
                        id={`turma-acoes-${turma.id}`}
                        className={expanded ? "mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3" : "hidden"}
                      >
                        <Link href={professorHref(`/professor/frequencias?turma_id=${encodeURIComponent(turma.id)}`)} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-klasse-gold px-2 text-xs font-semibold text-klasse-gold-900 hover:brightness-95">Chamada</Link>
                        <Link href={professorHref(`/professor/notas?turma_id=${encodeURIComponent(turma.id)}`)} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-muted px-2 text-xs font-semibold text-foreground hover:brightness-95">Notas</Link>
                        <Link href={professorHref(`/professor/planos-aula?turma_id=${encodeURIComponent(turma.id)}`)} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-muted px-2 text-xs font-semibold text-foreground hover:brightness-95">Plano de aula</Link>
                        <Link href={professorHref(`/professor/materiais?turma_id=${encodeURIComponent(turma.id)}`)} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-muted px-2 text-xs font-semibold text-foreground hover:brightness-95">Materiais</Link>
                        <Link href={professorHref(`/professor/turmas/${turma.id}/horario`)} className="col-span-2 inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-2 text-xs font-semibold text-foreground hover:bg-muted">Horário da turma</Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* AGENDA COMPACTA */}
          <section className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between gap-2 px-1 sm:px-2">
              <h2 className="text-sm font-semibold text-foreground">Agenda de {dayLabel(todayKey)}</h2>
              <Link href={professorHref("/professor/calendario")} className="text-xs font-semibold text-klasse-green hover:underline">Ver calendário</Link>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 shadow-sm sm:rounded-[2rem] sm:p-6">
              {loadError ? (
                <p role="status" className="py-4 text-sm text-muted-foreground">Agenda indisponível. Utilize «Tentar novamente» acima.</p>
              ) : loading ? (
                <ProfessorAgendaSkeleton />
              ) : (agendaByDay.get(todayKey) || []).length === 0 ? (
                <p role="status" className="py-3 text-sm text-muted-foreground">Sem aulas agendadas para hoje.</p>
              ) : (
                <div className="divide-y divide-border">
                  {(agendaByDay.get(todayKey) || []).map((item, idx) => {
                    const key = `${item.turma_id}:${item.disciplina_id}:${item.slot_id ?? item.inicio}`;
                    const canNavigate = Boolean(item.turma_id && item.disciplina_id);
                    const query = canNavigate
                      ? `?turma_id=${encodeURIComponent(item.turma_id!)}&disciplina_id=${encodeURIComponent(item.disciplina_id!)}`
                      : "";
                    const isCurrentLesson = aulaAtiva?.turma_id === item.turma_id
                      && aulaAtiva?.disciplina_id === item.disciplina_id
                      && (aulaAtiva?.slot_id ?? aulaAtiva?.inicio) === (item.slot_id ?? item.inicio);
                    return (
                      <div key={`${key}:${idx}`} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="w-11 shrink-0 text-center text-xs font-semibold tabular-nums text-foreground">
                            {item.inicio.slice(0, 5)}
                          </span>
                          <span className="h-9 w-px shrink-0 bg-border" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold leading-snug text-foreground">
                              {item.disciplina_nome ?? "Disciplina"}
                            </p>
                            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                              {formatTurmaDisplayName({ turma_nome: item.turma_nome })}
                              {item.sala_nome && ` · Sala ${item.sala_nome}`}
                            </p>
                          </div>
                        </div>
                        {canNavigate && isCurrentLesson ? (
                          <>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-14 text-xs">
                              {item.status === "em_andamento" ? (
                                <>
                                  <span className="font-semibold text-klasse-green">Em andamento</span>
                                  <button type="button" onClick={() => { setFinalizingKey(key); setFinalizeSummary(""); }} disabled={!item.aula_id} className="inline-flex min-h-10 items-center rounded-xl border border-border px-2.5 font-semibold text-foreground disabled:opacity-50">
                                    Finalizar aula
                                  </button>
                                </>
                              ) : item.status === "finalizada" ? (
                                <span className="font-semibold text-muted-foreground">Finalizada</span>
                              ) : (
                                <button type="button" onClick={() => void startLesson(item)} disabled={startingKey === key} className="inline-flex min-h-10 items-center rounded-xl border border-border px-2.5 font-semibold text-klasse-green disabled:opacity-50">
                                  {startingKey === key ? "A confirmar..." : "Entrar na sala"}
                                </button>
                              )}
                              <Link href={professorHref(`/professor/frequencias${query}`)} className="inline-flex min-h-10 items-center rounded-xl px-2 font-semibold text-klasse-green hover:bg-muted">Chamada</Link>
                              <Link href={professorHref(`/professor/notas${query}`)} className="inline-flex min-h-10 items-center rounded-xl px-2 font-semibold text-klasse-green hover:bg-muted">Notas</Link>
                              <Link href={professorHref(`/professor/planos-aula${query}`)} className="inline-flex min-h-10 items-center rounded-xl px-2 font-semibold text-klasse-green hover:bg-muted">Plano</Link>
                            </div>
                            {finalizingKey === key && (
                              <div className="mt-2 space-y-2 rounded-xl border border-border bg-muted p-3">
                                <label className="block text-xs font-semibold text-foreground" htmlFor={`resumo-${idx}`}>Resumo da aula (opcional)</label>
                                <textarea id={`resumo-${idx}`} value={finalizeSummary} onChange={(event) => setFinalizeSummary(event.target.value)} rows={2} className="w-full rounded-xl border border-border bg-card p-2 text-sm text-foreground focus:border-klasse-gold focus:outline-none focus:ring-4 focus:ring-klasse-gold/20" />
                                <div className="grid grid-cols-2 gap-2">
                                  <button type="button" onClick={() => void finalizeLesson(item)} disabled={finalizing} className="min-h-11 rounded-xl bg-klasse-gold px-2 text-xs font-semibold text-klasse-gold-900 disabled:opacity-50">
                                    {finalizing ? "A finalizar..." : "Confirmar saída"}
                                  </button>
                                  <button type="button" onClick={() => setFinalizingKey(null)} disabled={finalizing} className="min-h-11 rounded-xl border border-border bg-card px-2 text-xs font-semibold text-foreground disabled:opacity-50">Cancelar</button>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="mt-1 pl-14 text-xs text-muted-foreground">Das {item.inicio} às {item.fim}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
