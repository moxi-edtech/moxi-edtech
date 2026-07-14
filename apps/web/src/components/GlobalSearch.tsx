"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpenCheck, BriefcaseBusiness, Loader2, Search, User, WalletCards } from "lucide-react";
import { useGlobalSearch, type MinimalSearchResult, type SearchAction } from "@/hooks/useGlobalSearch";

type Props = {
  escolaId?: string | null;
  placeholder?: string;
  disabledText?: string;
  portal?: "secretaria" | "financeiro" | "admin" | "operacoes" | "professor" | "aluno" | "gestor" | "superadmin";
  onAction?: (action: SearchAction, result: MinimalSearchResult) => void;
};

export function GlobalSearch({ escolaId, placeholder, disabledText, portal, onAction }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const { query, setQuery, results, loading, hasMore, loadMore } = useGlobalSearch(escolaId, { portal });

  const isDisabled = !escolaId;
  const actionIcon = {
    profile: User,
    payment: WalletCards,
    desk: BriefcaseBusiness,
    grade: BookOpenCheck,
  };

  return (
    <div className="relative w-full max-w-lg">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          disabled={isDisabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 180)}
          placeholder={
            isDisabled
              ? disabledText || "Associe-se a uma escola para pesquisar"
              : placeholder || "Buscar aluno (nome, processo, BI)..."
          }
          className="w-full pl-10 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-teal-600" />
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-xl border border-slate-100 overflow-hidden z-50">
          <div className="p-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Alunos encontrados
          </div>
          {results.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className="border-t border-slate-100 p-3 transition-colors first:border-t-0 hover:bg-slate-50"
            >
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => router.push(item.href)}
                className="group flex w-full items-center gap-3 text-left"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                  <User className="h-5 w-5 text-slate-400 group-hover:text-teal-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-slate-900">{item.label}</div>
                  <div className="text-[12px] text-slate-500">{item.highlight || item.type}</div>
                </div>
                <div className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                  {item.type}
                </div>
              </button>

              {item.actions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 pl-[52px]">
                  {item.actions.map((action) => {
                    const Icon = actionIcon[action.kind];
                    return (
                      <button
                        key={action.kind}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setIsOpen(false);
                          if (onAction) {
                            onAction(action, item);
                            return;
                          }
                          router.push(action.href);
                        }}
                        className="inline-flex h-7 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-600 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
                      >
                        <Icon className="h-3 w-3" />
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          {hasMore && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={loadMore}
              className="w-full px-4 py-2 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors"
            >
              {loading ? "Carregando..." : "Carregar mais"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
