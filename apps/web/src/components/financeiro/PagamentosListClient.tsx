"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchJsonWithOffline } from "@/lib/offline/fetch";
import { OfflineBanner } from "@/components/system/OfflineBanner";
import { useConfirm, useToast } from "@/components/feedback/FeedbackSystem";
import { RotateCcw } from "lucide-react";

type Pagamento = {
  id: string;
  mensalidade_id: string | null;
  status: string | null;
  valor_pago: number | null;
  metodo: string | null;
  referencia: string | null;
  created_at: string | null;
};

type ApiResponse = { ok: boolean; items: Pagamento[]; error?: string };

export function PagamentosListClient({ escolaId }: { escolaId: string }) {
  const searchParams = useSearchParams();
  const q = searchParams?.get("q") || "";
  const days = searchParams?.get("days") || "30";
  const confirm = useConfirm();
  const { success, error: toastError } = useToast();

  const [items, setItems] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [offlineMeta, setOfflineMeta] = useState<{ fromCache: boolean; updatedAt: string | null }>({
    fromCache: false,
    updatedAt: null,
  });

  const load = useCallback(async (active = true) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q, days, escola_id: escolaId });
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
  }, [days, escolaId, q]);

  useEffect(() => {
    let active = true;
    load(active);
    return () => {
      active = false;
    };
  }, [load]);

  const handleReverter = async (pagamento: Pagamento) => {
    const motivo = await confirm({
      title: "Reverter pagamento",
      message: "Informe o motivo da reversão. O pagamento será marcado como revertido e a mensalidade será recalculada.",
      confirmLabel: "Reverter",
      variant: "danger",
      inputType: "text",
      placeholder: "Ex: pagamento registado no aluno errado",
    });

    if (motivo === null) return;
    if (motivo.trim().length < 5) {
      toastError("Motivo obrigatório", "Informe um motivo com pelo menos 5 caracteres.");
      return;
    }

    setRevertingId(pagamento.id);
    try {
      const response = await fetch(`/api/financeiro/pagamentos/${pagamento.id}/reverter`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `reverter-pagamento-${pagamento.id}-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({ motivo: motivo.trim() }),
        cache: "no-store",
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Não foi possível reverter o pagamento.");
      }

      success("Pagamento revertido", "A mensalidade foi recalculada e a reversão ficou auditada.");
      await load(true);
    } catch (e) {
      toastError("Erro", e instanceof Error ? e.message : "Não foi possível reverter o pagamento.");
    } finally {
      setRevertingId(null);
    }
  };

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
            <th className="py-2 pr-4 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => {
            const status = String(p.status ?? "").toLowerCase();
            const canReverter = ["settled", "concluido", "pago"].includes(status);

            return (
              <tr key={p.id} className="border-b last:border-b-0">
                <td className="py-2 pr-4 font-mono text-xs">{p.id}</td>
                <td className="py-2 pr-4">{p.status}</td>
                <td className="py-2 pr-4">
                  {new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" }).format(
                    Number(p.valor_pago || 0)
                  )}
                </td>
                <td className="py-2 pr-4">{p.metodo}</td>
                <td className="py-2 pr-4">{p.referencia ?? "—"}</td>
                <td className="py-2 pr-4">
                  {p.created_at ? new Date(p.created_at).toLocaleString() : "—"}
                </td>
                <td className="py-2 pr-4 text-right">
                  {canReverter ? (
                    <button
                      type="button"
                      onClick={() => handleReverter(p)}
                      disabled={revertingId === p.id}
                      className="inline-flex items-center gap-2 rounded border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      title="Reverter pagamento realizado"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {revertingId === p.id ? "Revertendo..." : "Reverter"}
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
          {items.length === 0 && (
            <tr>
              <td colSpan={7} className="py-6 text-center text-gray-500">
                Nenhum pagamento encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
