"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { OmniSearchInput, type OmniSearchAluno } from "@/components/secretaria/OmniSearchInput";
import { useDebounce } from "@/hooks/useDebounce";

type StudentSearchResult = OmniSearchAluno & { nome?: string | null };

export function CommandCenterStudentPicker({
  currentAlunoId,
  onSelect,
  onCancel,
}: {
  currentAlunoId: string;
  onSelect: (student: { id: string; label: string }) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const [activeIndex, setActiveIndex] = useState(-1);
  const search = useDebounce(query.trim(), 300);

  useEffect(() => {
    const controller = new AbortController();
    setResults([]);
    setError(null);
    if (search.length < 2) {
      setLoading(false);
      return () => controller.abort();
    }
    setLoading(true);
    const params = new URLSearchParams({ query: search });
    void fetch("/api/secretaria/balcao/alunos/search?" + params.toString(), {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => ({
        response,
        payload: await response.json().catch(() => ({})),
      }))
      .then(({ response, payload }) => {
        if (controller.signal.aborted) return;
        if (!response.ok || payload?.ok !== true || !Array.isArray(payload.alunos)) {
          throw new Error(payload?.error || "Não foi possível pesquisar os alunos.");
        }
        const nextResults = (payload.alunos as StudentSearchResult[]).filter(
          (student) => typeof student.id === "string" && student.id !== currentAlunoId,
        );
        setResults(nextResults);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Falha na pesquisa.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [currentAlunoId, search]);

  return (
    <section aria-label="Trocar aluno em atendimento" className="mx-auto max-w-2xl space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Selecionar outro aluno</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            O aluno anterior permanece selecionado até escolher outro.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Cancelar
        </button>
      </div>
      <OmniSearchInput
        query={query}
        setQuery={setQuery}
        results={results}
        loading={loading}
        onSelect={(student) => onSelect({ id: student.id, label: student.nome?.trim() || "Aluno" })}
        open={open}
        setOpen={setOpen}
        activeIndex={activeIndex}
        setActiveIndex={setActiveIndex}
        placeholder="Pesquisar por nome, processo ou BI..."
        size="lg"
        autoFocus
      />
      {error ? <p role="alert" className="text-xs text-rose-700">{error}</p> : null}
      {query.trim().length < 2 ? (
        <p className="text-xs text-slate-500">Introduza pelo menos duas letras para encontrar outro aluno.</p>
      ) : null}
    </section>
  );
}
