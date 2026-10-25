"use client";

import { useState } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { AlertCircle, CalendarDays, ChevronDown, ChevronUp, Loader2, RefreshCw } from "lucide-react";
import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context";
import {
  groupPublishedLessons, WEEKDAY_LABELS, type PublishedLesson, type PublishedTurmaHorario,
} from "@/lib/command-center/published-horario";

/** Read-only timetable for all five explorers; a scheduled lesson is not evidence of attendance. */
export function ExplorerHorarioSemanal({
  aulas, parcial = false, showTurma = false,
}: {
  aulas: readonly PublishedLesson[];
  parcial?: boolean;
  showTurma?: boolean;
}) {
  const [dia, setDia] = useState<number | null>(null);
  const days = groupPublishedLessons(aulas);
  const weekdays = [1, 2, 3, 4, 5, ...[6, 7].filter((day) => days.some((d) => d.diaSemana === day))];
  // If another entity is selected without a remount, revert to the week
  // rather than retain a filter with no lessons in that entity.
  const activeDay = dia !== null && days.some((item) => item.diaSemana === dia) ? dia : null;
  const visibleDays = activeDay == null ? days : days.filter((item) => item.diaSemana === activeDay);

  if (!aulas.length) return (
    <p className="rounded-xl border border-slate-200 px-3 py-4 text-xs text-slate-600">
      Nenhuma aula publicada encontrada nesta consulta.
      {parcial ? " O resultado é parcial, pelo que não permite concluir ausência." : ""}
    </p>
  );

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Filtrar horário por dia" className="flex flex-wrap gap-1.5 border-b border-slate-100 pb-3">
        <button type="button" onClick={() => setDia(null)} aria-pressed={activeDay === null}
          className={"rounded-lg border px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 " +
            (activeDay === null ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>
          Semana
        </button>
        {weekdays.map((day) => (
          <button type="button" key={day} onClick={() => setDia(day)}
            aria-label={WEEKDAY_LABELS[day]} aria-pressed={activeDay === day}
            className={"min-w-10 rounded-lg border px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 " +
              (activeDay === day ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>
            {WEEKDAY_LABELS[day].slice(0, 3)}
          </button>
        ))}
      </div>

      <div className={activeDay === null ? "grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2" : "space-y-3"}>
        {visibleDays.map((day) => (
          <section key={day.diaSemana} aria-label={day.nome} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <h4 className="border-b border-slate-100 bg-slate-50/70 px-3 py-2 text-xs font-semibold text-slate-800">
              {day.nome}
            </h4>
            <ol className="divide-y divide-slate-100">
              {day.aulas.map((aula) => (
                <li key={aula.id} className="flex min-w-0 items-start gap-3 px-3 py-3">
                  <span className="w-[82px] shrink-0 pt-0.5 text-[11px] font-medium tabular-nums text-slate-500">
                    {aula.inicio.slice(0, 5)}–{aula.fim.slice(0, 5)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-semibold text-slate-900">{aula.disciplinaNome}</p>
                    {showTurma && aula.turmaNome && <p className="mt-0.5 text-xs text-slate-700">{aula.turmaNome}</p>}
                    {!showTurma && (
                      <p className="mt-0.5 text-xs text-slate-600">
                        {aula.professorNome ??
                          (aula.professorVinculoRegistrado
                            ? "Identidade docente indisponível"
                            : "Professor não indicado no horário")}
                      </p>
                    )}
                    {!showTurma && <p className="mt-0.5 text-[11px] text-slate-500">
                      {aula.salaNome ? "Sala " + aula.salaNome : "Sala não indicada no horário"}
                    </p>}
                    {showTurma && aula.salaNome && <p className="mt-0.5 text-[11px] text-slate-500">
                      Sala {aula.salaNome}
                    </p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      {parcial && (
        <p role="status" className="flex items-start gap-2 text-xs text-amber-900">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          Horário parcial: existem aulas adicionais fora do limite consultado.
        </p>
      )}
    </div>
  );
}

class PublishedHorarioError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "PublishedHorarioError";
  }
}

async function fetchPublishedHorario(
  escolaId: string, anoLetivoId: string, turmaId: string, signal: AbortSignal,
): Promise<PublishedTurmaHorario> {
  const params = new URLSearchParams({ [ACADEMIC_YEAR_PARAM]: anoLetivoId });
  // Preserve explicit polo intent: the canonical school-wide guard must fail closed.
  const currentScope = new URLSearchParams(window.location.search);
  for (const key of ["poloId", "polo_id"]) {
    if (currentScope.has(key)) params.set(key, currentScope.get(key) ?? "");
  }
  const response = await fetch(
    "/api/escolas/" + encodeURIComponent(escolaId) + "/command-center/turmas/" +
      encodeURIComponent(turmaId) + "/horario?" + params.toString(),
    { credentials: "same-origin", cache: "no-store", signal },
  );
  const reply = (await response.json().catch(() => null)) as {
    ok?: boolean; data?: PublishedTurmaHorario; error?: string;
  } | null;
  if (!response.ok || !reply?.ok || !reply.data ||
    reply.data.turmaId !== turmaId || reply.data.anoLetivoId !== anoLetivoId) {
    throw new PublishedHorarioError(reply?.error || "Não foi possível carregar o horário.", response.status);
  }
  return reply.data;
}

function HorarioResultado({
  query, disciplinaId,
}: {
  query: UseQueryResult<PublishedTurmaHorario, PublishedHorarioError>;
  disciplinaId?: string;
}) {
  if (query.isPending) return (
    <p role="status" className="flex items-center gap-2 text-xs text-slate-600">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> A carregar horário publicado…
    </p>
  );
  if (query.error) return (
    <p role="alert" className="text-xs text-rose-700">
      {query.error.message}
      <button type="button" onClick={() => void query.refetch()}
        className="ml-2 inline-flex items-center gap-1 font-semibold underline focus-visible:outline-2 focus-visible:outline-emerald-700">
        <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Tentar novamente
      </button>
    </p>
  );
  if (query.data?.estado === "sem-publicacao") return (
    <div className="rounded-xl border border-slate-200 px-3 py-4">
      <span className="inline-flex rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
        Sem publicação
      </span>
      <p role="status" className="mt-2 text-xs text-slate-600">
        Esta turma não tem horário publicado neste ano letivo. Pode existir um rascunho na gestão de horários, mas nunca é apresentado como oficial.
      </p>
    </div>
  );
  if (query.data?.estado !== "publicado") return null;
  const aulas = disciplinaId
    ? query.data.aulas.filter((item) => item.disciplinaId === disciplinaId)
    : query.data.aulas;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-900">
          Publicado
        </span>
        <span className="text-xs text-slate-500">
          Versão oficial · apenas consulta
          {query.data.publicadoEm
            ? " · " + new Date(query.data.publicadoEm).toLocaleDateString("pt-AO") : ""}
        </span>
      </div>
      <ExplorerHorarioSemanal aulas={aulas} parcial={query.data.parcial} />
      {disciplinaId && aulas.length === 0 && query.data.parcial && (
        <p className="text-xs text-amber-900">A consulta é parcial; outras aulas desta disciplina podem existir.</p>
      )}
    </div>
  );
}

type TurmaOption = { id: string; nome: string };
/** An explicitly opened timetable reads one (or, for Classe, two) published turma versions. */
export function ExplorerHorarioTurma({
  escolaId, anoLetivoId, turmaId, turmas, listaParcial = false, disciplinaId,
  allowCompare = false, initiallyExpanded = false,
}: {
  escolaId: string;
  anoLetivoId: string;
  turmaId?: string;
  turmas?: readonly TurmaOption[];
  listaParcial?: boolean;
  disciplinaId?: string;
  allowCompare?: boolean;
  initiallyExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [selected, setSelected] = useState(turmaId ?? "");
  const [compare, setCompare] = useState("");
  // A different school/year/explorer must not retain a selection outside
  // the newly authorized list. Parents key this component to their scope.
  const effectiveTurma = turmaId || (turmas?.some((item) => item.id === selected) ? selected : "");
  const effectiveCompare = allowCompare && turmas?.some(
    (item) => item.id === compare && item.id !== effectiveTurma,
  ) ? compare : "";
  const query = useQuery<PublishedTurmaHorario, PublishedHorarioError>({
    queryKey: ["command-center", "horario-publicado", escolaId, anoLetivoId, effectiveTurma],
    enabled: expanded && Boolean(effectiveTurma),
    staleTime: 20_000,
    gcTime: 120_000,
    refetchOnWindowFocus: false,
    retry: (count, error) => count < 1 && !(error instanceof PublishedHorarioError &&
      [400, 401, 403, 404, 409].includes(error.status)),
    queryFn: ({ signal }) => fetchPublishedHorario(escolaId, anoLetivoId, effectiveTurma, signal),
  });
  const otherQuery = useQuery<PublishedTurmaHorario, PublishedHorarioError>({
    queryKey: ["command-center", "horario-publicado", escolaId, anoLetivoId, effectiveCompare],
    enabled: expanded && Boolean(effectiveCompare),
    staleTime: 20_000,
    gcTime: 120_000,
    refetchOnWindowFocus: false,
    retry: (count, error) => count < 1 && !(error instanceof PublishedHorarioError &&
      [400, 401, 403, 404, 409].includes(error.status)),
    queryFn: ({ signal }) => fetchPublishedHorario(escolaId, anoLetivoId, effectiveCompare, signal),
  });

  const title = disciplinaId ? "Horário da disciplina" : allowCompare ? "Comparar horários das turmas" :
    turmaId ? "Horário semanal" : "Horários das turmas";

  return (
    <section aria-label={title} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <CalendarDays className="h-4 w-4 text-emerald-700" aria-hidden /> {title}
        </h3>
        {!initiallyExpanded && (
          <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-700">
            {expanded ? "Ocultar" : "Ver horário"}
            {expanded ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
          </button>
        )}
      </div>
      {expanded && (
        <div className="mt-3 space-y-3">
          {!turmaId && (
            <div className={allowCompare ? "grid grid-cols-1 gap-2 sm:grid-cols-2" : "space-y-2"}>
              <label className="block space-y-1 text-xs font-medium text-slate-600">
                <span>{allowCompare ? "Primeira turma" : "Escolher turma"}</span>
                <select value={effectiveTurma} onChange={(event) => setSelected(event.target.value)}
                  className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600">
                  <option value="">Selecione uma turma</option>
                  {(turmas ?? []).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
                </select>
              </label>
              {allowCompare && (
                <label className="block space-y-1 text-xs font-medium text-slate-600">
                  <span>Comparar com (opcional)</span>
                  <select value={effectiveCompare} onChange={(event) => setCompare(event.target.value)}
                    className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600">
                    <option value="">Sem comparação</option>
                    {(turmas ?? []).filter((item) => item.id !== effectiveTurma)
                      .map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
                  </select>
                </label>
              )}
            </div>
          )}
          {listaParcial && (
            <p role="status" className="text-xs text-amber-900">
              A lista de turmas é parcial. Para uma turma fora deste recorte, abra o respetivo explorador diretamente.
            </p>
          )}
          {!effectiveTurma && (
            <p className="text-xs text-slate-600">Selecione uma turma para consultar apenas o seu horário oficial.</p>
          )}
          {effectiveTurma && (
            <div className={effectiveCompare ? "grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2" : "min-w-0"}>
              <div className="min-w-0 space-y-2">
                {effectiveCompare && (
                  <p className="text-xs font-semibold text-slate-700">
                    {turmas?.find((item) => item.id === effectiveTurma)?.nome ?? "Primeira turma"}
                  </p>
                )}
                <HorarioResultado query={query} disciplinaId={disciplinaId} />
              </div>
              {effectiveCompare && (
                <div className="min-w-0 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">
                    {turmas?.find((item) => item.id === effectiveCompare)?.nome ?? "Segunda turma"}
                  </p>
                  <HorarioResultado query={otherQuery} disciplinaId={disciplinaId} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
