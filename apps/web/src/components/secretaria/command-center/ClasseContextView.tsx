"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle, ArrowUpRight, BookOpen, ChevronLeft, ChevronRight,
  GraduationCap, Loader2, RefreshCw, UsersRound,
} from "lucide-react";

import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context";
import type { EntityContext } from "@/lib/command-center/entity-context";
import { useClasseContext } from "@/hooks/useClasseContext";
import { buildPortalHref } from "@/lib/navigation";
import { useExplorerRoster } from "@/hooks/useExplorerRoster";
import { ExplorerRosterControls } from "@/components/secretaria/command-center/ExplorerRosterControls";
import type { ExplorerViewState } from "@/lib/command-center/explorer-return-context";

type NextEntity = { id: string; label: string; academicYearId: string };
type Props = {
  context: EntityContext;
  portal?: string;
  onNavigate: (href: string) => void;
  onExploreCurso: (entity: NextEntity) => void;
  onExploreTurma: (entity: NextEntity) => void;
  onExploreDisciplina: (entity: NextEntity) => void;
  onExploreProfessor: (entity: NextEntity) => void;
  onStudentSelect: (student: { id: string; label: string }) => void;
  initialPage?: number;
  initialScrollTop?: number;
  selectedStudentId?: string | null;
  initialSearch?: string;
  onViewChange?: (state: ExplorerViewState) => void;
};

const numberPt = (value: number) => new Intl.NumberFormat("pt-AO").format(value);

/** Capacidade registada ≠ vagas disponíveis. Null = não definida (nunca zero inventado). */
function occupancyFromCapacity(capacity: number | null, enrolled: number) {
  if (capacity == null) {
    return { available: null as number | null, overcapacity: null as number | null };
  }
  return {
    available: Math.max(capacity - enrolled, 0),
    overcapacity: Math.max(enrolled - capacity, 0),
  };
}

function Metric({
  label, value, limited, hint,
}: {
  label: string;
  value: number | null;
  limited?: boolean;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
        {value == null ? "Não definida" : numberPt(value)}
        {limited && value != null ? "+" : ""}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{hint}</p> : null}
    </div>
  );
}

function turmaOccupancyLabel(alunos: number, capacidade: number | null) {
  if (capacidade == null) {
    return `${alunos} ${alunos === 1 ? "aluno" : "alunos"} · Capacidade não definida`;
  }
  const { available, overcapacity } = occupancyFromCapacity(capacidade, alunos);
  if (overcapacity && overcapacity > 0) {
    return `${alunos} ${alunos === 1 ? "aluno" : "alunos"} · Capacidade ${capacidade} · Excedente ${overcapacity}`;
  }
  if (available === 0) {
    return `${alunos} ${alunos === 1 ? "aluno" : "alunos"} · Capacidade ${capacidade} · Lotada`;
  }
  return `${alunos} ${alunos === 1 ? "aluno" : "alunos"} · Capacidade ${capacidade} · ${available} ${available === 1 ? "vaga" : "vagas"}`;
}

