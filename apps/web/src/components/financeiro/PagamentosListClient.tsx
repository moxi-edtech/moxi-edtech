"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchJsonWithOffline } from "@/lib/offline/fetch";
import { OfflineBanner } from "@/components/system/OfflineBanner";
import { useConfirm, useToast } from "@/components/feedback/FeedbackSystem";
import { Banknote, CalendarDays, ReceiptText, RotateCcw, UserRound } from "lucide-react";

type Pagamento = {
  id: string;
  aluno_id: string | null;
  aluno_nome: string | null;
  mensalidade_id: string | null;
  mes_referencia: number | null;
  ano_referencia: number | null;
  status: string | null;
  valor_pago: number | null;
  metodo: string | null;
  referencia: string | null;
  created_at: string | null;
};

type ApiResponse = { ok: boolean; items: Pagamento[]; error?: string };

const moneyAOA = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const methodLabels: Record<string, string> = {
  cash: "Dinheiro",
  dinheiro: "Dinheiro",
  tpa: "TPA",
  transfer: "Transferência",
  transferencia: "Transferência",
  mcx: "Multicaixa",
  multicaixa: "Multicaixa",
  kwik: "Kwik",
  kiwk: "Kwik",
};

const statusLabels: Record<string, string> = {
  settled: "Confirmado",
  concluido: "Confirmado",
  pago: "Confirmado",
  pending: "Pendente",
  pendente: "Pendente",
  reversed: "Revertido",
  revertido: "Revertido",
};

function paymentReference(payment: Pagamento) {
  if (payment.mes_referencia && payment.ano_referencia) {
    const month = new Date(2000, payment.mes_referencia - 1, 1).toLocaleDateString("pt-AO", {
      month: "long",
    });
    return `Propina de ${month}/${payment.ano_referencia}`;
  }
  return payment.referencia || "Pagamento avulso";
}

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

  const totalReceived = useMemo(
    () =>
      items.reduce((sum, payment) => {
        const status = String(payment.status || "").toLowerCase();
        return ["settled", "concluido", "pago"].includes(status)
          ? sum + Number(payment.valor_pago || 0)
          : sum;
      }, 0),
    [items]
  );

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
    <div className="space-y-5">
      <OfflineBanner fromCache={offlineMeta.fromCache} updatedAt={offlineMeta.updatedAt} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
            <Banknote className="h-4 w-4" /> Valor recebido
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{moneyAOA.format(totalReceived)}</p>
          <p className="text-xs text-slate-500">no período selecionado</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <ReceiptText className="h-4 w-4" /> Pagamentos encontrados
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{items.length}</p>
          <p className="text-xs text-slate-500">máximo de 50 por consulta</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center">
          <ReceiptText className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-700">Nenhum pagamento encontrado</p>
          <p className="mt-1 text-xs text-slate-500">Altere o período ou limpe a pesquisa.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {items.map((payment) => {
            const status = String(payment.status ?? "").toLowerCase();
            const canReverter = ["settled", "concluido", "pago"].includes(status);
            const statusLabel = statusLabels[status] || "Em processamento";
            const method = methodLabels[String(payment.metodo || "").toLowerCase()] || payment.metodo || "Não informado";

            return (
              <article
                key={payment.id}
                className="grid gap-4 p-4 transition-colors hover:bg-slate-50/70 lg:grid-cols-[minmax(220px,1.4fr)_minmax(180px,1fr)_150px_auto] lg:items-center"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                      <UserRound className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {payment.aluno_nome || "Aluno não identificado"}
                      </p>
                      <p className="truncate text-xs text-slate-500">{paymentReference(payment)}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-lg font-bold text-slate-900">
                    {moneyAOA.format(Number(payment.valor_pago || 0))}
                  </p>
                  <p className="text-xs text-slate-500">{method}</p>
                </div>

                <div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      canReverter
                        ? "bg-emerald-50 text-emerald-700"
                        : status.includes("revert")
                          ? "bg-slate-100 text-slate-600"
                          : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {statusLabel}
                  </span>
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-500">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {payment.created_at
                      ? new Date(payment.created_at).toLocaleString("pt-AO", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "Data não informada"}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-slate-400">
                    Ref. {payment.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>

                <div className="lg:text-right">
                  {canReverter ? (
                    <button
                      type="button"
                      onClick={() => handleReverter(payment)}
                      disabled={revertingId === payment.id}
                      className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      title="Reverter este pagamento"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {revertingId === payment.id ? "A reverter…" : "Reverter"}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
