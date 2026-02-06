"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchJsonWithOffline } from "@/lib/offline/fetch";
import { OfflineBanner } from "@/components/system/OfflineBanner";

type Pagamento = {
  id: string;
  status: string | null;
  valor_pago: number | null;
  metodo: string | null;
  referencia: string | null;
  created_at: string | null;
};

type ApiResponse = { ok: boolean; items: Pagamento[]; error?: string };

export function PagamentosListClient() {
  const searchParams = useSearchParams();
  const q = searchParams?.get("q") || "";
  const days = searchParams?.get("days") || "30";

  const [items, setItems] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offlineMeta, setOfflineMeta] = useState<{ fromCache: boolean; updatedAt: string | null }>({
    fromCache: false,
    updatedAt: null,
  });

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ q, days });
        const cacheKey = `financeiro:pagamentos:${params.toString()}`;
        const { data, fromCache, updatedAt } = await fetchJsonWithOffline<ApiResponse>(
          `/api/financeiro/pagamentos?${params.toString()}`,
          undefined,
          cacheKey
        );
        if (!data?.ok) throw new Error(data?.error || "Falha ao carregar pagamentos");
        if (!active) return;
        setItems(data.items || []);
        setOfflineMeta({ fromCache, updatedAt });
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : String(e));
        setItems([]);
        setOfflineMeta({ fromCache: false, updatedAt: null });
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [q, days]);

  if (loading) {
    return <div className="p-4 text-sm text-gray-500">Carregando pagamentos...</div>;
  }

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <OfflineBanner fromCache={offlineMeta.fromCache} updatedAt={offlineMeta.updatedAt} />
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b">
            <th className="py-2 pr-4">ID</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Valor</th>
            <th className="py-2 pr-4">Método</th>
            <th className="py-2 pr-4">Referência</th>
            <th className="py-2 pr-4">Criado em</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id} className="border-b last:border-b-0">
              <td className="py-2 pr-4">{p.id}</td>
              <td className="py-2 pr-4">{p.status}</td>
              <td className="py-2 pr-4">R$ {Number(p.valor_pago || 0).toFixed(2)}</td>
              <td className="py-2 pr-4">{p.metodo}</td>
              <td className="py-2 pr-4">{p.referencia ?? "—"}</td>
              <td className="py-2 pr-4">
                {p.created_at ? new Date(p.created_at).toLocaleString() : "—"}
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-gray-500">
                Nenhum pagamento encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
