"use client";

import AssignmentsBanner from "@/components/professor/AssignmentsBanner";
import { ProfessorAgendaSkeleton, ProfessorSkeletonBone, ProfessorTurmasSkeleton } from "@/components/professor/ProfessorLoadingSkeletons";
import ProfessorReopeningRequests from "@/components/professor/ProfessorReopeningRequests";
import { useEscolaId } from "@/hooks/useEscolaId";
import dynamic from "next/dynamic";
import { PortalDrawerNavigator, PortalDrawerPushButton, type PortalDrawerFrame } from "@/components/portal/ui/PortalDrawerNavigator";
import { ProfessorTurmaHorario } from "@/components/professor/ProfessorTurmaHorario";
import { ProfessorTurmaRoster } from "@/components/professor/ProfessorTurmaRoster";
import { PortalWelcomeCard } from "@/components/portal/ui/PortalWelcomeCard";
import { PortalSection } from "@/components/portal/ui/PortalSection";
import AcaoRapidaCard from "@/components/shared/AcaoRapidaCard";
import { buildPortalHref, getEscolaParamFromPath } from "@/lib/navigation";
import { formatTurmaDisplayName } from "@/utils/formatters";
import { BookOpen, CalendarDays, ChevronDown, ClipboardCheck, Pencil, RefreshCw, UsersRound } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
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

const AttendanceWorkspace = dynamic(() => import("@/components/professor/ProfessorFrequenciasWorkspace").then(module => module.ProfessorFrequenciasWorkspace), { loading: () => <p role="status" className="text-sm text-muted-foreground">A carregar chamada…</p> });
const PlansWorkspace = dynamic(() => import("@/components/professor/ProfessorPlanosWorkspace").then(module => module.ProfessorPlanosWorkspace), { loading: () => <p role="status" className="text-sm text-muted-foreground">A carregar planos…</p> });

const MaterialsWorkspace = dynamic(() => import("@/components/professor/ProfessorMateriaisWorkspace").then(module => module.ProfessorMateriaisWorkspace), { loading: () => <p role="status" className="text-sm text-muted-foreground">A carregar materiais…</p> });

const CalendarWorkspace = dynamic(() => import("@/components/professor/ProfessorCalendarWorkspace").then(module => module.ProfessorCalendarWorkspace), { loading: () => <p role="status" className="text-sm text-muted-foreground">A carregar calendário…</p> });
const GradesWorkspace = dynamic(() => import("@/components/professor/ProfessorGradesWorkspace").then(module => module.ProfessorGradesWorkspace), { loading: () => <p role="status" className="text-sm text-muted-foreground">A carregar notas…</p> });

