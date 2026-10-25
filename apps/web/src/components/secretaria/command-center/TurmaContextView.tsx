"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  AlertCircle, ArrowUpRight, BookOpen, ChevronLeft, ChevronRight,
  Loader2, RefreshCw, UsersRound,
} from "lucide-react";
import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context";
import type { EntityContext } from "@/lib/command-center/entity-context";
import { ExplorerHorarioTurma } from "@/components/secretaria/command-center/ExplorerHorario";
import { ExplorerMetric } from "@/components/secretaria/command-center/ExplorerMetric";
import { ExplorerHistoricalScopeNotice } from "@/components/secretaria/command-center/ExplorerHistoricalScopeNotice";
import { buildPortalHref } from "@/lib/navigation";
import { useExplorerRoster, type RosterSort, type RosterFilter } from "@/hooks/useExplorerRoster";
import { ExplorerRosterControls } from "@/components/secretaria/command-center/ExplorerRosterControls";
import { ExplorerRosterExportButton } from "@/components/secretaria/command-center/ExplorerRosterExportButton";
import { ExplorerStudentActions } from "@/components/secretaria/command-center/ExplorerStudentActions";
import type { ExplorerActionId } from "@/lib/command-center/student-capabilities";
import type { ExplorerViewState } from "@/lib/command-center/explorer-return-context";
import { useTurmaContext } from "@/hooks/useTurmaContext";
import { academicLinkState, academicCurriculumNotice, missingTeacherEvidenceLabel, ACADEMIC_LINK_LABELS } from "@/lib/command-center/academic-relations";

type Props = {
  context: EntityContext;
  portal?: string;
  onNavigate: (href: string) => void;
  onStudentSelect: (student: { id: string; label: string }) => void;
  onStudentAction: (action: ExplorerActionId, student: { id: string; label: string }) => void;
  initialPage?: number;
  initialScrollTop?: number;
  selectedStudentId?: string | null;
  initialSearch?: string;
  initialSort?: RosterSort;
  initialFilter?: RosterFilter;
  onViewChange?: (state: ExplorerViewState) => void;
  /** The Command Palette owns the only scrollable viewport. */
  scrollContainerRef?: RefObject<HTMLElement | null>;
  onExploreProfessor: (professor: { id: string; label: string; academicYearId: string }) => void;
  onExploreDisciplina: (disciplina: { id: string; label: string; academicYearId: string }) => void;
  onExploreClasse: (classe: { id: string; label: string; academicYearId: string }) => void;
};

function occupancyFromCapacity(capacity: number | null | undefined, enrolled: number) {
  if (capacity == null) {
    return { available: null as number | null, overcapacity: null as number | null };
  }
  return {
    available: Math.max(capacity - enrolled, 0),
    overcapacity: Math.max(enrolled - capacity, 0),
  };
}

