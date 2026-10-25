"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle, ArrowUpRight, BookOpen, ChevronLeft, ChevronRight, GraduationCap,
  Loader2, RefreshCw, Search, UsersRound,
} from "lucide-react";

import type { EntityContext } from "@/lib/command-center/entity-context";
import { ExplorerHorarioTurma } from "@/components/secretaria/command-center/ExplorerHorario";
import { ExplorerMetric } from "@/components/secretaria/command-center/ExplorerMetric";
import { buildPortalHref } from "@/lib/navigation";
import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context";
import { useCourseContext } from "@/hooks/useCourseContext";
import { useCourseTurmasPage } from "@/hooks/useCourseTurmasPage";
import { resolveCourseExplorerSelection } from "@/lib/command-center/course-explorer-selection";

type Props = {
  context: EntityContext;
  portal?: string;
  onNavigate: (href: string) => void;
  onExploreTurma: (turma: { id: string; label: string; academicYearId: string }) => void;
  onExploreClasse: (classe: { id: string; label: string; academicYearId: string }) => void;
  initialClasseId?: string | null;
  initialTurmaId?: string | null;
  onClasseChange?: (id: string | null) => void;
  onTurmaChange?: (id: string | null) => void;
};

function turmaOccupancyHint(alunos: number, capacidade: number | null | undefined) {
  if (capacidade == null) return `${alunos} alunos · Capacidade não definida`;
  const available = Math.max(capacidade - alunos, 0);
  const over = Math.max(alunos - capacidade, 0);
  if (over > 0) return `${alunos} alunos · Capacidade ${capacidade} · Excedente ${over}`;
  if (available === 0) return `${alunos} alunos · Capacidade ${capacidade} · Lotada`;
  return `${alunos} alunos · Capacidade ${capacidade} · ${available} ${available === 1 ? "vaga" : "vagas"}`;
}

