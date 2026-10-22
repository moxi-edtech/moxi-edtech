"use client";

import { Search } from "lucide-react";

/** Filtros não verificados ficam indisponíveis, nunca são simulados no browser. */
export function ExplorerRosterControls({
  value, onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-3">
      <label className="block text-xs font-semibold text-slate-700" htmlFor="cc-roster-search">
        Procurar aluno nesta lista
      </label>
      <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 focus-within:ring-2 focus-within:ring-emerald-600">
        <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        <input id="cc-roster-search" type="search" value={value} onChange={(e) => onChange(e.target.value)}
          maxLength={90} placeholder="Nome ou número de processo (mínimo 2 caracteres)"
          className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
          aria-describedby="cc-roster-filter-note" />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span aria-current="true" className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-1 font-medium text-emerald-900">
          Matrículas activas
        </span>
        <span className="rounded-full border border-slate-200 px-2 py-1 text-slate-500" aria-disabled="true"
          title="A escola ainda não definiu uma regra documental verificável">
          Documentos pendentes · indisponível
        </span>
        <span className="rounded-full border border-slate-200 px-2 py-1 text-slate-500" aria-disabled="true"
          title="Não existe uma regra financeira homologada para este filtro">
          Propinas pendentes · indisponível
        </span>
      </div>
      <p id="cc-roster-filter-note" className="text-xs text-slate-600">
        Ordenação: nome A–Z, com desempate estável. Estados não homologados não podem ser filtrados.
      </p>
    </div>
  );
}
