"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowUpRight, BookOpen, ChevronRight, GraduationCap, Loader2, RefreshCw, UsersRound } from "lucide-react";

import type { EntityContext } from "@/lib/command-center/entity-context";
import { buildPortalHref } from "@/lib/navigation";
import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context";

type CourseOverview = {
  curso: { id: string; nome: string; codigo: string | null; nivel: string | null; descricao: string | null; status: string | null };
  anoLetivo: { id: string; ano: number; ativo: boolean };
  stats: { classes: number; turmas: number; alunos: number };
  classes: Array<{ id: string; nome: string; turmas: number; alunos: number }>;
  turmas: Array<{ id: string; nome: string; classeId: string | null; turno: string | null; capacidade: number | null; alunos: number }>;
  turmasLimitadas: boolean;
};
type Reply = { ok: boolean; data?: CourseOverview; error?: string };
type Props = {
  context: EntityContext;
  portal?: string;
  onNavigate: (href: string) => void;
};

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
      <span className="text-xs text-slate-500">{label}</span>
      <p className="mt-1 font-sora text-2xl font-semibold tabular-nums text-[#1F6B3B]">
        {new Intl.NumberFormat("pt-AO").format(value)}
      </p>
    </div>
  );
}

export function CourseContextView({ context, portal, onNavigate }: Props) {
  const [data, setData] = useState<CourseOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [classeId, setClasseId] = useState<string | null>(null);
  const [turmaId, setTurmaId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setData(null);
    setError(null);
    setClasseId(null);
    setTurmaId(null);
    const qs = new URLSearchParams();
    if (context.academicYearId) qs.set(ACADEMIC_YEAR_PARAM, context.academicYearId);
    const url = `/api/escolas/${encodeURIComponent(context.escolaId)}/command-center/cursos/${encodeURIComponent(context.id)}${qs.size ? `?${qs.toString()}` : ""}`;

    void fetch(url, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const reply = (await response.json().catch(() => null)) as Reply | null;
        if (!response.ok || !reply?.ok || !reply.data || reply.data.curso?.id !== context.id) {
          throw new Error(reply?.error || "Não foi possível carregar este curso.");
        }
        return reply.data;
      })
      .then((payload) => {
        if (!controller.signal.aborted) setData(payload);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Falha ao carregar dados.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [context.id, context.escolaId, context.academicYearId, retry]);

  const visibleTurmas = useMemo(
    () => (data?.turmas ?? []).filter((turma) => !classeId || turma.classeId === classeId),
    [data, classeId],
  );
  const selectedTurma = data?.turmas.find((turma) => turma.id === turmaId);
  const selectedClasse = data?.classes.find((classe) => classe.id === classeId);

  function openTurma(id: string) {
    const base = portal === "admin" ? "/admin/turmas" : portal === "secretaria" ? "/secretaria/turmas" : "/operacoes/turmas";
    const href = buildPortalHref(context.escolaId, `${base}/${encodeURIComponent(id)}`);
    const qs = new URLSearchParams();
    if (data?.anoLetivo.id) qs.set(ACADEMIC_YEAR_PARAM, data.anoLetivo.id);
    onNavigate(`${href}${qs.size ? `${href.includes("?") ? "&" : "?"}${qs.toString()}` : ""}`);
  }

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-500" role="status">
        <Loader2 className="h-4 w-4 animate-spin" /> A carregar contexto académico…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div role="alert" className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        <p>{error || "Não foi possível obter a visão do curso."}</p>
        <button type="button" className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 font-semibold text-rose-800" onClick={() => setRetry((current) => current + 1)}>
          <RefreshCw className="h-4 w-4" /> Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="max-h-[min(68vh,680px)] space-y-5 overflow-y-auto px-1 pb-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">{data.curso.codigo || "Curso"} · Ano letivo {data.anoLetivo.ano}</p>
          {data.curso.descricao && <p className="mt-1 max-w-2xl text-sm text-slate-600">{data.curso.descricao}</p>}
        </div>
        <span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">{data.curso.status || "Estado não informado"}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Metric label="Alunos matriculados" value={data.stats.alunos} />
        <Metric label="Turmas ativas" value={data.stats.turmas} />
        <Metric label="Classes" value={data.stats.classes} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="min-w-0 rounded-xl border border-slate-200 bg-white">
          <h3 className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 font-semibold text-[#1F6B3B]">
            <BookOpen className="h-4 w-4" /> Classes do curso
          </h3>
          <div className="max-h-64 overflow-y-auto p-2">
            <button type="button" onClick={() => { setClasseId(null); setTurmaId(null); }} aria-pressed={!classeId}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-slate-50 ${!classeId ? "bg-slate-100 font-semibold" : ""}`}>
              Todas as classes <span className="text-xs tabular-nums text-slate-500">{data.stats.turmas} turmas</span>
            </button>
            {data.classes.map((classe) => (
              <button type="button" key={classe.id} onClick={() => { setClasseId(classe.id); setTurmaId(null); }}
                aria-pressed={classeId === classe.id}
                className={`mt-1 flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50 ${classeId === classe.id ? "bg-slate-100 font-semibold" : ""}`}>
                <span className="min-w-0 truncate">{classe.nome}</span>
                <span className="shrink-0 text-xs tabular-nums text-slate-500">{classe.alunos} alunos · {classe.turmas} turmas</span>
              </button>
            ))}
            {!data.classes.length && <p className="p-3 text-xs text-slate-500">Nenhuma classe vinculada ao curso neste ano.</p>}
          </div>
        </section>

        <section className="min-w-0 rounded-xl border border-slate-200 bg-white">
          <h3 className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 font-semibold text-[#1F6B3B]">
            <GraduationCap className="h-4 w-4" /> {selectedClasse ? `Turmas · ${selectedClasse.nome}` : "Turmas do curso"}
          </h3>
          <div className="max-h-64 overflow-y-auto p-2">
            {visibleTurmas.map((turma) => (
              <button type="button" key={turma.id} onClick={() => setTurmaId(turma.id)} aria-pressed={turmaId === turma.id}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50 ${turmaId === turma.id ? "bg-slate-100" : ""}`}>
                <span className="min-w-0 truncate font-medium">{turma.nome}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-slate-500">
                  <UsersRound className="h-3.5 w-3.5" /> {turma.alunos} <ChevronRight className="h-4 w-4" />
                </span>
              </button>
            ))}
            {!visibleTurmas.length && (
              <p className="p-3 text-xs text-slate-500">
                {selectedClasse?.turmas ? "As turmas desta classe não estão entre as 100 primeiras listadas." : "Sem turmas ativas nesta seleção."}
              </p>
            )}
          </div>
        </section>
      </div>

      {selectedTurma && (
        <section aria-label="Turma selecionada" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <p className="font-semibold text-slate-900">{selectedTurma.nome}</p>
            <p className="mt-1 text-xs text-slate-600">
              {selectedTurma.alunos} alunos · {selectedTurma.capacidade == null ? "Capacidade não definida" : `Capacidade de ${selectedTurma.capacidade}`} · {selectedTurma.turno || "Turno não informado"}
            </p>
          </div>
          <button type="button" onClick={() => openTurma(selectedTurma.id)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#E3B23C] px-4 py-2 font-semibold text-white hover:brightness-95">
            Abrir turma <ArrowUpRight className="h-4 w-4" />
          </button>
        </section>
      )}
      {data.turmasLimitadas && (
        <p className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> A lista mostra até 100 turmas. Os totais acima incluem todas as turmas elegíveis.
        </p>
      )}
      <p className="text-xs text-slate-500">
        Apenas matrículas vigentes de alunos não eliminados entram nas contagens. Histórico e valores financeiros não estão incluídos nesta primeira visão.
      </p>
    </div>
  );
}
