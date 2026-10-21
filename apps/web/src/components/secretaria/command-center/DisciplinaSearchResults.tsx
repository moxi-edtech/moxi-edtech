"use client";

import { BookOpen, ChevronRight, Loader2 } from "lucide-react";
import { Command } from "cmdk";
import { useDisciplinaSearch, type DisciplinaSearchItem } from "@/hooks/useDisciplinaContext";

type Props = {
  escolaId: string | null | undefined;
  academicYearId: string | null;
  query: string;
  enabled: boolean;
  otherResults: number;
  otherLoading: boolean;
  onSelect: (item: DisciplinaSearchItem) => void;
};

/** Renders inside the original Command.List and its local QueryClientProvider. */
export function DisciplinaSearchResults({
  escolaId, academicYearId, query, enabled, otherResults, otherLoading, onSelect,
}: Props) {
  const { items, loading, error } = useDisciplinaSearch({
    escolaId, academicYearId, query, enabled,
  });
  if (!enabled || query.trim().length < 2) return null;
  return (
    <>
      {items.length > 0 && (
        <Command.Group heading="Disciplinas" className="mt-3 px-2 py-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
          {items.map((item) => (
            <Command.Item
              key={item.id}
              value={`disciplina:${item.id}`}
              onSelect={() => onSelect(item)}
              className="group flex min-w-0 cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-700 aria-selected:bg-slate-100 aria-selected:text-slate-900">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <BookOpen className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{item.label}</span>
                <span className="block truncate text-xs font-normal text-slate-500">
                  Disciplina{item.highlight ? ` · ${item.highlight}` : ""}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
            </Command.Item>
          ))}
        </Command.Group>
      )}
      {loading && <div role="status" className="flex items-center gap-2 px-5 py-3 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> A pesquisar disciplinas…
      </div>}
      {error && <p role="alert" className="px-5 py-3 text-xs text-rose-700">{error}</p>}
      {!loading && !error && items.length === 0 && !otherLoading && otherResults === 0 && (
        <p className="px-5 py-6 text-center text-sm text-slate-500">
          Nenhuma entidade encontrada para esta pesquisa.
        </p>
      )}
    </>
  );
}
