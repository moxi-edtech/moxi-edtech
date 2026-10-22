"use client";

import { useState } from "react";
import {
  AlertCircle, ArrowUpRight, BookOpen, ChevronLeft, ChevronRight,
  GraduationCap, Loader2, RefreshCw, UsersRound,
} from "lucide-react";

import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context";
import type { EntityContext } from "@/lib/command-center/entity-context";
import { useClasseContext } from "@/hooks/useClasseContext";
import { buildPortalHref } from "@/lib/navigation";

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
};

function Metric({ label, value, limited }: {
  label: string; value: number | null; limited?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
        {value == null ? "—" : new Intl.NumberFormat("pt-AO").format(value)}
        {limited && value != null ? "+" : ""}
      </p>
    </div>
  );
}

export function ClasseContextView({
  context, portal, onNavigate, onExploreCurso, onExploreTurma,
  onExploreDisciplina, onExploreProfessor, onStudentSelect,
}: Props) {
  const [page, setPage] = useState(1);
  const { data, loading, refreshing, error, status, retry } = useClasseContext(context, page);

  if (loading) return (
    <div role="status" className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-600">
      <Loader2 className="h-4 w-4 animate-spin" /> A carregar a classe…
    </div>
  );
  if (error || !data) return (
    <div role="alert" className="space-y-3 p-3 text-sm">
      <p className="text-rose-700">{error || "Não foi possível carregar esta classe."}</p>
      {status !== 401 && status !== 403 && status !== 404 && (
        <button type="button" onClick={() => void retry()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50">
          <RefreshCw className="h-4 w-4" /> Tentar novamente
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
  const pages = Math.max(1, Math.ceil(alunos.total / alunos.pageSize));
  const open = (entity: { id: string; nome: string }, onExplore: (next: NextEntity) => void) =>
    onExplore({ id: entity.id, label: entity.nome, academicYearId: anoLetivo.id });

  return (
    <div className="max-h-[min(70vh,720px)] space-y-5 overflow-y-auto px-1 pb-3 text-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">
            Classe · Ano letivo {anoLetivo.ano}{anoLetivo.historico ? " · Histórico" : ""}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">{classe.nome}</h2>
          {classe.curso && (
            <button type="button" onClick={() => open(classe.curso!, onExploreCurso)}
              className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-800 hover:underline focus-visible:outline-2 focus-visible:outline-emerald-600">
              {classe.curso.nome} <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button type="button" onClick={() => onNavigate(href)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50">
          Gestão académica <ArrowUpRight className="h-4 w-4" />
        </button>
      </header>

      <section aria-label="Indicadores da classe" className="flex flex-wrap gap-x-8 gap-y-4 border-y border-slate-100 py-4">
        <Metric label="Alunos distintos" value={stats.alunos} limited={limitado} />
        <Metric label="Turmas do ano" value={stats.turmas} limited={limitado} />
        <Metric label="Capacidade total definida" value={stats.capacidade} limited={limitado} />
        <Metric label="Disciplinas" value={stats.disciplinas} limited={limitado} />
        <Metric label="Professores" value={stats.professores} limited={limitado} />
        {refreshing && <span role="status" className="self-center text-xs text-slate-500">A atualizar…</span>}
      </section>

      {stats.capacidade === null && (
        <p className="text-xs text-slate-500">A capacidade total não é calculada quando uma ou mais turmas não têm capacidade definida.</p>
      )}
      {limitado && (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Os vínculos excedem o limite de consulta. As contagens são parciais e não representam o total da classe.
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="min-w-0">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
            <GraduationCap className="h-4 w-4 text-emerald-700" /> Turmas
          </h3>
          <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
            {turmas.map((turma) => (
              <button type="button" key={turma.id}
                onClick={() => open(turma, onExploreTurma)}
                className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">{turma.nome}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {[turma.turno, turma.sala ? `Sala ${turma.sala}` : null].filter(Boolean).join(" · ") || "Turno não informado"}
                  </span>
                  <span className="mt-1 block text-xs tabular-nums text-slate-600">
                    {turma.alunos} {turma.alunos === 1 ? "aluno" : "alunos"} ·
                    {" "}{turma.capacidade == null ? "Capacidade não definida" : `Capacidade ${turma.capacidade}`}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </button>
            ))}
            {!turmas.length && <p className="px-3 py-5 text-slate-500">Nenhuma turma vinculada à classe neste ano letivo.</p>}
          </div>
        </section>
        <section className="min-w-0">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
            <BookOpen className="h-4 w-4 text-emerald-700" /> Disciplinas
          </h3>
          <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
            {disciplinas.map((disciplina) => (
              <button type="button" key={disciplina.id}
                onClick={() => open(disciplina, onExploreDisciplina)}
                className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600">
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
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </button>
            ))}
            {!disciplinas.length && <p className="px-3 py-5 text-slate-500">Nenhuma disciplina vinculada.</p>}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Matriz curricular é referência; não implica professor ou turma atribuídos neste ano.
          </p>
        </section>
      </div>

      <section className="min-w-0">
        <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
          <UsersRound className="h-4 w-4 text-emerald-700" /> Professores das turmas
        </h3>
        <div className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
          {professores.map((professor) => (
            <button type="button" key={professor.id}
              onClick={() => open(professor, onExploreProfessor)}
              className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600">
              <span className="truncate font-medium text-slate-900">{professor.nome}</span>
              <span className="shrink-0 text-xs text-slate-500">
                {professor.turmas} {professor.turmas === 1 ? "turma" : "turmas"}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
          ))}
          {!professores.length && <p className="px-3 py-5 text-slate-500">Nenhum professor atribuído às turmas deste ano.</p>}
        </div>
      </section>

      <section className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-semibold text-slate-900">
            <UsersRound className="h-4 w-4 text-emerald-700" /> Alunos
          </h3>
          <span className="text-xs text-slate-500">{alunos.total} distintos</span>
        </div>
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {alunos.items.map((aluno) => (
            <button type="button" key={aluno.id}
              onClick={() => onStudentSelect({ id: aluno.id, label: aluno.nome })}
              className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-slate-900">{aluno.nome}</span>
                <span className="mt-1 block truncate text-xs text-slate-500">{aluno.turmaNome}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
          ))}
          {!alunos.items.length && <p className="px-3 py-5 text-slate-500">Sem alunos matriculados neste âmbito.</p>}
        </div>
        {alunos.total > alunos.pageSize && (
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-xs tabular-nums text-slate-500">Página {alunos.page} de {pages}</span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1 || refreshing}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" /> Anterior
              </button>
              <button type="button" disabled={!alunos.hasMore || refreshing}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium disabled:opacity-40">
                Seguinte <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </section>
      <p className="text-xs text-slate-500">
        Apenas alunos ativos no ano atual ou concluídos no histórico, excluindo cancelados e transferidos.
        O Balcão mantém as ações existentes; nenhum dado financeiro é carregado aqui.
      </p>
    </div>
  );
}