type OperationKind = "attendance" | "plans" | "materials" | "grades" | "calendar" | "assessments" | "periods";

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
  const [operation, setOperation] = useState<{ scope: string; frame: PortalDrawerFrame } | null>(null);
  const [expandedTurmaId, setExpandedTurmaId] = useState<string | null>(null);
  const [selectedLessonKey, setSelectedLessonKey] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const pollingInFlight = useRef(false);
  const pollingFailures = useRef(0);
  const { success, error: toastError } = useToast();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedAcademicYearId = searchParams?.get("ano_letivo_id") ?? "";
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

  const selectedTurma = !loading && !loadError ? turmaMap.find(turma => turma.id === expandedTurmaId) : undefined;
  const selectedLesson = !loading && !loadError ? (agendaByDay.get(todayKey) ?? []).find(item => `${getSchoolNow(new Date(nowTick)).date}:${item.turma_id}:${item.disciplina_id}:${item.slot_id ?? item.inicio}` === selectedLessonKey) : undefined;
  const lessonQuery = selectedLesson?.turma_id && selectedLesson.disciplina_id ? `?turma_id=${encodeURIComponent(selectedLesson.turma_id)}&disciplina_id=${encodeURIComponent(selectedLesson.disciplina_id)}` : null;
  const operationScope = JSON.stringify([escolaParam ?? "", requestedAcademicYearId]);
  const operationFrame = (kind: OperationKind, turmaId?: string | null, disciplinaId?: string | null): PortalDrawerFrame => ({
    id: JSON.stringify([operationScope, kind, turmaId ?? "", disciplinaId ?? ""]),
    title: ({ attendance: "Registar chamada", plans: "Planos de aula", materials: "Materiais pedagógicos", grades: "Lançamento de notas", calendar: "Calendário académico", assessments: "Calendário de avaliações", periods: "Períodos lectivos" })[kind],
    description: ({ attendance: "Regista e guarda as presenças da turma.", plans: "Prepara, guarda e acompanha os planos de aula.", materials: "Cria, consulta e publica os materiais.", grades: "Selecciona o contexto, guarda as notas e exporta a mini-pauta.", calendar: "Consulta eventos oficiais da escola.", assessments: "Consulta avaliações próximas e anteriores.", periods: "Consulta períodos e datas de fecho." })[kind],
    content: kind === "attendance" ? <AttendanceWorkspace embedded requestedAcademicYearId={requestedAcademicYearId} urlTurmaId={turmaId} urlDisciplinaId={disciplinaId} /> : kind === "plans" ? <PlansWorkspace embedded requestedTurmaId={turmaId ?? ""} requestedDisciplinaId={disciplinaId ?? ""} /> : kind === "materials" ? <MaterialsWorkspace embedded requestedTurmaId={turmaId ?? ""} requestedDisciplinaId={disciplinaId ?? ""} /> : kind === "grades" ? <GradesWorkspace embedded requestedAnoLetivoId={requestedAcademicYearId} requestedTurmaId={turmaId ?? ""} requestedDisciplinaId={disciplinaId ?? ""} /> : <CalendarWorkspace embedded initialView={kind} />,
  });
  const openOperation = (kind: OperationKind, turmaId?: string | null, disciplinaId?: string | null) => {
    setExpandedTurmaId(null);
    setSelectedLessonKey(null);
    setOperation({ scope: operationScope, frame: operationFrame(kind, turmaId, disciplinaId) });
  };
  const activeOperation = operation?.scope === operationScope ? operation.frame : null;
  const turmasAtivas = turmaMap.length;
  const avaliacoesPendentes = pendenciasResumo?.avaliacoes_pendentes ?? null;
  const faltasALancar = pendenciasResumo?.faltas_a_lancar ?? null;

  return (
    <div className="min-w-0 text-foreground">
      <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 sm:space-y-8">
        
        <PortalWelcomeCard
          role="professor"
          name={overview?.primeiro_nome}
          context={overview?.escola_nome}
          date={new Date(nowTick)}
          loading={loading}
        />

        {loadError && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
            <p className="font-bold">Não foi possível carregar os dados do professor.</p>
            <p className="mt-1">Nenhuma nota ou presença foi alterada. Verifique a ligação ou as suas permissões.</p>
            <button type="button" onClick={loadAgain} className="mt-3 rounded-lg bg-rose-800 px-4 py-2 font-bold text-white">Tentar novamente</button>
          </div>
        )}
        <AssignmentsBanner loading={loading} hasAssignments={atribs.length > 0} hasError={Boolean(loadError)} academicYearLabel={academicYearLabel} />
        <ProfessorReopeningRequests assignments={atribs} notesHref={professorHref("/professor/notas")} />

        {/* Aula actual: só mostra o estado real da aula, não presume que já começou. */}
        {aulaAtiva && (
          <section className="rounded-xl border border-border bg-card p-4 text-foreground sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground sm:h-11 sm:w-11">
                  <CalendarDays className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                      {aulaAtiva.status === "em_andamento" ? "Em andamento" : aulaAtiva.status === "finalizada" ? "Finalizada" : "Aula agora"}
                    </span>
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">
                      {aulaAtiva.inicio} – {aulaAtiva.fim}
                    </span>
                  </div>
                  <h3 className="mt-1 text-sm font-semibold leading-snug text-foreground sm:text-lg">
                    {aulaAtiva.disciplina_nome} · {formatTurmaDisplayName({ turma_nome: aulaAtiva.turma_nome })}
                  </h3>
                  {aulaAtiva.sala_nome && (
                    <p className="mt-0.5 text-xs text-muted-foreground">Sala {aulaAtiva.sala_nome}</p>
                  )}
                </div>
              </div>
              {aulaAtiva.turma_id && aulaAtiva.disciplina_id && (
                <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                  <button type="button" aria-haspopup="dialog"
                    onClick={() => openOperation("attendance", aulaAtiva.turma_id, aulaAtiva.disciplina_id)}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-2.5 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:brightness-95 sm:px-4"
                  >
                    <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                    Fazer chamada
                  </button>
                  <button type="button" aria-haspopup="dialog"
                    onClick={() => openOperation("grades", aulaAtiva.turma_id, aulaAtiva.disciplina_id)}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted sm:px-4"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Lançar notas
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        <PortalSection id="professor-today" title="Hoje">
          <div aria-busy={loading} className="grid grid-cols-2 gap-3">
            {[
              { label: "Aulas hoje", value: loadError ? null : aulasHoje },
              { label: "Turmas", value: loadError ? null : turmasAtivas },
            ].map(item => (
              <div key={item.label} className="min-w-0 rounded-xl border border-border bg-card p-3 sm:p-4">
                {loading ? <ProfessorSkeletonBone className="h-7 w-10 motion-safe:animate-pulse" /> : (
                  <p className="text-2xl font-semibold tabular-nums text-klasse-green">{item.value ?? "—"}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </PortalSection>

        <PortalSection id="professor-shortcuts" title="Acesso rápido">
          <div className="grid grid-cols-2 gap-3 min-[380px]:grid-cols-3">
            <AcaoRapidaCard dashboardCompact mobileCompact portalTile portalClean label="Presenças" icon={<ClipboardCheck className="h-5 w-5" />} onClick={() => openOperation("attendance")} dialogOpen={activeOperation?.title === "Registar chamada"} />
            <AcaoRapidaCard dashboardCompact mobileCompact portalTile portalClean label="Lançar notas" icon={<Pencil className="h-5 w-5" />} onClick={() => openOperation("grades")} dialogOpen={activeOperation?.title === "Lançamento de notas"} />
            {escolaParam && <AcaoRapidaCard dashboardCompact mobileCompact portalTile portalClean prefetch={false} label="Provas" icon={<ClipboardCheck className="h-5 w-5" />} href={professorHref("/professor/provas")} />}
            <AcaoRapidaCard dashboardCompact mobileCompact portalTile portalClean label="Materiais" icon={<BookOpen className="h-5 w-5" />} onClick={() => openOperation("materials")} dialogOpen={activeOperation?.title === "Materiais pedagógicos"} />
            <AcaoRapidaCard dashboardCompact mobileCompact portalTile portalClean label="Planos de aula" icon={<ClipboardCheck className="h-5 w-5" />} onClick={() => openOperation("plans")} dialogOpen={activeOperation?.title === "Planos de aula"} />
            <AcaoRapidaCard dashboardCompact mobileCompact portalTile portalClean prefetch={false} label="Calendário de Avaliações" icon={<CalendarDays className="h-5 w-5" />} onClick={() => openOperation("assessments")} dialogOpen={activeOperation?.title === "Calendário de avaliações"} />
          </div>
        </PortalSection>

        <PortalSection id="professor-attention" title="A acompanhar">
          <div aria-busy={loading} className="grid gap-3 md:grid-cols-3">
            <AcaoRapidaCard dashboardCompact mobileCompact portalClean label="Avaliações pendentes"
              icon={<Pencil className="h-4 w-4" />}
              unavailable={!loading && (loadError !== null || avaliacoesPendentes === null)}
              needsAttention={!loading && !loadError && avaliacoesPendentes !== null && avaliacoesPendentes > 0}
              sublabel={loading ? "A carregar…" : loadError || avaliacoesPendentes === null ? "Dados indisponíveis" : String(avaliacoesPendentes)}
              onClick={() => openOperation("grades")} dialogOpen={activeOperation?.title === "Lançamento de notas"} />
            <AcaoRapidaCard dashboardCompact mobileCompact portalClean label="Faltas a lançar"
              icon={<ClipboardCheck className="h-4 w-4" />}
              unavailable={!loading && (loadError !== null || faltasALancar === null)}
              needsAttention={!loading && !loadError && faltasALancar !== null && faltasALancar > 0}
              sublabel={loading ? "A carregar…" : loadError || faltasALancar === null ? "Dados indisponíveis" : String(faltasALancar)}
              onClick={() => openOperation("attendance")} dialogOpen={activeOperation?.title === "Registar chamada"} />
            <AcaoRapidaCard dashboardCompact mobileCompact portalClean label="Calendário académico"
              icon={<CalendarDays className="h-4 w-4" />} sublabel="Consultar eventos e avaliações"
              onClick={() => openOperation("calendar")} dialogOpen={activeOperation?.title === "Calendário académico"} />
          </div>
        </PortalSection>

        {/* CONTEÚDO ACADÊMICO */}
        <div className="grid gap-5 sm:gap-8 lg:grid-cols-[1.5fr_1fr]">
          
          {/* TURMAS */}
          <section className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between gap-2 px-1 sm:px-2">
              <h2 className="text-sm font-semibold text-foreground">Minhas turmas</h2>
              <button type="button" aria-haspopup="dialog" onClick={() => openOperation("attendance")} className="min-h-11 text-xs font-semibold text-klasse-green hover:underline">Registar presença</button>
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
                        onClick={() => setExpandedTurmaId(turma.id)}
                        aria-expanded={expanded}
                        aria-haspopup="dialog"
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
              <button type="button" aria-haspopup="dialog" onClick={() => openOperation("calendar")} className="min-h-11 text-xs font-semibold text-klasse-green hover:underline">Ver calendário</button>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 shadow-sm sm:rounded-xl sm:p-6">
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
                      ? `?turma_id=${encodeURIComponent(item.turma_id!)}&disciplina_id=${encodeURIComponent(item.disciplina_id!)}`
                      : "";
                    const isCurrentLesson = aulaAtiva?.turma_id === item.turma_id
                      && aulaAtiva?.disciplina_id === item.disciplina_id
                      && (aulaAtiva?.slot_id ?? aulaAtiva?.inicio) === (item.slot_id ?? item.inicio);
                    return (
                      <div key={`${key}:${idx}`} className="py-3 first:pt-0 last:pb-0">
                        <button type="button" aria-haspopup="dialog" aria-expanded={selectedLessonKey === `${getSchoolNow(new Date(nowTick)).date}:${key}`} onClick={() => setSelectedLessonKey(`${getSchoolNow(new Date(nowTick)).date}:${key}`)} className="flex min-h-11 w-full min-w-0 items-center gap-3 rounded-xl text-left focus-visible:ring-2 focus-visible:ring-ring">
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
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        </button>
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
                              <button type="button" aria-haspopup="dialog" onClick={() => openOperation("attendance", item.turma_id, item.disciplina_id)} className="inline-flex min-h-10 items-center rounded-xl px-2 font-semibold text-klasse-green hover:bg-muted">Chamada</button>
                              <button type="button" aria-haspopup="dialog" onClick={() => openOperation("grades", item.turma_id, item.disciplina_id)} className="inline-flex min-h-10 items-center rounded-xl px-2 font-semibold text-klasse-green hover:bg-muted">Notas</button>
                              <button type="button" aria-haspopup="dialog" onClick={() => openOperation("plans", item.turma_id, item.disciplina_id)} className="inline-flex min-h-10 items-center rounded-xl px-2 font-semibold text-klasse-green hover:bg-muted">Plano</button>
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
        <PortalDrawerNavigator key={`${operationScope}:turma`} open={Boolean(selectedTurma)} onClose={() => setExpandedTurmaId(null)} onChanged={loadAgain} root={{
          id: `${escolaParam ?? "default"}:turma:${selectedTurma?.id ?? "closed"}`,
          title: selectedTurma ? formatTurmaDisplayName({ nome: selectedTurma.nome }) : "Perfil da turma",
          description: "Disciplinas atribuídas e operações pedagógicas.",
          content: selectedTurma && <>
            <p className="text-sm text-muted-foreground">{selectedTurma.disciplinas.join(" · ")}</p>
            <div className="grid grid-cols-2 gap-2">
                        <PortalDrawerPushButton frame={operationFrame("attendance", selectedTurma.id)} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-klasse-gold px-2 text-xs font-semibold text-klasse-gold-900 hover:brightness-95">Chamada</PortalDrawerPushButton>
                        <PortalDrawerPushButton frame={operationFrame("grades", selectedTurma.id)} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-muted px-2 text-xs font-semibold text-foreground hover:brightness-95">Notas</PortalDrawerPushButton>
                        <PortalDrawerPushButton frame={operationFrame("plans", selectedTurma.id)} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-muted px-2 text-xs font-semibold text-foreground hover:brightness-95">Plano de aula</PortalDrawerPushButton>
                        <PortalDrawerPushButton frame={operationFrame("materials", selectedTurma.id)} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-muted px-2 text-xs font-semibold text-foreground hover:brightness-95">Materiais</PortalDrawerPushButton>
                        <PortalDrawerPushButton frame={{ id: `${escolaParam ?? "default"}:horario:${selectedTurma.id}`, title: "Horário da turma", description: formatTurmaDisplayName({ nome: selectedTurma.nome }), content: <ProfessorTurmaHorario turmaId={selectedTurma.id} embedded /> }} className="col-span-2 inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-2 text-xs font-semibold text-foreground hover:bg-muted">Horário da turma</PortalDrawerPushButton>
            </div>
            <ProfessorTurmaRoster key={`${escolaParam}:${selectedTurma.id}`} turmaId={selectedTurma.id} />
          </>,
        }} />
        <PortalDrawerNavigator key={`${operationScope}:lesson`} open={Boolean(selectedLesson)} onClose={() => setSelectedLessonKey(null)} onChanged={loadAgain} root={{ id: `${operationScope}:lesson:${selectedLessonKey ?? "closed"}`, title: selectedLesson?.disciplina_nome ?? "Detalhes da aula", description: "Consulta da agenda de hoje.", size: "medium", content: selectedLesson && <>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-muted-foreground">Turma</dt><dd className="font-medium">{formatTurmaDisplayName({ turma_nome: selectedLesson.turma_nome })}</dd></div>
              <div><dt className="text-muted-foreground">Horário</dt><dd className="font-medium">{selectedLesson.inicio} – {selectedLesson.fim}</dd></div>
              <div><dt className="text-muted-foreground">Sala</dt><dd className="font-medium">{selectedLesson.sala_nome || "Não indicada"}</dd></div>
              <div><dt className="text-muted-foreground">Estado</dt><dd className="font-medium">{selectedLesson.status === "em_andamento" ? "Em andamento" : selectedLesson.status === "finalizada" ? "Finalizada" : selectedLesson.status === "cancelada" ? "Cancelada" : "Sem confirmação de realização"}</dd></div>
            </dl>
            {lessonQuery && <div className="grid grid-cols-2 gap-2">
              <PortalDrawerPushButton frame={operationFrame("attendance", selectedLesson.turma_id, selectedLesson.disciplina_id)} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground">Chamada</PortalDrawerPushButton>
              <PortalDrawerPushButton frame={operationFrame("grades", selectedLesson.turma_id, selectedLesson.disciplina_id)} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-3 text-sm font-medium">Notas</PortalDrawerPushButton>
              <PortalDrawerPushButton frame={operationFrame("plans", selectedLesson.turma_id, selectedLesson.disciplina_id)} className="col-span-2 inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-3 text-sm font-medium">Plano de aula</PortalDrawerPushButton>
            </div>}
          </>, }} />
        <PortalDrawerNavigator key={`${operationScope}:operation`} open={Boolean(activeOperation)} onClose={() => setOperation(null)} onChanged={loadAgain} root={activeOperation ?? { id: "closed", title: "Operação", description: "", content: null }} />
      </div>
    </div>
  );
}
