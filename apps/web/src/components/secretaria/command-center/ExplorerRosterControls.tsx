"use client";

import { Search } from "lucide-react";
import type { RosterSort } from "@/hooks/useExplorerRoster";

/** Only canonicity-proven choices are interactive; never simulate missing business states. */
export function ExplorerRosterControls({
  value, onChange, sort, onSortChange,
}: {
  value: string;
  onChange: (value: string) => void;
  sort: RosterSort;
  onSortChange: (next: RosterSort) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-semibold text-slate-700" htmlFor="cc-roster-search">
            Procurar aluno nesta lista
          </label>
          <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 focus-within:ring-2 focus-within:ring-emerald-700">
            <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            <input id="cc-roster-search" type="search" value={value}
              onChange={(event) => onChange(event.target.value)} maxLength={90}
              placeholder="Nome ou número de processo" autoComplete="off"
              className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
              aria-describedby="cc-roster-filter-note" />
          </div>
        </div>
        <div>
          <label htmlFor="cc-roster-sort" className="mb-1 block text-xs font-semibold text-slate-700">
            Ordenar alunos
          </label>
          <select id="cc-roster-sort" value={sort}
            onChange={(event) => onSortChange(event.target.value as RosterSort)}
            className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-700">
            <option value="nome_asc">Nome A–Z</option>
            <option value="nome_desc">Nome Z–A</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs" aria-label="Filtros disponíveis">
        <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-1 font-medium text-emerald-950">
          Matrículas activas
        </span>
        <span className="rounded-full border border-slate-200 px-2 py-1 text-slate-600" aria-disabled="true">
          Documentos pendentes · por definir
        </span>
        <span className="rounded-full border border-slate-200 px-2 py-1 text-slate-600" aria-disabled="true">
          Propinas pendentes · por definir
        </span>
      </div>
      <p id="cc-roster-filter-note" className="text-xs text-slate-700">
        Escreva pelo menos dois caracteres para pesquisar. Ordenação aplicada sobre todos os alunos no servidor,
        com desempate estável. Os filtros de documentos e propinas aguardam regras oficiais da escola.
      </p>
    </div>
  );
}
