"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { RematriculaPaymentItem } from "./useRematriculaBalcao";

/** A temporary status refresh is not a new quote or a request to empty the cart. */
export function useRematriculaMensalidadesDestino({ escolaId, alunoId, anoLetivoId, turmaId, setSelectedItems }: {
  escolaId: string; alunoId: string | null; anoLetivoId: string | null; turmaId: string | null;
  setSelectedItems: Dispatch<SetStateAction<RematriculaPaymentItem[]>>;
}) {
  const [items, setItems] = useState<RematriculaPaymentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const ownerRef = useRef<string | null>(null);
  const quoteRef = useRef<string | null>(null);
  useEffect(() => {
    const owner = alunoId && anoLetivoId ? [escolaId, alunoId, anoLetivoId].join(":") : null;
    if (ownerRef.current !== owner) {
      ownerRef.current = owner; quoteRef.current = null;
      setItems([]); setError(null);
      setSelectedItems(current => current.filter(item => !item.previsto));
    }
    if (!owner || !turmaId || !anoLetivoId) { setLoading(false); return; }
    const quote = owner + ":" + turmaId;
    if (quoteRef.current !== quote) {
      quoteRef.current = quote; setItems([]); setError(null);
      // A genuine class/year change may have different prices. Services stay;
      // quotes from the previous class must never be submitted in this scope.
      setSelectedItems(current => current.filter(item => !item.previsto));
    }
    const controller = new AbortController();
    setLoading(true); setError(null);
    void (async () => {
      try {
        const params = new URLSearchParams({ escola_id: escolaId, turma_id: turmaId, session_id: anoLetivoId });
        const response = await fetch(`/api/financeiro/orcamento/matricula?${params}`, { cache: "no-store", signal: controller.signal });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.ok !== true || !Array.isArray(payload?.data?.mensalidades)) throw new Error("Não foi possível consultar as mensalidades.");
        const rows = payload.data.mensalidades as Array<{ competencia?: string; valor?: number; data_vencimento?: string }>;
        const next: RematriculaPaymentItem[] = rows
          .filter(item => typeof item.competencia === "string" && Number.isFinite(Number(item.valor)) && Number(item.valor) > 0)
          .map(item => ({ id: `destino:${item.competencia}`, tipo: "mensalidade", nome: `Propina ${item.competencia}`,
            preco: Number(item.valor), quantidade: 1, competencia: item.competencia!, data_vencimento: String(item.data_vencimento ?? ""), previsto: true }));
        if (controller.signal.aborted) return;
        setItems(next);
        // Refresh the quoted values without losing the chosen competencies.
        setSelectedItems(current => current.map(item => item.previsto
          ? next.find(candidate => candidate.id === item.id) ?? item : item));
      } catch {
        if (!controller.signal.aborted) setError("Não foi possível consultar as mensalidades.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [escolaId, alunoId, anoLetivoId, turmaId, revision, setSelectedItems]);
  return { items, loading, error, retry: () => setRevision(value => value + 1) };
}