export function ClasseContextView({
  context, portal, onNavigate, onExploreCurso, onExploreTurma,
  onExploreDisciplina, onExploreProfessor, onStudentSelect,
  initialPage = 1, initialScrollTop = 0, selectedStudentId = null, initialSearch = "", onViewChange,
}: Props) {
  const [page, setPage] = useState(initialPage);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const roster = useExplorerRoster(context, "classe", searchTerm);
  const searchActive = searchTerm.trim().length >= 2;
  const view = useCallback((selected: string | null = currentStudent.current): ExplorerViewState => ({
    page, scrollTop: currentScroll.current, selectedStudentId: selected,
    search: searchTerm, filter: "ativo", sort: "nome",
  }), [page, searchTerm]);
  const { data, loading, refreshing, error, status, retry } = useClasseContext(context, page);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentScroll = useRef(initialScrollTop);
  const currentStudent = useRef(selectedStudentId);
  const onViewChangeRef = useRef(onViewChange);
  useEffect(() => { onViewChangeRef.current = onViewChange; }, [onViewChange]);
  const restoreScroll = useRef(initialScrollTop);
  useEffect(() => {
    if (loading || !scrollRef.current) return;
    scrollRef.current.scrollTop = restoreScroll.current;
    const selected = currentStudent.current;
    if (selected) {
      const row = Array.from(scrollRef.current.querySelectorAll<HTMLElement>("[data-student-id]")).find((item) => item.dataset.studentId === selected);
      if (row) row.focus({ preventScroll: true });
    }
  }, [loading, page]);
  useEffect(() => {
    onViewChangeRef.current?.(view());
  }, [page, view]);
  const selectStudent = (student: { id: string; label: string }) => {
    currentStudent.current = student.id;
    onViewChangeRef.current?.(view(student.id));
    onStudentSelect(student);
  };

  if (loading) return (
    <div role="status" className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-600">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> A carregar a classe…
    </div>
  );
  if (error || !data) return (
    <div role="alert" className="space-y-3 p-3 text-sm">
      <p className="text-rose-700">{error || "Não foi possível carregar esta classe."}</p>
      {status !== 401 && status !== 403 && status !== 404 && (
        <button type="button" onClick={() => void retry()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600">
          <RefreshCw className="h-4 w-4" aria-hidden /> Tentar novamente
        </button>
      )}
    </div>
  );

  const { classe, anoLetivo, stats, turmas, disciplinas, professores, alunos, limitado } = data;
  const base = buildPortalHref(context.escolaId, portal === "admin"
    ? "/admin/configuracoes" : "/operacoes/configuracoes");
  const href = `${base}${base.includes("?") ? "&" : "?"}${new URLSearchParams({
    [ACADEMIC_YEAR_PARAM]: anoLetivo.id,
  })}`;
  const visibleStudents = searchActive ? roster.items : alunos.items;
  const returnWarning = Boolean(selectedStudentId && (!searchActive || (!roster.loading && !roster.refreshing)) &&
    !visibleStudents.some((student) => student.id === selectedStudentId));
  const pages = Math.max(1, Math.ceil(alunos.total / alunos.pageSize));
  const open = (entity: { id: string; nome: string }, onExplore: (next: NextEntity) => void) =>
    onExplore({ id: entity.id, label: entity.nome, academicYearId: anoLetivo.id });

  const classOccupancy = occupancyFromCapacity(stats.capacidade, stats.alunos);
  const turmasSemAlunos = turmas.filter((t) => t.alunos === 0).length;

  return (
    <div ref={scrollRef} onScroll={(event) => { currentScroll.current = event.currentTarget.scrollTop; onViewChangeRef.current?.({ page, scrollTop: currentScroll.current, selectedStudentId: currentStudent.current }); }} className="max-h-[min(70vh,720px)] space-y-5 overflow-y-auto px-1 pb-3 text-sm">
      {returnWarning && (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          O aluno atendido já não consta desta página. A lista foi actualizada; confirme a matrícula e a turma antes de continuar.
        </p>
      )}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">
            Classe · Ano letivo {anoLetivo.ano}{anoLetivo.historico ? " · Histórico" : ""}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">{classe.nome}</h2>
          {classe.curso && (
            <button type="button" onClick={() => open(classe.curso!, onExploreCurso)}
              className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-800 hover:underline focus-visible:outline-2 focus-visible:outline-emerald-600">
              {classe.curso.nome} <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
        <button type="button" onClick={() => onNavigate(href)}
          title="Abre o módulo de gestão académica (configurações). Não executa alterações neste explorador."
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600">
          Abrir gestão académica <ArrowUpRight className="h-4 w-4" aria-hidden />
        </button>
      </header>

      <section aria-label="Indicadores da classe" className="flex flex-wrap gap-x-8 gap-y-4 border-y border-slate-100 py-4">
        <Metric label="Alunos matriculados" value={stats.alunos} limited={limitado} />
        <Metric label="Turmas do ano" value={stats.turmas} limited={limitado} />
        <Metric
          label="Capacidade"
          value={stats.capacidade}
          limited={limitado}
          hint={stats.capacidade == null ? "Soma só quando todas as turmas têm capacidade definida" : undefined}
        />
        <Metric
          label="Vagas disponíveis"
          value={classOccupancy.available}
          limited={limitado}
          hint={stats.capacidade == null ? "Indisponível sem capacidade completa" : undefined}
        />
        {classOccupancy.overcapacity != null && classOccupancy.overcapacity > 0 && (
          <Metric
            label="Excedente de lotação"
            value={classOccupancy.overcapacity}
            hint="Alunos acima da capacidade registada"
          />
        )}
        <Metric label="Disciplinas" value={stats.disciplinas} limited={limitado} />
        <Metric label="Professores" value={stats.professores} limited={limitado} />
        {refreshing && (
          <span role="status" className="self-center text-xs text-slate-500">A atualizar…</span>
        )}
      </section>

      {stats.capacidade === null && (
        <p className="text-xs text-slate-500">
          A capacidade total e as vagas disponíveis não são calculadas quando uma ou mais turmas
          não têm capacidade definida. Capacidade desconhecida não é tratada como zero.
        </p>
      )}
      {limitado && (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          Os vínculos excedem o limite de consulta. As contagens são parciais e não representam o total da classe.
        </p>
      )}
      {turmasSemAlunos > 0 && (
        <p className="text-xs text-slate-600">
          {turmasSemAlunos === 1
            ? "1 turma sem alunos matriculados neste ano."
            : `${turmasSemAlunos} turmas sem alunos matriculados neste ano.`}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="min-w-0" aria-labelledby="classe-turmas-heading">
          <h3 id="classe-turmas-heading" className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
            <GraduationCap className="h-4 w-4 text-emerald-700" aria-hidden /> Turmas
          </h3>
          <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
            {turmas.map((turma) => (
              <button type="button" key={turma.id}
                onClick={() => open(turma, onExploreTurma)}
                className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">{turma.nome}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {[turma.turno, turma.sala ? `Sala ${turma.sala}` : null].filter(Boolean).join(" · ") || "Turno não informado"}
                  </span>
                  <span className="mt-1 block text-xs tabular-nums text-slate-600">
                    {turmaOccupancyLabel(turma.alunos, turma.capacidade)}
                  </span>
                  {turma.alunos === 0 && (
                    <span className="mt-1 block text-[11px] text-amber-800">Sem alunos neste ano</span>
                  )}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              </button>
            ))}
            {!turmas.length && (
              <p className="px-3 py-5 text-slate-500">Nenhuma turma vinculada à classe neste ano letivo.</p>
            )}
          </div>
        </section>
        <section className="min-w-0" aria-labelledby="classe-disciplinas-heading">
          <h3 id="classe-disciplinas-heading" className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
            <BookOpen className="h-4 w-4 text-emerald-700" aria-hidden /> Disciplinas
          </h3>
          <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
            {disciplinas.map((disciplina) => (
              <button type="button" key={disciplina.id}
                onClick={() => open(disciplina, onExploreDisciplina)}
                className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">{disciplina.nome}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {disciplina.naMatriz ? "Na matriz curricular" : "Vínculo de turma"}
                    {disciplina.cargaHorariaSemanal != null ? ` · ${disciplina.cargaHorariaSemanal} h/semana` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-slate-500">
                  {disciplina.turmas} {disciplina.turmas === 1 ? "turma" : "turmas"}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              </button>
            ))}
            {!disciplinas.length && (
              <p className="px-3 py-5 text-slate-500">Nenhuma disciplina vinculada.</p>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Matriz curricular é referência; não implica professor ou turma atribuídos neste ano.
          </p>
        </section>
      </div>

      <section className="min-w-0" aria-labelledby="classe-professores-heading">
        <h3 id="classe-professores-heading" className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
          <UsersRound className="h-4 w-4 text-emerald-700" aria-hidden /> Professores das turmas
        </h3>
        <div className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
          {professores.map((professor) => (
            <button type="button" key={professor.id}
              onClick={() => open(professor, onExploreProfessor)}
              className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600">
              <span className="truncate font-medium text-slate-900">{professor.nome}</span>
              <span className="shrink-0 text-xs text-slate-500">
                {professor.turmas} {professor.turmas === 1 ? "turma" : "turmas"}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            </button>
          ))}
          {!professores.length && (
            <p className="px-3 py-5 text-slate-500">Nenhum professor atribuído às turmas deste ano.</p>
          )}
        </div>
      </section>

      <section className="min-w-0" aria-labelledby="classe-alunos-heading">
        <ExplorerRosterControls value={searchTerm} onChange={(next) => {
          setSearchTerm(next);
          onViewChangeRef.current?.({ ...view(), search: next });
        }} />
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 id="classe-alunos-heading" className="flex items-center gap-2 font-semibold text-slate-900">
            <UsersRound className="h-4 w-4 text-emerald-700" aria-hidden /> Alunos
          </h3>
          <span className="text-xs text-slate-500" aria-live="polite">
            {searchActive ? `${roster.total} encontrados` : refreshing ? "A actualizar…" : `${alunos.total} distintos`}
          </span>
        </div>
        {searchActive && (roster.loading || roster.refreshing) && <p role="status" className="my-2 text-xs text-slate-600">A pesquisar alunos…</p>}
        {searchActive && roster.error && <p role="alert" className="my-2 text-xs text-rose-700">{roster.error} <button type="button" onClick={() => void roster.retry()} className="underline">Tentar novamente</button></p>}
        {roster.waitingForMinimum && <p className="my-2 text-xs text-slate-600">Introduza pelo menos dois caracteres para pesquisar.</p>}
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {visibleStudents.map((aluno) => (
            <button type="button" key={aluno.id}
              data-student-id={aluno.id} aria-current={selectedStudentId === aluno.id ? "true" : undefined} onClick={() => selectStudent({ id: aluno.id, label: aluno.nome })}
              className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-slate-900">{aluno.nome}</span>
                <span className="mt-1 block truncate text-xs text-slate-500">{aluno.turmaNome}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            </button>
          ))}
          {!visibleStudents.length && !roster.loading && (
            <p className="px-3 py-5 text-slate-500">Sem alunos matriculados neste âmbito.</p>
          )}
        </div>
        {!searchActive && alunos.total > alunos.pageSize && (
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-xs tabular-nums text-slate-500" aria-live="polite">
              Página {alunos.page} de {pages}
            </span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1 || refreshing}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-emerald-600">
                <ChevronLeft className="h-4 w-4" aria-hidden /> Anterior
              </button>
              <button type="button" disabled={!alunos.hasMore || refreshing}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-emerald-600">
                Seguinte <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        )}
        {searchActive && roster.hasMore && <button type="button" onClick={() => void roster.loadMore()} className="mt-3 rounded-lg border px-3 py-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-emerald-600">Carregar mais alunos</button>}
      </section>
      <p className="text-xs text-slate-500">
        Apenas alunos ativos no ano atual ou concluídos no histórico, excluindo cancelados e transferidos.
        O Balcão mantém as ações existentes; nenhum dado financeiro é carregado aqui.
      </p>
    </div>
  );
}
