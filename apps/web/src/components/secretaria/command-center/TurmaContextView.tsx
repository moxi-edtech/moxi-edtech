"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle, ArrowUpRight, BookOpen, ChevronLeft, ChevronRight,
  Loader2, RefreshCw, UsersRound,
} from "lucide-react";
import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context";
import type { EntityContext } from "@/lib/command-center/entity-context";
import { buildPortalHref } from "@/lib/navigation";
import { useTurmaContext } from "@/hooks/useTurmaContext";

type Props = {
  context: EntityContext;
  portal?: string;
  onNavigate: (href: string) => void;
  onStudentSelect: (student: { id: string; label: string }) => void;
  initialPage?: number;
  initialScrollTop?: number;
  selectedStudentId?: string | null;
  onViewChange?: (state: { page: number; scrollTop: number; selectedStudentId: string | null }) => void;
  onExploreProfessor: (professor: { id: string; label: string; academicYearId: string }) => void;
  onExploreDisciplina: (disciplina: { id: string; label: string; academicYearId: string }) => void;
  onExploreClasse: (classe: { id: string; label: string; academicYearId: string }) => void;
};

const numberPt = (value: number) => new Intl.NumberFormat("pt-AO").format(value);

function occupancyFromCapacity(capacity: number | null | undefined, enrolled: number) {
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

export function TurmaContextView({
  context, portal, onNavigate, onStudentSelect, onExploreProfessor, onExploreDisciplina, onExploreClasse,
  initialPage = 1, initialScrollTop = 0, selectedStudentId = null, onViewChange,
}: Props) {
  const [page, setPage] = useState(initialPage);
  const { data, error, status, loading, refreshing, retry } = useTurmaContext(context, page);
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
    onViewChangeRef.current?.({ page, scrollTop: currentScroll.current, selectedStudentId: currentStudent.current });
  }, [page]);
  const selectStudent = (student: { id: string; label: string }) => {
    currentStudent.current = student.id;
    onViewChangeRef.current?.({ page, scrollTop: currentScroll.current, selectedStudentId: student.id });
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
  const pages = Math.max(1, Math.ceil(alunos.total / alunos.pageSize));
  const occupancy = occupancyFromCapacity(turma.capacidade, alunos.total);
  const disciplinasSemProfessor = disciplinas.filter((d) => !d.professores.length).length;

  return (
    <div ref={scrollRef} onScroll={(event) => { currentScroll.current = event.currentTarget.scrollTop; onViewChangeRef.current?.({ page, scrollTop: currentScroll.current, selectedStudentId: currentStudent.current }); }} className="max-h-[min(70vh,720px)] space-y-5 overflow-y-auto px-1 pb-3 text-sm">
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

      <section aria-label="Indicadores da turma" className="flex flex-wrap gap-x-8 gap-y-4 border-y border-slate-100 py-4">
        <Metric label="Alunos matriculados" value={alunos.total} />
        <Metric
          label="Capacidade"
          value={turma.capacidade ?? null}
          hint={turma.capacidade == null ? "Não definida nesta turma" : undefined}
        />
        <Metric
          label="Vagas disponíveis"
          value={occupancy.available}
          hint={turma.capacidade == null ? "Indisponível sem capacidade" : undefined}
        />
        {occupancy.overcapacity != null && occupancy.overcapacity > 0 && (
          <Metric label="Excedente de lotação" value={occupancy.overcapacity} hint="Acima da capacidade registada" />
        )}
        <Metric label="Disciplinas" value={disciplinas.length} limited={data.disciplinasLimitadas} />
        <Metric label="Professores vinculados" value={data.professoresDetalhes?.length ?? professores.length} />
        {refreshing && <span role="status" className="self-center text-xs text-slate-500">A atualizar…</span>}
      </section>

      {disciplinasSemProfessor > 0 && (
        <p className="text-xs text-slate-600">
          {disciplinasSemProfessor === 1
            ? "1 disciplina sem professor vinculado nesta visão."
            : `${disciplinasSemProfessor} disciplinas sem professor vinculado nesta visão.`}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <section className="min-w-0" aria-labelledby="turma-alunos-heading">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 id="turma-alunos-heading" className="flex items-center gap-2 font-semibold text-slate-900">
              <UsersRound className="h-4 w-4 text-emerald-700" aria-hidden /> Alunos
            </h3>
            <span className="text-xs text-slate-500" aria-live="polite">
              {refreshing ? "A atualizar…" : `${alunos.total} no total`}
            </span>
          </div>
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {alunos.items.map((student) => (
              <button type="button" key={student.id}
                data-student-id={student.id} aria-current={selectedStudentId === student.id ? "true" : undefined} onClick={() => selectStudent({ id: student.id, label: student.nome })}
                className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600">
                <span className="w-8 shrink-0 text-xs tabular-nums text-slate-500">{student.numeroChamada ?? "—"}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{student.nome}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              </button>
            ))}
            {!alunos.items.length && (
              <p className="px-3 py-5 text-slate-500">Nenhum aluno matriculado neste âmbito.</p>
            )}
          </div>
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
        </section>

        <section className="min-w-0" aria-labelledby="turma-disciplinas-heading">
          <h3 id="turma-disciplinas-heading" className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
            <BookOpen className="h-4 w-4 text-emerald-700" aria-hidden /> Disciplinas e professores
          </h3>
          <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
            {disciplinas.map((d) => (
              <div key={d.id} className="px-3 py-3">
                <button type="button"
                  onClick={() => onExploreDisciplina({ id: d.id, label: d.nome, academicYearId: turma.anoLetivo.id })}
                  className="inline-flex items-center gap-1 text-left font-medium text-emerald-800 hover:underline focus-visible:outline-2 focus-visible:outline-emerald-600">
                  {d.nome} <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </button>
                <p className={`mt-1 text-xs ${d.professores.length ? "text-slate-500" : "text-amber-800"}`}>
                  {d.professores.length ? d.professores.join(", ") : "Professor não vinculado"}
                </p>
              </div>
            ))}
            {!disciplinas.length && (
              <p className="px-3 py-5 text-slate-500">Nenhuma disciplina vinculada.</p>
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
              {professores.length ? professores.join(", ") : "Nenhum professor vinculado."}
            </p>
          )}
        </section>
      </div>

      <p className="text-xs text-slate-500">
        Apenas dados académicos. As operações financeiras, notas e documentos permanecem nos seus módulos autorizados.
      </p>
    </div>
  );
}
