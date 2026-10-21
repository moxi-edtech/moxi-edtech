"use client";

import {
  AlertCircle, ArrowUpRight, BookOpen, ChevronRight, GraduationCap, Loader2,
  RefreshCw, UsersRound,
} from "lucide-react";
import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context";
import type { EntityContext } from "@/lib/command-center/entity-context";
import { buildPortalHref } from "@/lib/navigation";
import { useDisciplinaContext } from "@/hooks/useDisciplinaContext";

type Props = {
  context: EntityContext;
  portal?: string;
  onNavigate: (href: string) => void;
  onExploreProfessor: (professor: { id: string; label: string; academicYearId: string }) => void;
  onExploreTurma: (turma: { id: string; label: string; academicYearId: string }) => void;
  onExploreClasse: (classe: { id: string; label: string; academicYearId: string }) => void;
};

function Metric({ label, value, parcial }: { label: string; value: number; parcial: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
        {new Intl.NumberFormat("pt-AO").format(value)}{parcial ? "+" : ""}
      </p>
    </div>
  );
}

export function DisciplinaContextView({ context, portal, onNavigate, onExploreProfessor, onExploreTurma, onExploreClasse }: Props) {
  const { data, loading, refreshing, error, status, retry } = useDisciplinaContext(context);
  if (loading) return (
    <div role="status" className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-600">
      <Loader2 className="h-4 w-4 animate-spin" /> A carregar a disciplina…
    </div>
  );
  if (error || !data) return (
    <div role="alert" className="space-y-3 p-3 text-sm">
      <p className="text-rose-700">{error || "Não foi possível carregar esta disciplina."}</p>
      {status !== 401 && status !== 403 && status !== 404 && (
        <button type="button" onClick={() => void retry()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-50">
          <RefreshCw className="h-4 w-4" /> Tentar novamente
        </button>
      )}
    </div>
  );
  const { disciplina, anoLetivo, stats, professores, turmas, curriculo, limitado } = data;
  const page = buildPortalHref(context.escolaId,
    portal === "admin" ? "/admin/configuracoes" : "/operacoes/configuracoes");
  const query = new URLSearchParams({ [ACADEMIC_YEAR_PARAM]: anoLetivo.id });

  return (
    <div className="max-h-[min(70vh,720px)] space-y-5 overflow-y-auto px-1 pb-3 text-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">
            Disciplina · Ano letivo {anoLetivo.ano}{anoLetivo.historico ? " · Histórico" : ""}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">{disciplina.nome}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {[disciplina.sigla, disciplina.area].filter(Boolean).join(" · ") || "Catálogo académico"}
          </p>
        </div>
        <button type="button" onClick={() => onNavigate(page + (page.includes("?") ? "&" : "?") + query)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50">
          Gestão académica <ArrowUpRight className="h-4 w-4" />
        </button>
      </header>

      <section aria-label="Indicadores da disciplina" className="flex flex-wrap gap-x-8 gap-y-4 border-y border-slate-100 py-4">
        <Metric label="Professores vinculados" value={stats.professores} parcial={limitado} />
        <Metric label="Turmas no ano" value={stats.turmas} parcial={limitado} />
        <Metric label="Cursos na matriz" value={stats.cursos} parcial={limitado} />
        <Metric label="Classes na matriz" value={stats.classes} parcial={limitado} />
        {refreshing && <span role="status" className="self-center text-xs text-slate-500">A atualizar…</span>}
      </section>

      {limitado && (
        <p role="status" className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertCircle className="h-4 w-4 shrink-0" />
          O número de vínculos excede o limite de consulta. Os valores são parciais, não totais definitivos.
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="min-w-0">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
            <UsersRound className="h-4 w-4 text-emerald-700" /> Professores
          </h3>
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {professores.map((professor) => (
              <button type="button" key={professor.id}
                onClick={() => onExploreProfessor({
                  id: professor.id, label: professor.nome, academicYearId: anoLetivo.id,
                })}
                className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">{professor.nome}</span>
                  <span className="block text-xs text-slate-500">
                    {professor.turmas} {professor.turmas === 1 ? "turma" : "turmas"} nesta disciplina
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </button>
            ))}
            {!professores.length && (
              <p className="px-3 py-5 text-slate-500">Nenhum professor vinculado neste ano letivo.</p>
            )}
          </div>
        </section>
        <section className="min-w-0">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
            <GraduationCap className="h-4 w-4 text-emerald-700" /> Turmas
          </h3>
          <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
            {turmas.map((turma) => (
              <button type="button" key={turma.id}
                onClick={() => onExploreTurma({ id: turma.id, label: turma.nome, academicYearId: anoLetivo.id })}
                className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">{turma.nome}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {[turma.cursoNome, turma.classeNome, turma.turno].filter(Boolean).join(" · ") || "Turma"}
                  </span>
                  {!!turma.professores.length && (
                    <span className="mt-1 block truncate text-xs text-slate-600">
                      {turma.professores.map((professor) => professor.nome).join(", ")}
                    </span>
                  )}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </button>
            ))}
            {!turmas.length && <p className="px-3 py-5 text-slate-500">Sem turmas vinculadas neste ano.</p>}
          </div>
        </section>
      </div>

      <section className="min-w-0">
        <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
          <BookOpen className="h-4 w-4 text-emerald-700" /> Matriz curricular
        </h3>
        <p className="mb-2 text-xs text-slate-500">
          Referência do currículo da escola. A inclusão na matriz não significa que haja aulas ou professor atribuído no ano selecionado.
        </p>
        <div className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
          {curriculo.map((item, index) => (
            <div key={`${item.cursoId ?? ""}:${item.classeId ?? ""}:${index}`}
              className="flex flex-wrap items-start justify-between gap-2 px-3 py-3">
              {item.classeId && item.classeNome ? (
                <button type="button" onClick={() => onExploreClasse({
                  id: item.classeId!, label: item.classeNome!, academicYearId: anoLetivo.id,
                })} className="inline-flex items-center gap-1 text-left font-medium text-emerald-800 hover:underline focus-visible:outline-2 focus-visible:outline-emerald-600">
                  {[item.cursoNome, item.classeNome].filter(Boolean).join(" · ")}
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <span className="font-medium text-slate-900">
                  {item.cursoNome || "Matriz curricular"}
                </span>
              )}
              <span className="text-xs text-slate-500">
                {item.cargaHorariaSemanal != null ? `${item.cargaHorariaSemanal} h/semana` : "Carga não definida"}
              </span>
            </div>
          ))}
          {!curriculo.length && (
            <p className="px-3 py-5 text-slate-500">Sem associação curricular disponível neste escopo.</p>
          )}
        </div>
      </section>
      <p className="text-xs text-slate-500">
        Dados exclusivamente académicos. Não são apresentados notas, dados pessoais, pagamentos ou remunerações.
      </p>
    </div>
  );
}