export function CourseContextView({
  context, portal, onNavigate, onExploreTurma, onExploreClasse,
  initialClasseId, initialTurmaId, onClasseChange, onTurmaChange,
}: Props) {
  const { data, error, loading, retry } = useCourseContext(context);
  const reducedMotion = useReducedMotion();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  // Selection belongs to a specific school/course/year. A mounted explorer may
  // receive a different context without remounting; never reuse the old filter.
  const contextKey = [context.escolaId, context.id, context.academicYearId ?? ""].join(":");
  const [selection, setSelection] = useState(() => ({
    contextKey, classeId: initialClasseId ?? null, turmaId: initialTurmaId ?? null,
  }));
  const scoped = resolveCourseExplorerSelection({
    contextKey,
    selection,
    fallback: { classeId: initialClasseId ?? null, turmaId: initialTurmaId ?? null },
    classes: data?.classes,
    // The summary is deliberately capped at 100. Never invalidate a turma
    // selected on another server-side page by comparing to that old window.
  });
  const classeId = scoped.classeId;

  function selectClasse(id: string | null) {
    setPage(1);
    setSelection({ contextKey, classeId: id, turmaId: null });
    onClasseChange?.(id);
    onTurmaChange?.(null);
  }
  function setTurmaId(id: string | null) {
    setSelection({ contextKey, classeId, turmaId: id });
    // Keep the parent return-context in sync on searches and page changes.
    // Otherwise a remount may restore a turma that was already cleared.
    onTurmaChange?.(id);
  }

  const window = useCourseTurmasPage({
    context, enabled: Boolean(data), page, classeId, search,
  });
  // The paginated RPC owns the window and total. The legacy overview's first
  // 100 entries must never be misrepresented as an exhaustive list.
  const visibleTurmas = window.data?.items ?? [];
  const { turmaId } = resolveCourseExplorerSelection({
    contextKey, selection,
    fallback: { classeId: initialClasseId ?? null, turmaId: initialTurmaId ?? null },
    classes: data?.classes,
    turmas: window.data?.items,
  });
  const selectedTurma = visibleTurmas.find((turma) => turma.id === turmaId);
  const lastPage = Math.max(1, Math.ceil((window.data?.total ?? 0) / 25));
  const selectedClasse = data?.classes.find((classe) => classe.id === classeId);

  function openTurmaPage(id: string) {
    const base = portal === "admin" ? "/admin/turmas"
      : portal === "secretaria" ? "/secretaria/turmas"
      : "/operacoes/turmas";
    const href = buildPortalHref(context.escolaId, `${base}/${encodeURIComponent(id)}`);
    const qs = new URLSearchParams();
    if (data?.anoLetivo.id) qs.set(ACADEMIC_YEAR_PARAM, data.anoLetivo.id);
    onNavigate(`${href}${qs.size ? `${href.includes("?") ? "&" : "?"}${qs.toString()}` : ""}`);
  }

  /** NAV-02: a linha abre directamente o contexto da turma. */
  function exploreTurmaDirect(turma: { id: string; nome: string }) {
    setTurmaId(turma.id);
    if (!data) return;
    onExploreTurma({ id: turma.id, label: turma.nome, academicYearId: data.anoLetivo.id });
  }

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-500" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> A carregar contexto académico…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div role="alert" className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        <p>{error || "Não foi possível obter a visão do curso."}</p>
        <button type="button"
          className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 font-semibold text-rose-800 focus-visible:outline-2 focus-visible:outline-rose-700"
          onClick={() => void retry()}>
          <RefreshCw className="h-4 w-4" aria-hidden /> Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5 px-1 pb-3 text-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">
            {data.curso.codigo || "Curso"} · Ano letivo {data.anoLetivo.ano}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">{data.curso.nome || data.curso.codigo || "Curso"}</h2>
          {data.curso.descricao && (
            <p className="mt-1 max-w-2xl text-sm text-slate-600">{data.curso.descricao}</p>
          )}
        </div>
        <span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
          {data.curso.status || "Estado não informado"}
        </span>
      </header>

      <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-3 sm:gap-3">
        <ExplorerMetric label="Alunos matriculados" value={data.stats.alunos} />
        <ExplorerMetric label="Turmas ativas" value={data.stats.turmas} />
        <ExplorerMetric label="Classes" value={data.stats.classes} />
      </div>

      <nav aria-label="Navegação contextual" className="flex flex-wrap items-center gap-1 text-xs text-slate-600">
        <button type="button"
          className="rounded-lg px-2 py-1 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          onClick={() => selectClasse(null)}>
          Curso
        </button>
        {selectedClasse && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            <button type="button"
              className="rounded-lg px-2 py-1 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
              onClick={() => setTurmaId(null)}>
              {selectedClasse.nome}
            </button>
          </>
        )}
        {selectedTurma && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            <span aria-current="page" className="rounded-lg bg-slate-100 px-2 py-1 font-semibold text-slate-900">
              {selectedTurma.nome}
            </span>
          </>
        )}
      </nav>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="min-w-0 rounded-xl border border-slate-200 bg-white" aria-labelledby="curso-classes-heading">
          <h3 id="curso-classes-heading" className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 font-semibold text-[#1F6B3B]">
            <BookOpen className="h-4 w-4" aria-hidden /> Classes do curso
          </h3>
          <div className=" p-2">
            <button type="button"
              onClick={() => selectClasse(null)}
              aria-pressed={!classeId}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600 ${!classeId ? "bg-slate-100 font-semibold" : ""}`}>
              Todas as classes
              <span className="text-xs tabular-nums text-slate-500">{data.stats.turmas} turmas</span>
            </button>
            {data.classes.map((classe) => (
              <button type="button" key={classe.id}
                onClick={() => selectClasse(classe.id)}
                aria-pressed={classeId === classe.id}
                className={`mt-1 flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600 ${classeId === classe.id ? "bg-slate-100 font-semibold" : ""}`}>
                <span className="min-w-0 truncate">{classe.nome}</span>
                <span className="shrink-0 text-xs tabular-nums text-slate-500">
                  {classe.alunos} alunos · {classe.turmas} turmas
                </span>
              </button>
            ))}
            {!data.classes.length && (
              <p className="p-3 text-xs text-slate-500">Nenhuma classe vinculada ao curso neste ano.</p>
            )}
          </div>
          {selectedClasse && (
            <div className="border-t border-slate-100 p-3">
              <button type="button"
                onClick={() => onExploreClasse({
                  id: selectedClasse.id, label: selectedClasse.nome, academicYearId: data.anoLetivo.id,
                })}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-600">
                Explorar classe <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          )}
        </section>

        <section className="min-w-0 rounded-xl border border-slate-200 bg-white" aria-labelledby="curso-turmas-heading">
          <h3 id="curso-turmas-heading" className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 font-semibold text-[#1F6B3B]">
            <GraduationCap className="h-4 w-4" aria-hidden />
            {selectedClasse ? `Turmas · ${selectedClasse.nome}` : "Turmas do curso"}
          </h3>
          <div className="border-b border-slate-100 p-3">
            <label htmlFor="curso-turmas-search" className="mb-1.5 block text-xs font-medium text-slate-600">
              Pesquisar turmas deste curso
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
              <input id="curso-turmas-search" type="search" value={search}
                onChange={(event) => { setSearch(event.target.value.slice(0,72)); setPage(1); setTurmaId(null); }}
                placeholder="Nome da turma" maxLength={72}
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus-visible:outline-2 focus-visible:outline-emerald-600" />
            </div>
            <p role="status" className="mt-2 text-xs text-slate-600">
              {window.busy ? "A consultar turmas…" : window.error
                ? "Não foi possível carregar as turmas." :
                `${window.data?.total ?? 0} turmas encontradas · Página ${page} de ${lastPage}`}
            </p>
          </div>
          <div className="p-2">
            {window.error && (
              <p role="alert" className="p-3 text-xs text-rose-700">
                {window.error}
                <button type="button" onClick={() => void window.retry()}
                  className="ml-2 underline focus-visible:outline-2 focus-visible:outline-emerald-600">Tentar novamente</button>
              </p>
            )}
            {window.busy && <p role="status" className="p-3 text-xs text-slate-600">A carregar a página…</p>}
            {!window.busy && !window.error && visibleTurmas.map((turma) => (
              <button type="button" key={turma.id}
                onClick={() => exploreTurmaDirect(turma)}
                aria-pressed={turmaId === turma.id}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600 ${turmaId === turma.id ? "bg-slate-100" : ""}`}>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{turma.nome}</span>
                  <span className="mt-0.5 block text-[11px] tabular-nums text-slate-500">
                    {turmaOccupancyHint(turma.alunos, turma.capacidade)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-slate-500">
                  <UsersRound className="h-3.5 w-3.5" aria-hidden /> {turma.alunos}
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </span>
              </button>
            ))}
            {!window.busy && !window.error && !visibleTurmas.length && (
              <p className="p-3 text-xs text-slate-500">Nenhuma turma encontrada com estes filtros.</p>
            )}
          </div>
          {!window.error && !window.busy && (
            <nav aria-label="Paginação de turmas do curso"
              className="flex items-center justify-between gap-3 border-t border-slate-100 px-3 py-2">
              <button type="button" disabled={page <= 1}
                onClick={() => { setPage((previous) => Math.max(1, previous - 1)); setTurmaId(null); }}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" aria-hidden /> Anterior
              </button>
              <span className="text-xs tabular-nums text-slate-600" aria-live="polite">
                {page} / {lastPage}
              </span>
              <button type="button" disabled={!window.data?.hasMore}
                onClick={() => { setPage((previous) => previous + 1); setTurmaId(null); }}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:opacity-40">
                Seguinte <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </nav>
          )}
        </section>
      </div>

      <AnimatePresence initial={false} mode="wait">
        {selectedTurma && (
          <motion.section
            key={selectedTurma.id}
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            aria-label="Turma selecionada"
            aria-live="polite"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <div>
              <p className="font-semibold text-slate-900">{selectedTurma.nome}</p>
              <p className="mt-1 text-xs text-slate-600">
                {turmaOccupancyHint(selectedTurma.alunos, selectedTurma.capacidade)}
                {" · "}
                {selectedTurma.turno || "Turno não informado"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button"
                onClick={() => onExploreTurma({
                  id: selectedTurma.id, label: selectedTurma.nome, academicYearId: data.anoLetivo.id,
                })}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
                Explorar turma <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" onClick={() => openTurmaPage(selectedTurma.id)}
                title="Abrir página da turma"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-600">
                Abrir página <ArrowUpRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <ExplorerHorarioTurma
        key={[context.escolaId, context.id, data.anoLetivo.id, classeId ?? "todas"].join(":")}
        escolaId={context.escolaId} anoLetivoId={data.anoLetivo.id}
        turmas={visibleTurmas} listaParcial={Boolean(window.data?.hasMore) || Boolean(window.error) || window.busy}
      />

      {window.error && (
        <p className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Não foi possível carregar todas as turmas. Tente novamente.
        </p>
      )}
    </div>
  );
}
