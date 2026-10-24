"use client";

import {
  AlertCircle, ArrowUpRight, BookOpen, CalendarDays, ChevronRight,
  GraduationCap, Loader2, RefreshCw, UsersRound,
} from "lucide-react";
import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context";
import type { EntityContext } from "@/lib/command-center/entity-context";
import { ExplorerHorarioSemanal } from "@/components/secretaria/command-center/ExplorerHorario";
import { ExplorerMetric } from "@/components/secretaria/command-center/ExplorerMetric";
import { ExplorerHistoricalScopeNotice } from "@/components/secretaria/command-center/ExplorerHistoricalScopeNotice";
import { buildPortalHref } from "@/lib/navigation";
import { useProfessorContext } from "@/hooks/useProfessorContext";

type Props = {
  context: EntityContext;
  portal?: string;
  onExploreTurma: (turma: { id: string; label: string; academicYearId: string }) => void;
  onExploreDisciplina: (disciplina: { id: string; label: string; academicYearId: string }) => void;
  onNavigate: (href: string) => void;
};

export function ProfessorContextView({
  context, portal, onExploreTurma, onExploreDisciplina, onNavigate,
}: Props) {
  const { data, error, status, loading, refreshing, retry } = useProfessorContext(context);

  if (loading) return (
    <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-600" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> A carregar o professor…
    </div>
  );

  if (error || !data) return (
    <div className="space-y-3 p-3 text-sm" role="alert">
      <h2 className="text-lg font-semibold text-slate-900">Professor · {context.label}</h2>
      <p className="text-rose-700">{error || "Não foi possível carregar o professor."}</p>
      {status !== 401 && status !== 403 && status !== 404 && (
        <button type="button" onClick={() => void retry()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600">
          <RefreshCw className="h-4 w-4" aria-hidden /> Tentar novamente
        </button>
      )}
    </div>
  );

  const existingPage = buildPortalHref(
    context.escolaId,
    portal === "admin" ? "/admin/professores" : "/operacoes/professores",
  );
  const params = new URLSearchParams();
  params.set(ACADEMIC_YEAR_PARAM, data.anoLetivo.id);
  const pageHref = existingPage + (existingPage.includes("?") ? "&" : "?") + params.toString();
  const limited = data.limitado;
  const semAtribuicao = data.turmas.length === 0 && data.disciplinas.length === 0;
  const semHorario = data.horarios.length === 0;

  return (
    <div className="min-w-0 space-y-5 px-1 pb-3 text-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">
            Perfil académico · Ano letivo {data.anoLetivo.ano}
            {data.anoLetivo.historico ? " · Histórico" : ""}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">{data.professor.nome}</h2>
        </div>
        <button type="button" onClick={() => onNavigate(pageHref)}
          title="Abre o módulo de gestão de professores. As escritas ficam nesse módulo."
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600">
          Abrir gestão de professores <ArrowUpRight className="h-4 w-4" aria-hidden />
        </button>
      </header>

            {data.anoLetivo.historico && <ExplorerHistoricalScopeNotice />}

      <section aria-label="Indicadores académicos" className="flex flex-wrap gap-x-8 gap-y-4 border-y border-slate-100 py-4">
        <ExplorerMetric label="Turmas" value={data.stats.turmas} partial={limited} />
        <ExplorerMetric label="Disciplinas distintas" value={data.stats.disciplinas} partial={limited} />
        <ExplorerMetric label="Aulas em horário publicado" value={data.stats.aulasPublicadas} partial={limited} />
        {refreshing && <span role="status" className="self-center text-xs text-slate-500">A atualizar…</span>}
      </section>

      {limited && (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          Algumas vinculações ultrapassaram o limite de consulta. Os números são parciais; consulte a gestão para o restante.
        </p>
      )}
      {semAtribuicao && !limited && (
        <p className="text-xs text-slate-600">
          Sem atribuição de turma ou disciplina neste ano letivo (nas fontes desta visão).
        </p>
      )}
      {!semAtribuicao && semHorario && !limited && (
        <p className="text-xs text-slate-600">
          Há atribuições, mas sem horário publicado neste ano letivo.
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="min-w-0" aria-labelledby="professor-turmas-heading">
          <h3 id="professor-turmas-heading" className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
            <UsersRound className="h-4 w-4 text-emerald-700" aria-hidden /> Turmas atribuídas
          </h3>
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {data.turmas.map((turma) => (
              <button type="button" key={turma.id}
                onClick={() => onExploreTurma({
                  id: turma.id, label: turma.nome, academicYearId: data.anoLetivo.id,
                })}
                className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600">
                <GraduationCap className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">{turma.nome}</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    {[turma.cursoNome, turma.classeNome, turma.turno].filter(Boolean).join(" · ")
                      || "Sem detalhes académicos"}
                  </span>
                  {turma.disciplinas.length > 0 && (
                    <span className="mt-1 block break-words text-xs text-slate-600">
                      {turma.disciplinas.map((d) => d.nome).join(", ")}
                    </span>
                  )}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              </button>
            ))}
            {!data.turmas.length && (
              <p className="px-3 py-5 text-slate-500">{limited ? "Nenhuma turma identificada nos vínculos consultados; a lista é parcial." : "Nenhuma turma atribuída neste ano letivo."}</p>
            )}
          </div>
        </section>

        <section className="min-w-0" aria-labelledby="professor-disciplinas-heading">
          <h3 id="professor-disciplinas-heading" className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
            <BookOpen className="h-4 w-4 text-emerald-700" aria-hidden /> Disciplinas
          </h3>
          <div className="divide-y divide-slate-100  rounded-xl border border-slate-200">
            {data.disciplinas.map((disciplina) => (
              <button type="button" key={disciplina.id}
                onClick={() => onExploreDisciplina({
                  id: disciplina.id, label: disciplina.nome, academicYearId: data.anoLetivo.id,
                })}
                className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600">
                <span className="font-medium text-slate-900">{disciplina.nome}</span>
                <span className="flex shrink-0 items-center gap-1 text-xs tabular-nums text-slate-500">
                  {disciplina.turmas} {disciplina.turmas === 1 ? "turma" : "turmas"}
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </span>
              </button>
            ))}
            {!data.disciplinas.length && (
              <p className="px-3 py-5 text-slate-500">{limited ? "Nenhuma disciplina identificada nos vínculos consultados; a lista é parcial." : "Nenhuma disciplina atribuída neste ano letivo."}</p>
            )}
          </div>
        </section>
      </div>

      <section className="min-w-0" aria-labelledby="professor-horario-heading">
        <h3 id="professor-horario-heading" className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
          <CalendarDays className="h-4 w-4 text-emerald-700" aria-hidden /> Horário publicado
        </h3>
        {data.horarios.length > 0 ? (
          <ExplorerHorarioSemanal
            showTurma
            parcial={limited}
            aulas={data.horarios.map((aula, index) => ({
              id: [aula.turmaId, aula.diaSemana, aula.inicio, aula.fim, index].join(":"),
              turmaNome: aula.turmaNome,
              diaSemana: aula.diaSemana,
              inicio: aula.inicio,
              fim: aula.fim,
              disciplinaNome: aula.disciplinaNome || "Disciplina sem identificação",
              professorNome: null,
              salaNome: null,
            }))}
          />
        ) : (
          <p className="rounded-lg border border-slate-200 px-3 py-4 text-xs text-slate-600">
            {limited
              ? "Nenhum horário publicado identificado no recorte consultado; a lista é parcial."
              : "Sem horário publicado para este professor neste ano letivo."}
            {" "}Ausência de publicação não significa ausência de atribuição docente.
          </p>
        )}
      </section>

      <p className="text-xs text-slate-500">
        Apenas vínculos académicos e horários publicados.
        Contactos, documentos, remunerações, notas e pagamentos não são apresentados.
      </p>
    </div>
  );
}
