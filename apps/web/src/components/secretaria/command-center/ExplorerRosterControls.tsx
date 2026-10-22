"use client";

import { Search } from "lucide-react";
import type { RosterSort, RosterFilter } from "@/hooks/useExplorerRoster";

/**
 * Only explicit, independently verified signals are selectable:
 * - document: latest candidature event says DOCUMENTOS_PENDENTES;
 * - finance: positive canonical monthly balance past due, NOT a pending receipt.
 * Never guess mandatory documents, settlement or incomplete enrollment.
 */
export function ExplorerRosterControls({
  value, onChange, sort, onSortChange, filter, onFilterChange,
}: {
  value: string;
  onChange: (value: string) => void;
  sort: RosterSort;
  onSortChange: (next: RosterSort) => void;
  filter: RosterFilter;
  onFilterChange: (next: RosterFilter) => void;
}) {
  return (
    <fieldset className="min-w-0 space-y-3 rounded-lg border border-slate-200 p-3">
      <legend className="px-1 text-xs font-semibold text-slate-700">Localizar alunos desta lista</legend>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-semibold text-slate-700" htmlFor="cc-roster-search">
            Nome ou processo
          </label>
          <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 focus-within:ring-2 focus-within:ring-emerald-700">
            <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            <input id="cc-roster-search" type="search" value={value}
              onChange={(event) => onChange(event.target.value)} maxLength={90}
              placeholder="Procurar aluno" autoComplete="off"
              className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
              aria-describedby="cc-roster-filter-note" />
          </div>
        </div>
        <div>
          <label htmlFor="cc-roster-filter" className="mb-1 block text-xs font-semibold text-slate-700">
            Situação verificada
          </label>
          <select id="cc-roster-filter" value={filter}
            onChange={(event) => onFilterChange(event.target.value as RosterFilter)}
            className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-700">
            <option value="todos">Todos os activos</option>
            <option value="documentos_sinalizados">Documentos sinalizados</option>
            <option value="propinas_vencidas">Propinas vencidas</option>
            <option value="matricula_incompleta" disabled>Matrícula incompleta · por configurar</option>
          </select>
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
            <option value="pendencias_primeiro">Situações sinalizadas primeiro</option>
          </select>
        </div>
      </div>
      <p id="cc-roster-filter-note" className="text-xs text-slate-600">
        A pesquisa começa com dois caracteres. Documentos: sinalização explícita da Secretaria na candidatura.
        Propinas: saldo vencido, sem confundir comprovativos com pagamentos liquidados.
        A ordenação é aplicada antes da paginação. O filtro de matrícula incompleta está indisponível: a escola deve aprovar os documentos obrigatórios e os estados académicos por classe e tipo de aluno.
      </p>
    </fieldset>
  );
}
