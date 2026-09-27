"use client";

import type { RefObject } from "react";
import { CheckCircle, Search, X } from "lucide-react";

/**
 * Caixa de busca de alunos com navegação por teclado.
 *
 * Vivia dentro de BuscaBalcaoRapido.tsx, enquanto o balcão tinha uma segunda
 * implementação — sem setas, sem Enter, sem Escape e sem autoFocus — que era a
 * que os operadores realmente usavam. Passou a ser partilhada para que não
 * voltem a existir duas.
 *
 * Genérico sobre o tipo de resultado: cada ecrã passa o seu (o balcão usa o
 * dossiê, a busca rápida usa o resultado leve da API), desde que exponha os
 * campos que aqui se mostram.
 */

/** Campos que este componente sabe mostrar. Só o `id` é obrigatório. */
export type OmniSearchAluno = {
  id: string;
  aluno_id?: string | null;
  nome?: string | null;
  numero_processo?: string | null;
  bi_numero?: string | null;
  turma_atual?: string | null;
  total_em_atraso?: number | null;
  /** A busca do balcão não devolve fotografia; quando existe, mostra-se, porque
   *  é o que distingue dois alunos com o mesmo nome. */
  foto_url?: string | null;
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

function statusBadge(totalEmAtraso?: number | null) {
  if (totalEmAtraso == null) return null;

  if (Number(totalEmAtraso ?? 0) > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
        Inadimplente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
      <CheckCircle className="h-3 w-3" />
      Regular
    </span>
  );
}

export function OmniSearchInput<T extends OmniSearchAluno>({
  query,
  setQuery,
  results,
  loading,
  onSelect,
  open,
  setOpen,
  activeIndex,
  setActiveIndex,
  placeholder,
  size = "lg",
  autoFocus,
  inputRef,
}: {
  query: string;
  setQuery: (value: string) => void;
  results: T[];
  loading: boolean;
  onSelect: (aluno: T) => void;
  open: boolean;
  setOpen: (value: boolean) => void;
  activeIndex: number;
  setActiveIndex: (value: number) => void;
  placeholder: string;
  size?: "lg" | "md";
  autoFocus?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const sizeStyles = size === "lg" ? "h-12 text-base md:text-lg" : "h-10 text-sm";

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex(activeIndex + 1 >= results.length ? 0 : activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(activeIndex <= 0 ? results.length - 1 : activeIndex - 1);
    } else if (event.key === "Enter") {
      if (activeIndex >= 0 && results[activeIndex]) {
        event.preventDefault();
        onSelect(results[activeIndex]);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className={cx(
            "w-full rounded-xl border border-slate-200 bg-white pl-12 pr-10 font-medium text-slate-900 leading-none placeholder:text-slate-400",
            "focus:border-amber focus:ring-4 focus:ring-amber/20",
            sizeStyles
          )}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setOpen(false);
              setActiveIndex(-1);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-40 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          {results.map((aluno, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={aluno.aluno_id ?? aluno.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSelect(aluno)}
                className={cx(
                  "flex w-full items-center justify-between gap-3 px-4 py-3 text-left",
                  "border-b border-slate-100 last:border-b-0",
                  isActive ? "bg-amber/10" : "hover:bg-slate-50"
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  {aluno.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={aluno.foto_url}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-full object-cover"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900">
                      {aluno.nome || "Aluno"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {aluno.numero_processo ? `Proc: ${aluno.numero_processo}` : "Sem processo"}
                      {aluno.bi_numero ? ` • BI ${aluno.bi_numero}` : ""}
                      {aluno.turma_atual ? ` • ${aluno.turma_atual}` : ""}
                    </div>
                  </div>
                </div>
                <div className="shrink-0">{statusBadge(aluno.total_em_atraso)}</div>
              </button>
            );
          })}
        </div>
      )}

      {open && query && results.length === 0 && !loading && (
        <div className="absolute z-40 mt-2 w-full rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
          Nenhum estudante encontrado.
        </div>
      )}
    </div>
  );
}