export function TurmaContextView({
  context, portal, onNavigate, onStudentSelect, onStudentAction, onExploreProfessor, onExploreDisciplina, onExploreClasse,
  initialPage = 1, initialScrollTop = 0, selectedStudentId = null, initialSearch = "", initialSort = "nome_asc", initialFilter = "todos", onViewChange, scrollContainerRef,
}: Props) {
  const [page, setPage] = useState(initialPage);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [rosterSort, setRosterSort] = useState<RosterSort>(initialSort);
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>(initialFilter);
  const [activeTab, setActiveTab] = useState<"alunos" | "horario" | "disciplinas">("alunos");
  const { data, error, status, loading, refreshing, retry } = useTurmaContext(context, page);
  const roster = useExplorerRoster(context, "turma", searchTerm, rosterSort, rosterFilter, data?.turma.anoLetivo.historico === false);
  const searchActive = data?.turma.anoLetivo.historico === false && (searchTerm.trim().length >= 2 ||
    (searchTerm.trim().length === 0 && (rosterSort !== "nome_asc" || rosterFilter !== "todos")));
  const scrollRestored = useRef(false);
  const currentStudent = useRef(selectedStudentId);
  const onViewChangeRef = useRef(onViewChange);
  useEffect(() => { onViewChangeRef.current = onViewChange; }, [onViewChange]);
  const view = useCallback((selected: string | null = currentStudent.current): ExplorerViewState => ({
    page,
    // Before restoring the viewport, never overwrite the saved scroll with 0.
    scrollTop: scrollRestored.current
      ? scrollContainerRef?.current?.scrollTop ?? initialScrollTop
      : initialScrollTop,
    selectedStudentId: selected,
    search: searchTerm, filter: rosterFilter, sort: rosterSort,
  }), [page, initialScrollTop, scrollContainerRef, searchTerm, rosterSort, rosterFilter]);

  // Restore only once, after the actual roster exists. The scrolling surface
  // belongs to CommandPalette; this view must never create a second scroll.
  useEffect(() => {
    const container = scrollContainerRef?.current;
    if (loading || !container || scrollRestored.current ||
        (searchActive && (!roster.querySettled || roster.loading || roster.refreshing))) return;
    const frame = requestAnimationFrame(() => {
      if (!container.isConnected || scrollRestored.current) return;
      container.scrollTop = initialScrollTop;
      scrollRestored.current = true;
      if (currentStudent.current) {
        const row = Array.from(container.querySelectorAll<HTMLElement>("[data-student-id]"))
          .find((item) => item.dataset.studentId === currentStudent.current);
        row?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [loading, scrollContainerRef, initialScrollTop,
    searchActive, roster.querySettled, roster.loading, roster.refreshing]);
  useEffect(() => {
    onViewChangeRef.current?.(view());
  }, [page, view]);
  const selectStudent = (student: { id: string; label: string }) => {
    currentStudent.current = student.id;
    onViewChangeRef.current?.(view(student.id));
    onStudentSelect(student);
  };

  function openExisting() {
    const base = portal === "admin" ? "/admin/turmas"
      : portal === "secretaria" ? "/secretaria/turmas"
      : "/operacoes/turmas";
    const href = buildPortalHref(context.escolaId, `${base}/${encodeURIComponent(context.id)}`);
    const params = new URLSearchParams();
    if (data?.turma.anoLetivo.id) params.set(ACADEMIC_YEAR_PARAM, data.turma.anoLetivo.id);
    onNavigate(href + (params.size ? (href.includes("?") ? "&" : "?") + params.toString() : ""));
  }

  if (loading) return (
    <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-600" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> A carregar a turma…
    </div>
  );

  if (error || !data) return (
    <div className="space-y-3 p-3 text-sm" role="alert">
      <p className="text-rose-700">{error || "Não foi possível carregar a turma."}</p>
      {status !== 401 && status !== 403 && status !== 404 && (
        <button type="button" onClick={() => void retry()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600">
          <RefreshCw className="h-4 w-4" aria-hidden /> Tentar novamente
        </button>
      )}
    </div>
  );

  const { turma, alunos, disciplinas, professores } = data;
  const rosterBusy = searchActive && (!roster.querySettled || roster.loading || roster.refreshing);
  const rosterReady = searchActive && !rosterBusy && !roster.error;
  const visibleStudents = searchActive
    ? roster.querySettled ? roster.items : []
    : alunos.items;
  const returnWarning = Boolean(selectedStudentId && (!searchActive || rosterReady) &&
    !visibleStudents.some((student) => student.id === selectedStudentId));
  const pages = Math.max(1, Math.ceil(alunos.total / alunos.pageSize));
  const occupancy = occupancyFromCapacity(turma.capacidade, alunos.total);
  const disciplinasSemProfessor = disciplinas.filter((d) => !d.professores.length).length;

  return (
    <div className="min-w-0 space-y-5 px-1 pb-3 text-sm">
      {returnWarning && (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          O aluno selecionado não está nesta página ou nos filtros atuais. A seleção foi preservada; confirme a turma antes de continuar o atendimento.
        </p>
      )}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">
            {turma.curso?.nome || "Curso"} · Ano letivo {turma.anoLetivo.ano}
            {turma.anoLetivo.historico ? " · Histórico" : ""}
          </p>
          {turma.classe && (
            <button type="button" onClick={() => onExploreClasse({
              id: turma.classe!.id, label: turma.classe!.nome, academicYearId: turma.anoLetivo.id,
            })} className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-800 hover:underline focus-visible:outline-2 focus-visible:outline-emerald-600">
              {turma.classe.nome} <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
          <h2 className="mt-1 text-xl font-semibold text-slate-900">{turma.nome}</h2>
          <p className="mt-1 text-xs text-slate-600">
            {turma.turno || "Turno não definido"} · {turma.sala ? `Sala ${turma.sala}` : "Sala não definida"}
          </p>
        </div>
        <button type="button" onClick={openExisting}
          title="Abre a página canónica da turma. As escritas ficam nesse módulo."
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600">
          Abrir página da turma <ArrowUpRight className="h-4 w-4" aria-hidden />
        </button>
      </header>

      {turma.anoLetivo.historico && <ExplorerHistoricalScopeNotice roster />}

      <section aria-label="Indicadores da turma" className="flex flex-wrap gap-x-8 gap-y-4 border-y border-slate-100 py-4">
        <ExplorerMetric label="Alunos matriculados" value={alunos.total} />
        <ExplorerMetric
          label="Capacidade"
          value={turma.capacidade ?? null}
          hint={turma.capacidade == null ? "Não definida nesta turma" : undefined}
        />
        <ExplorerMetric
          label="Vagas disponíveis"
          value={occupancy.available}
          hint={turma.capacidade == null ? "Indisponível sem capacidade" : undefined}
        />
        {occupancy.overcapacity != null && occupancy.overcapacity > 0 && (
          <ExplorerMetric label="Excedente de lotação" value={occupancy.overcapacity} hint="Acima da capacidade registada" />
        )}
        <ExplorerMetric label="Disciplinas" value={disciplinas.length} partial={data.disciplinasLimitadas} />
        <ExplorerMetric label="Professores vinculados" value={data.professoresDetalhes?.length ?? professores.length} partial={data.disciplinasLimitadas} />
        {refreshing && <span role="status" className="self-center text-xs text-slate-500">A atualizar…</span>}
      </section>

      <div role="tablist" aria-label="Vistas da turma"
        className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
        {([
          { id: "alunos", label: "Alunos" },
          { id: "horario", label: "Horário" },
          { id: "disciplinas", label: "Disciplinas" },
        ] as const).map(({ id, label }) => (
          <button key={id} type="button" role="tab" id={"turma-tab-" + id}
            aria-controls={"turma-tabpanel-" + id} aria-selected={activeTab === id}
            tabIndex={0} onClick={() => setActiveTab(id)}
            className={"min-w-0 flex-1 rounded-lg px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 " +
              (activeTab === id ? "bg-white text-emerald-900 shadow-sm" : "text-slate-600 hover:text-slate-900")}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === "horario" && (
        <div role="tabpanel" id="turma-tabpanel-horario" aria-labelledby="turma-tab-horario" tabIndex={0}>
          <ExplorerHorarioTurma key={[context.escolaId, turma.id, turma.anoLetivo.id].join(":")}
            escolaId={context.escolaId} anoLetivoId={turma.anoLetivo.id}
            turmaId={turma.id} initiallyExpanded />
        </div>
      )}

      {occupancy.overcapacity != null && occupancy.overcapacity > 0 && (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <span>Lotação excedida em {occupancy.overcapacity} alunos. Fonte: capacidade registada da turma e matrículas activas deste ano.</span>
          <button type="button" onClick={openExisting} className="font-semibold underline focus-visible:outline-2 focus-visible:outline-emerald-600">
            Abrir gestão da turma
          </button>
        </div>
      )}

      {!data.disciplinasLimitadas && disciplinasSemProfessor > 0 && (
        <p className="text-xs text-slate-600">
          {disciplinasSemProfessor === 1
            ? "1 disciplina sem professor vinculado nesta visão."
            : `${disciplinasSemProfessor} disciplinas sem professor vinculado nesta visão.`}
        </p>
      )}

      {activeTab === "alunos" && !turma.anoLetivo.historico && (
        <>
          <ExplorerRosterControls
            value={searchTerm}
            sort={rosterSort}
            filter={rosterFilter}
            onFilterChange={(next) => {
              setRosterFilter(next);
              onViewChangeRef.current?.({ ...view(), filter: next });
            }}
            onSortChange={(next) => {
              setRosterSort(next);
              onViewChangeRef.current?.({ ...view(), sort: next });
            }}
            onChange={(next) => {
              setSearchTerm(next);
              onViewChangeRef.current?.({ ...view(), search: next });
            }}
          />
          <ExplorerRosterExportButton
            escolaId={context.escolaId}
            entityId={context.id}
            type="turma"
            yearId={context.academicYearId}
            query={searchTerm}
            filter={rosterFilter}
            sort={rosterSort}
          />
        </>
      )}
      <div className="min-w-0">
        {activeTab === "alunos" && (
        <section role="tabpanel" id="turma-tabpanel-alunos" aria-labelledby="turma-tab-alunos"
          tabIndex={0} className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 id="turma-alunos-heading" className="flex items-center gap-2 font-semibold text-slate-900">
              <UsersRound className="h-4 w-4 text-emerald-700" aria-hidden /> Alunos
            </h3>
            <span className="text-xs text-slate-500" aria-live="polite">
              {searchActive ? rosterBusy ? "A pesquisar…" : roster.error ? "Pesquisa indisponível" : `${roster.total} encontrados` : refreshing ? "A actualizar…" : `${alunos.total} no total`}
            </span>
          </div>
          {rosterBusy && <p role="status" className="my-2 text-xs text-slate-600">A pesquisar alunos…</p>}
          {searchActive && roster.error && <p role="alert" className="my-2 text-xs text-rose-700">{roster.error} <button type="button" onClick={() => void roster.retry()} className="underline">Tentar novamente</button></p>}
          {!turma.anoLetivo.historico && roster.waitingForMinimum && <p className="my-2 text-xs text-slate-600">Introduza pelo menos dois caracteres para pesquisar.</p>}
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {visibleStudents.map((student) => (
<div key={student.id} className="flex min-w-0 flex-wrap items-center gap-2 border-b border-slate-100 px-2 py-1 last:border-0">
              <button type="button"
                data-student-id={student.id} aria-current={selectedStudentId === student.id ? "true" : undefined} onClick={() => selectStudent({ id: student.id, label: student.nome })}
                className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600">
                <span className="w-8 shrink-0 text-xs tabular-nums text-slate-500">{student.numeroChamada ?? "—"}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{student.nome}</span>
                {searchActive && "documentosSinalizados" in student && student.documentosSinalizados === true && (
                  <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-900">Documentos sinalizados</span>
                )}
                {searchActive && "propinasVencidas" in student && student.propinasVencidas === true && (
                  <span className="rounded border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[10px] text-orange-950">Propina vencida</span>
                )}
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              </button>
  <ExplorerStudentActions escolaId={context.escolaId} alunoId={student.id} alunoNome={student.nome}
    onAction={(action) => onStudentAction(action, { id: student.id, label: student.nome })} />
</div>
            ))}
            {!visibleStudents.length && !rosterBusy && !(searchActive && roster.error) && (
            <p className="px-3 py-5 text-slate-500">
              {searchActive ? "Nenhum aluno encontrado nos filtros selecionados."
                : alunos.total > 0 ? "Nenhum aluno nesta página; consulte outra página."
                : "Nenhum aluno matriculado neste âmbito."}
            </p>
          )}
          </div>
          {!searchActive && <div className="mt-3 flex items-center justify-between gap-2">
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
          </div>}
          {rosterReady && roster.hasMore && <button type="button" onClick={() => void roster.loadMore()} className="mt-3 rounded-lg border px-3 py-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-emerald-600">Carregar mais alunos</button>}
        </section>
        )}

        {activeTab === "disciplinas" && (
        <section role="tabpanel" id="turma-tabpanel-disciplinas" aria-labelledby="turma-tab-disciplinas"
          tabIndex={0} className="min-w-0">
          <h3 id="turma-disciplinas-heading" className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
            <BookOpen className="h-4 w-4 text-emerald-700" aria-hidden /> Disciplinas e professores
          </h3>
          <div className="divide-y divide-slate-100  rounded-xl border border-slate-200">
            {disciplinas.map((d) => (
              <div key={d.id} className="px-3 py-3">
                <button type="button"
                  onClick={() => onExploreDisciplina({ id: d.id, label: d.nome, academicYearId: turma.anoLetivo.id })}
                  className="inline-flex items-center gap-1 text-left font-medium text-emerald-800 hover:underline focus-visible:outline-2 focus-visible:outline-emerald-600">
                  {d.nome} <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </button>
                {d.curriculumActive === false && (
                  <p className="mt-1 text-xs text-amber-800" role="status">
                    {academicCurriculumNotice({
                      curriculumActive: d.curriculumActive, assignedToTurma: true,
                      teacherAssigned: d.professores.length > 0,
                      schedulePublished: false, historicalYear: turma.anoLetivo.historico,
                    })}
                    {" · Vínculo: "}
                    {ACADEMIC_LINK_LABELS[academicLinkState({
                      curriculumActive: d.curriculumActive, assignedToTurma: true,
                      teacherAssigned: d.professores.length > 0,
                      schedulePublished: false, historicalYear: turma.anoLetivo.historico,
                    })]}
                  </p>
                )}
                <p className={`mt-1 text-xs ${d.professores.length ? "text-slate-500" : "text-amber-800"}`}>
                  {d.professores.length ? d.professores.join(", ") : missingTeacherEvidenceLabel(data.disciplinasLimitadas)}
                </p>
              </div>
            ))}
            {!disciplinas.length && (
              <p className="px-3 py-5 text-slate-500">{data.disciplinasLimitadas ? "Não foi possível confirmar as disciplinas fora do recorte consultado." : "Nenhuma disciplina vinculada."}</p>
            )}
          </div>
          {data.disciplinasLimitadas && (
            <p className="mt-2 flex gap-2 text-xs text-slate-600">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
              Algumas vinculações excedem os limites desta visão. Consulte a página da turma para o restante.
            </p>
          )}
          <h4 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Professores da turma
          </h4>
          {data.professoresDetalhes?.length ? (
            <div className="flex flex-wrap gap-2">
              {data.professoresDetalhes.map((teacher) => (
                <button type="button" key={teacher.id}
                  onClick={() => onExploreProfessor({
                    id: teacher.id, label: teacher.nome, academicYearId: turma.anoLetivo.id,
                  })}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-emerald-800 hover:border-emerald-200 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-600">
                  {teacher.nome}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              {professores.length ? professores.join(", ") : data.disciplinasLimitadas ? "Não é possível confirmar a ausência de professores numa lista parcial." : "Nenhum professor vinculado."}
            </p>
          )}
        </section>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Os marcadores representam apenas pendências comprovadas, sem mostrar montantes. Pagamentos, notas e documentos continuam nos módulos autorizados.
      </p>
    </div>
  );
}
