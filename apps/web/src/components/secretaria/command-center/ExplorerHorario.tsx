"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CalendarDays, ChevronDown, ChevronUp, Loader2, RefreshCw } from "lucide-react";
import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context";
import {
  groupPublishedLessons, type PublishedLesson, type PublishedTurmaHorario,
} from "@/lib/command-center/published-horario";

/** Display only. No editing, implied allocation or scheduler state. */
export function ExplorerHorarioSemanal({
  aulas, parcial = false, showTurma = false,
}: {
  aulas: readonly PublishedLesson[];
  parcial?: boolean;
  showTurma?: boolean;
}) {
  const [dia, setDia] = useState<number | null>(null);
  const days = groupPublishedLessons(aulas);
  // Switching professor/entity must not strand the view on a weekday absent
  // from the newly loaded timetable.
  const activeDay = dia !== null && days.some((item) => item.diaSemana === dia) ? dia : null;
  const visibleDays = activeDay == null ? days : days.filter((item) => item.diaSemana === activeDay);

  if (!aulas.length) return (
    <p className="text-xs text-slate-600">
      Nenhuma aula publicada encontrada nesta consulta.
      {parcial ? " O resultado é parcial, pelo que não permite concluir ausência." : ""}
    </p>
  );

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Filtrar horário por dia" className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setDia(null)} aria-pressed={activeDay === null}
          className={"rounded-lg border px-2.5 py-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-emerald-700 " +
            (activeDay == null ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>
          Semana
        </button>
        {days.map((day) => (
          <button type="button" key={day.diaSemana}
            onClick={() => setDia(day.diaSemana)} aria-pressed={activeDay === day.diaSemana}
            className={"rounded-lg border px-2.5 py-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-emerald-700 " +
              (activeDay === day.diaSemana ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>
            {day.nome}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {visibleDays.map((day) => (
          <section key={day.diaSemana} aria-label={day.nome} className="min-w-0">
            <h4 className="mb-1.5 text-xs font-semibold text-slate-700">{day.nome}</h4>
            <ol className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {day.aulas.map((aula) => (
                <li key={aula.id} className="flex min-w-0 gap-3 px-3 py-2.5">
                  <span className="w-[74px] shrink-0 pt-0.5 text-[11px] tabular-nums text-slate-500">
                    {aula.inicio.slice(0, 5)}–{aula.fim.slice(0, 5)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium text-slate-900">{aula.disciplinaNome}</p>
                    {showTurma && aula.turmaNome && <p className="mt-0.5 text-xs text-slate-600">{aula.turmaNome}</p>}
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
          Horário parcial: há aulas adicionais fora do limite consultado.
        </p>
      )}
    </div>
  );
}

type TurmaOption = { id: string; nome: string };
export function ExplorerHorarioTurma({
  escolaId, anoLetivoId, turmaId, turmas, listaParcial = false, disciplinaId,
}: {
  escolaId: string;
  anoLetivoId: string;
  turmaId?: string;
  turmas?: readonly TurmaOption[];
  listaParcial?: boolean;
  disciplinaId?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState(turmaId ?? "");
  // A different school/year/explorer must never retain a selected turma that
  // is absent from the newly authorized list.
  const effectiveTurma = turmaId || (turmas?.some((item) => item.id === selected) ? selected : "");
  const query = useQuery({
    queryKey: ["command-center", "horario-publicado", escolaId, anoLetivoId, effectiveTurma],
    enabled: expanded && Boolean(effectiveTurma),
    staleTime: 20_000,
    gcTime: 120_000,
    refetchOnWindowFocus: false,
    retry: (count, error) => count < 1 && !(error instanceof PublishedHorarioError &&
      [400, 401, 403, 404, 409].includes(error.status)),
    queryFn: async ({ signal }): Promise<PublishedTurmaHorario> => {
      const params = new URLSearchParams({ [ACADEMIC_YEAR_PARAM]: anoLetivoId });
      // Preserve explicit polo intent so the Command Center can fail closed
      // while canonical polo isolation is not enabled.
      const currentScope = new URLSearchParams(window.location.search);
      for (const key of ["poloId", "polo_id"]) {
        if (currentScope.has(key)) params.set(key, currentScope.get(key) ?? "");
      }
      const response = await fetch(
        "/api/escolas/" + encodeURIComponent(escolaId) + "/command-center/turmas/" +
          encodeURIComponent(effectiveTurma) + "/horario?" + params.toString(),
        { credentials: "same-origin", cache: "no-store", signal },
      );
      const reply = (await response.json().catch(() => null)) as {
        ok?: boolean; data?: PublishedTurmaHorario; error?: string;
      } | null;
      if (!response.ok || !reply?.ok || !reply.data ||
        reply.data.turmaId !== effectiveTurma || reply.data.anoLetivoId !== anoLetivoId) {
        throw new PublishedHorarioError(reply?.error || "Não foi possível carregar o horário.", response.status);
      }
      return reply.data;
    },
  });

  return (
    <section aria-label="Horário da turma" className="min-w-0 border-t border-slate-100 pt-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <CalendarDays className="h-4 w-4 text-emerald-700" aria-hidden /> {disciplinaId ? "Horário da disciplina" : "Horário semanal"}
        </h3>
        <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-700">
          {expanded ? "Ocultar" : "Ver horário"}
          {expanded ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
        </button>
      </div>
      {expanded && (
        <div className="mt-3 space-y-3">
          {!turmaId && (
            <label className="block space-y-1 text-xs text-slate-600">
              <span>Escolher turma</span>
              <select value={effectiveTurma} onChange={(event) => setSelected(event.target.value)}
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600">
                <option value="">Selecione uma turma</option>
                {(turmas ?? []).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
              </select>
            </label>
          )}
          {listaParcial && <p className="text-xs text-amber-800">A lista de turmas é parcial. Se não encontrar a turma, abra o seu explorador diretamente.</p>}
          {effectiveTurma && query.isPending && (
            <p role="status" className="flex items-center gap-2 text-xs text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> A carregar horário publicado…
            </p>
          )}
          {effectiveTurma && query.error && (
            <p role="alert" className="text-xs text-rose-700">
              {query.error.message}
              <button type="button" onClick={() => void query.refetch()}
                className="ml-2 inline-flex items-center gap-1 font-semibold underline focus-visible:outline-2 focus-visible:outline-emerald-700">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Tentar novamente
              </button>
            </p>
          )}
          {effectiveTurma && query.data?.estado === "sem-publicacao" && (
            <p role="status" className="text-xs text-slate-600">
              Esta turma não tem horário publicado neste ano letivo. Pode existir um rascunho na gestão de horários.
            </p>
          )}
          {effectiveTurma && query.data?.estado === "publicado" && (
            <>
              <p className="text-xs text-slate-600">
                Versão publicada · apenas consulta
                {query.data.publicadoEm
                  ? " · " + new Date(query.data.publicadoEm).toLocaleDateString("pt-AO")
                  : ""}
              </p>
              <ExplorerHorarioSemanal aulas={disciplinaId
                ? query.data.aulas.filter((item) => item.disciplinaId === disciplinaId)
                : query.data.aulas} parcial={query.data.parcial} />
            </>
          )}
        </div>
      )}
    </section>
  );
}

class PublishedHorarioError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "PublishedHorarioError";
  }
}
