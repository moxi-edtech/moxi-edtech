"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, RefreshCw } from "lucide-react";

type Disciplina = { id: string; nome: string };

export function DisciplinasList() {
  const searchParams = useSearchParams();
  const studentId = searchParams?.get("aluno") ?? null;
  const academicYearId = searchParams?.get("ano_letivo_id") ?? null;
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (studentId) params.set("studentId", studentId);
    if (academicYearId) params.set("ano_letivo_id", academicYearId);
    return params.toString();
  }, [studentId, academicYearId]);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<string | null>(null);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [yearLabel, setYearLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => setRetry((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setScope(null);
    setDisciplinas([]);
    setError(null);

    void (async () => {
      try {
        const url = query ? `/api/aluno/disciplinas?${query}` : "/api/aluno/disciplinas";
        const response = await fetch(url, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !data?.ok) throw new Error(data?.error || "Não foi possível carregar disciplinas.");
        if (!active) return;
        setDisciplinas(Array.isArray(data.disciplinas) ? data.disciplinas : []);
        setYearLabel(data.context?.anoLetivoLabel ?? null);
        setScope(query);
      } catch (caught) {
        if (active && !controller.signal.aborted) {
          setError(caught instanceof Error ? caught.message : "Não foi possível consultar as disciplinas.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; controller.abort(); };
  }, [query, retry]);

  const isCurrent = !loading && scope === query && !error;
  return (
    <div className="min-w-0 space-y-4" data-testid="aluno-disciplinas">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">As tuas disciplinas</h2>
        {isCurrent && <p className="text-sm text-slate-600">{yearLabel ? `Ano letivo ${yearLabel} · ` : ""}${disciplinas.length} disciplinas da tua turma</p>}
      </div>
      {loading || (scope !== query && !error) ? (
        <div role="status" aria-label="A carregar disciplinas" className="grid gap-3 sm:grid-cols-2">
          {[1,2,3].map((key) => <div key={key} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
      ) : error ? (
        <div role="alert" className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm text-rose-900">{error}</p>
          <button type="button" onClick={reload} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-rose-800">
            <RefreshCw className="h-4 w-4" /> Tentar novamente
          </button>
        </div>
      ) : disciplinas.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Ainda não existem disciplinas associadas à matrícula selecionada. Contacta a secretaria.
        </div>
      ) : (
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          {disciplinas.map((disciplina) => (
            <article key={disciplina.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <BookOpen aria-hidden className="h-5 w-5 shrink-0 text-emerald-800" />
              <h3 className="min-w-0 break-words text-sm font-medium leading-6 text-slate-900">{disciplina.nome}</h3>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
