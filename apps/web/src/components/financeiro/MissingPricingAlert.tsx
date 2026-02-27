"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ChevronRight, X } from "lucide-react";
import Link from "next/link";

type MissingItem = {
  curso_nome: string;
  classe_nome: string;
  missing_type: string;
};

export function MissingPricingAlert({
  escolaId,
  anoLetivo,
  initialItems,
}: {
  escolaId?: string | null;
  anoLetivo: number;
  initialItems?: MissingItem[];
}) {
  const [isVisible, setIsVisible] = useState(true);
  const [items, setItems] = useState<MissingItem[] | null>(initialItems ?? null);
  const initialItemsProvided = initialItems !== undefined;

  useEffect(() => {
    if (!escolaId || !anoLetivo) return;
    if (initialItemsProvided) {
      setItems(initialItems ?? []);
      return;
    }

    let active = true;

    const load = async () => {
      try {
        const res = await fetch(
          `/api/financeiro/missing-pricing?escola_id=${escolaId}&ano_letivo=${anoLetivo}`,
          { cache: "no-store" }
        );

        if (!res.ok) throw new Error(`Request failed (${res.status})`);

        const json = await res.json();
        if (!active) return;

        if (json?.ok) {
          setItems((json.items as MissingItem[]) || []);
        } else {
          setItems([]);
        }
      } catch (err) {
        console.error("Erro ao carregar gaps de preços", err);
        if (active) setItems([]);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [escolaId, anoLetivo, initialItemsProvided, initialItems]);

  if (!isVisible || !escolaId || !anoLetivo) return null;
  if (!items || items.length === 0) return null;

  return (
    <div className="mb-6 animate-in slide-in-from-top-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="rounded-full bg-klasse-gold/15 p-2 text-klasse-gold">
          <AlertTriangle className="w-5 h-5" />
        </div>

        <div className="flex-1">
          <h3 className="mb-1 text-sm font-bold text-slate-900">Atenção: Configuração de Preços Incompleta</h3>
          <p className="mb-3 text-xs text-slate-600">
            Detectamos cursos ativos sem preços definidos para o ano {anoLetivo}. Isso impedirá a cobrança correta das matrículas e mensalidades.
          </p>

          <div className="custom-scrollbar mb-3 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/40 p-3">
            <ul className="space-y-2">
              {items.map((item, idx) => (
                <li
                  key={`${item.curso_nome}-${item.classe_nome}-${idx}`}
                  className="flex items-center justify-between border-b border-slate-200 pb-1 text-xs text-slate-700 last:border-0 last:pb-0"
                >
                  <span className="font-medium">
                    {item.curso_nome} <span className="text-klasse-gold">•</span> {item.classe_nome}
                  </span>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                    {item.missing_type.replace("_", " ")}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-3">
            <Link
              href="/financeiro/configuracoes/precos"
              className="inline-flex items-center gap-1 rounded-xl bg-klasse-gold px-4 py-2 text-xs font-bold text-white transition hover:brightness-95"
            >
              Resolver Agora <ChevronRight className="w-3 h-3" />
            </Link>
            <button
              onClick={() => setIsVisible(false)}
              className="px-2 py-2 text-xs font-bold text-slate-500 transition-colors hover:text-klasse-gold"
            >
              Lembrar depois
            </button>
          </div>
        </div>

        <button onClick={() => setIsVisible(false)} className="text-slate-400 transition-colors hover:text-klasse-gold">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
