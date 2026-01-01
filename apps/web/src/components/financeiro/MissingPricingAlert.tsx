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
}: {
  escolaId?: string | null;
  anoLetivo: number;
}) {
  const [isVisible, setIsVisible] = useState(true);
  const [items, setItems] = useState<MissingItem[] | null>(null);

  useEffect(() => {
    if (!escolaId || !anoLetivo) return;

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
  }, [escolaId, anoLetivo]);

  if (!isVisible || !escolaId || !anoLetivo) return null;
  if (!items || items.length === 0) return null;

  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm animate-in slide-in-from-top-2">
      <div className="flex items-start gap-4">
        <div className="p-2 bg-amber-100 rounded-full text-amber-600">
          <AlertTriangle className="w-5 h-5" />
        </div>

        <div className="flex-1">
          <h3 className="text-sm font-bold text-amber-900 mb-1">Atenção: Configuração de Preços Incompleta</h3>
          <p className="text-xs text-amber-700 mb-3">
            Detectamos cursos ativos sem preços definidos para o ano {anoLetivo}. Isso impedirá a cobrança correta das matrículas e mensalidades.
          </p>

          <div className="bg-white/60 rounded-lg p-3 border border-amber-100 mb-3 max-h-40 overflow-y-auto custom-scrollbar">
            <ul className="space-y-2">
              {items.map((item, idx) => (
                <li
                  key={`${item.curso_nome}-${item.classe_nome}-${idx}`}
                  className="text-xs flex justify-between items-center text-amber-800 border-b border-amber-100 last:border-0 pb-1 last:pb-0"
                >
                  <span className="font-medium">
                    {item.curso_nome} <span className="text-amber-500">•</span> {item.classe_nome}
                  </span>
                  <span className="px-2 py-0.5 bg-amber-100 rounded text-[10px] font-bold uppercase tracking-wide">
                    {item.missing_type.replace("_", " ")}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-3">
            <Link
              href="/financeiro/configuracoes/precos"
              className="inline-flex items-center gap-1 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              Resolver Agora <ChevronRight className="w-3 h-3" />
            </Link>
            <button
              onClick={() => setIsVisible(false)}
              className="text-xs font-bold text-amber-600 hover:text-amber-800 px-2 py-2"
            >
              Lembrar depois
            </button>
          </div>
        </div>

        <button onClick={() => setIsVisible(false)} className="text-amber-400 hover:text-amber-600">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

