"use client";

import { useState } from "react";
import { AlertCircle, ArrowUpRight, BookOpen, ChevronLeft, ChevronRight, Loader2, RefreshCw, UsersRound } from "lucide-react";
import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context";
import type { EntityContext } from "@/lib/command-center/entity-context";
import { buildPortalHref } from "@/lib/navigation";
import { useTurmaContext } from "@/hooks/useTurmaContext";

type Props = {
  context: EntityContext;
  portal?: string;
  onNavigate: (href: string) => void;
  onStudentSelect: (student: { id: string; label: string }) => void;
  onExploreProfessor: (professor: { id: string; label: string; academicYearId: string }) => void;
  onExploreDisciplina: (disciplina: { id: string; label: string; academicYearId: string }) => void;
};

export function TurmaContextView({ context, portal, onNavigate, onStudentSelect, onExploreProfessor, onExploreDisciplina }: Props) {
  const [page, setPage] = useState(1);
  const { data, error, status, loading, refreshing, retry } = useTurmaContext(context, page);

  function openExisting() {
    const base = portal === "admin" ? "/admin/turmas" : portal === "secretaria" ? "/secretaria/turmas" : "/operacoes/turmas";
    const href = buildPortalHref(context.escolaId, `${base}/${encodeURIComponent(context.id)}`);
    const params = new URLSearchParams();
    if (data?.turma.anoLetivo.id) params.set(ACADEMIC_YEAR_PARAM, data.turma.anoLetivo.id);
    onNavigate(href + (params.size ? (href.includes("?") ? "&" : "?") + params.toString() : ""));
  }

  if (loading) return (
    <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-600" role="status">
      <Loader2 className="h-4 w-4 animate-spin" /> A carregar a turma…
    </div>
  );

  if (error || !data) return (
    <div className="space-y-3 p-3 text-sm" role="alert">
      <p className="text-rose-700">{error || "Não foi possível carregar a turma."}</p>
      {status !== 401 && status !== 403 && status !== 404 && (
        <button type="button" onClick={() => void retry()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50">
          <RefreshCw className="h-4 w-4" /> Tentar novamente
        </button>
      )}
    </div>
  );

  const { turma, alunos, disciplinas, professores } = data;
  const pages = Math.max(1, Math.ceil(alunos.total / alunos.pageSize));
  return (
    <div className="max-h-[min(70vh,720px)] space-y-5 overflow-y-auto px-1 pb-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">
            {turma.curso?.nome || "Curso"} · {turma.classe?.nome || "Classe"} · Ano letivo {turma.anoLetivo.ano}
            {turma.anoLetivo.historico ? " · Histórico" : ""}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">{turma.nome}</h2>
          <p className="mt-1 text-xs text-slate-600">
            {turma.turno || "Turno não definido"} · {turma.sala ? `Sala ${turma.sala}` : "Sala não definida"}
          </p>
        </div>
        <button type="button" onClick={openExisting} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50">
          Abrir página da turma <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-5 border-y border-slate-100 py-4">
        <div><p className="text-xs text-slate-500">Alunos no ano</p><strong className="text-xl tabular-nums text-slate-900">{alunos.total}</strong></div>
        <div><p className="text-xs text-slate-500">Capacidade</p><strong className="text-xl tabular-nums text-slate-900">{turma.capacidade ?? "—"}</strong></div>
        <div><p className="text-xs text-slate-500">Disciplinas</p><strong className="text-xl tabular-nums text-slate-900">{disciplinas.length}{data.disciplinasLimitadas ? "+" : ""}</strong></div>
        <div><p className="text-xs text-slate-500">Professores vinculados</p><strong className="text-xl tabular-nums text-slate-900">{data.professoresDetalhes?.length ?? professores.length}</strong></div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <section className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold text-slate-900"><UsersRound className="h-4 w-4 text-emerald-700" /> Alunos</h3>
            <span className="text-xs text-slate-500" aria-live="polite">{refreshing ? "A atualizar…" : `${alunos.total} no total`}</span>
          </div>
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {alunos.items.map((student) => (
              <button type="button" key={student.id} onClick={() => onStudentSelect({ id: student.id, label: student.nome })}
                className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600">
                <span className="w-8 shrink-0 text-xs tabular-nums text-slate-500">{student.numeroChamada ?? "—"}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{student.nome}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </button>
            ))}
            {!alunos.items.length && <p className="px-3 py-5 text-slate-500">Nenhum aluno matriculado neste âmbito.</p>}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-xs tabular-nums text-slate-500">Página {alunos.page} de {pages}</span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1 || refreshing} onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" /> Anterior
              </button>
              <button type="button" disabled={!alunos.hasMore || refreshing} onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium disabled:opacity-40">
                Seguinte <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
        <section className="min-w-0">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-900"><BookOpen className="h-4 w-4 text-emerald-700" /> Disciplinas e professores</h3>
          <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
            {disciplinas.map((d) => (
              <div key={d.id} className="px-3 py-3">
                <button type="button"
                  onClick={() => onExploreDisciplina({ id: d.id, label: d.nome, academicYearId: turma.anoLetivo.id })}
                  className="inline-flex items-center gap-1 text-left font-medium text-emerald-800 hover:underline focus-visible:outline-2 focus-visible:outline-emerald-600">
                  {d.nome} <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <p className="mt-1 text-xs text-slate-500">{d.professores.length ? d.professores.join(", ") : "Professor não vinculado"}</p>
              </div>
            ))}
            {!disciplinas.length && <p className="px-3 py-5 text-slate-500">Nenhuma disciplina vinculada.</p>}
          </div>
          {data.disciplinasLimitadas && (
            <p className="mt-2 flex gap-2 text-xs text-slate-600"><AlertCircle className="h-4 w-4 shrink-0" /> Algumas vinculações excedem os limites desta visão. Consulte a página da turma para ver o restante.</p>
          )}
          <h4 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Professores da turma</h4>
          {data.professoresDetalhes?.length ? (
            <div className="flex flex-wrap gap-2">
              {data.professoresDetalhes.map((teacher) => (
                <button type="button" key={teacher.id}
                  onClick={() => onExploreProfessor({ id: teacher.id, label: teacher.nome, academicYearId: turma.anoLetivo.id })}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-emerald-800 hover:border-emerald-200 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-600">
                  {teacher.nome}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">{professores.length ? professores.join(", ") : "Nenhum professor vinculado."}</p>
          )}
        </section>
      </div>
      <p className="text-xs text-slate-500">
        Apenas dados académicos. As operações financeiras, notas e documentos permanecem nos seus módulos autorizados.
      </p>
    </div>
  );
}
