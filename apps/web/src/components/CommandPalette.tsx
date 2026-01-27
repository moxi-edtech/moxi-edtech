"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, ArrowRight } from "lucide-react";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";

type ActionItem = {
  id: string;
  label: string;
  href: string;
  hint?: string;
};

type ResultItem = {
  id: string;
  label: string;
  highlight: string | null;
  href: string;
  type: string;
};

type Props = {
  escolaId?: string | null;
  portal?: "secretaria" | "financeiro" | "admin" | "professor" | "aluno" | "gestor" | "superadmin";
};

const INTENT_KEYWORDS = ["pagamento", "pagar", "cobrar", "propina", "nota", "pauta"];

function stripIntentKeywords(value: string) {
  const tokens = value.trim().split(/\s+/).filter(Boolean);
  const filtered = tokens.filter((token) => !INTENT_KEYWORDS.includes(token.toLowerCase()));
  return filtered.join(" ");
}

function detectIntent(value: string) {
  const lower = value.toLowerCase();
  if (["pagamento", "pagar", "cobrar", "propina"].some((k) => lower.includes(k))) return "pagamento";
  if (["nota", "pauta"].some((k) => lower.includes(k))) return "nota";
  return null;
}

export function CommandPalette({ escolaId, portal }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const { query, setQuery, results, loading } = useGlobalSearch(escolaId, {
    transformQuery: stripIntentKeywords,
    portal,
  });

  const intent = useMemo(() => detectIntent(query), [query]);
  const primaryResult = results[0] as ResultItem | undefined;

  const actions = useMemo<ActionItem[]>(() => {
    const items: ActionItem[] = [];
    if (intent === "pagamento") {
      if (primaryResult) {
        items.push({
          id: "pagamento-aluno",
          label: `Registrar pagamento para ${primaryResult.label}`,
          href: escolaId
            ? `/escola/${escolaId}/financeiro/pagamentos?q=${encodeURIComponent(primaryResult.label)}`
            : `/financeiro/cobrancas?q=${encodeURIComponent(primaryResult.label)}`,
          hint: "Financeiro",
        });
      }
        items.push({
          id: "pagamento",
          label: "Abrir pagamentos",
          href: escolaId ? `/escola/${escolaId}/financeiro/pagamentos` : "/financeiro/cobrancas",
          hint: "Financeiro",
        });
      }

    if (intent === "nota") {
      if (primaryResult) {
        items.push({
          id: "nota-aluno",
          label: `Lançar nota para ${primaryResult.label}`,
          href: `/professor/notas?alunoId=${primaryResult.id}`,
          hint: "Pauta",
        });
      }
      items.push({
        id: "nota",
        label: "Abrir pauta do professor",
        href: "/professor/notas",
        hint: "Pauta",
      });
    }

    return items;
  }, [intent, primaryResult, escolaId]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen(true);
      }
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleNavigate = (href: string) => {
    setIsOpen(false);
    router.push(href);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && actions.length > 0) {
      event.preventDefault();
      handleNavigate(actions[0].href);
    }
  };

  return (
    <div className="relative w-full max-w-lg">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          id="command-palette"
          name="command-palette"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 180)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar ou digitar ação (ex: Pagamento João)"
          className="w-full bg-white px-10 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none border border-slate-200 rounded-xl focus:ring-4 focus:ring-klasse-gold/20"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-klasse-green" />
        )}
      </div>

      {isOpen && (actions.length > 0 || results.length > 0) && (
        <div className="absolute top-full mt-2 w-full bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
          {actions.length > 0 && (
            <div className="border-b border-slate-100">
              <div className="px-4 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Ações sugeridas
              </div>
              {actions.map((action) => (
                <button
                  key={action.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleNavigate(action.href)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{action.label}</div>
                    {action.hint && (
                      <div className="text-xs text-slate-500">{action.hint}</div>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
          )}

          {results.length > 0 && (
            <div>
              <div className="px-4 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Resultados
              </div>
              {results.map((item) => (
                <button
                  key={item.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleNavigate(item.href)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                    <div className="text-xs text-slate-500">{item.highlight || item.type}</div>
                  </div>
                  <span className="text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                    {item.type}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
