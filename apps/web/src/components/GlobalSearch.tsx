"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, User } from "lucide-react";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";

type Props = {
  escolaId?: string | null;
  placeholder?: string;
  disabledText?: string;
};

export function GlobalSearch({ escolaId, placeholder, disabledText }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const { query, setQuery, results, loading } = useGlobalSearch(escolaId);

  const isDisabled = !escolaId;

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
          {results.map((aluno) => (
            <button
              key={aluno.id}
              onClick={() => router.push(aluno.href)}
              className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors text-left group"
            >
              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 border border-slate-200">
                <User className="h-5 w-5 text-slate-400 group-hover:text-teal-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 truncate">{aluno.label}</div>
                <div className="text-[12px] text-slate-500">{aluno.meta}</div>
              </div>
              <div
                className={`text-[11px] px-2 py-1 rounded-full ${
                  aluno.status === "ativo" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                }`}
              >
                {aluno.status || "—"}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

