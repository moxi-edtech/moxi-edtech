"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2, Printer, RefreshCw } from "lucide-react";
import type { OperationalReceiptHistoryItem } from "@/lib/financeiro/operational-receipt-history";
import { formatKwanza } from "@/lib/formatters";

type SettledPaymentHistoryItem = {
  id: string;
  registeredAt: string;
  amount: number;
  kind: "mensalidade" | "servico";
};

type ReceiptHistoryResponse = {
  ok?: boolean;
  error?: string;
  recibos?: OperationalReceiptHistoryItem[];
  nextOffset?: number | null;
  pagamentos?: SettledPaymentHistoryItem[];
  nextPaymentOffset?: number | null;
};

function receiptDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Data indisponível"
    : new Intl.DateTimeFormat("pt-AO", {
        timeZone: "Africa/Luanda",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
}

/** Read-only history: reprinting uses the existing guarded document route. */
export function StudentReceiptHistory({
  alunoId,
  escolaId,
}: {
  alunoId: string;
  escolaId: string;
}) {
  const [recibos, setRecibos] = useState<OperationalReceiptHistoryItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [pagamentos, setPagamentos] = useState<SettledPaymentHistoryItem[]>([]);
  const [paymentOffset, setPaymentOffset] = useState(0);
  const [nextPaymentOffset, setNextPaymentOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      escola_id: escolaId,
      offset: String(offset),
      pagamentos_offset: String(paymentOffset),
    });
    void fetch(
      "/api/secretaria/alunos/" + encodeURIComponent(alunoId) + "/recibos?" + params.toString(),
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as ReceiptHistoryResponse;
        if (!response.ok || !body.ok || !Array.isArray(body.recibos) || !Array.isArray(body.pagamentos)) {
          throw new Error(body.error || "Não foi possível consultar os recibos.");
        }
        return body;
      })
      .then((body) => {
        if (controller.signal.aborted) return;
        setRecibos((current) => {
          if (offset === 0) return body.recibos ?? [];
          const seen = new Set(current.map((receipt) => receipt.id));
          return [...current, ...(body.recibos ?? []).filter((receipt) => !seen.has(receipt.id))];
        });
        setNextOffset(typeof body.nextOffset === "number" ? body.nextOffset : null);
        setPagamentos((current) => {
          if (paymentOffset === 0) return body.pagamentos ?? [];
          const seen = new Set(current.map((payment) => payment.id));
          return [...current, ...(body.pagamentos ?? []).filter((payment) => !seen.has(payment.id))];
        });
        setNextPaymentOffset(typeof body.nextPaymentOffset === "number" ? body.nextPaymentOffset : null);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Falha ao consultar os recibos.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [alunoId, escolaId, offset, paymentOffset, reload]);

  return (
    <section aria-label="Histórico de recibos" className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Histórico de recibos</h3>
          <p className="mt-1 text-xs text-slate-500">
            Documentos já emitidos — mensalidades, matrícula, rematrícula e serviços.
          </p>
        </div>
        <span className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-500">
          Consulta e 2.ª via
        </span>
      </div>
      {loading && recibos.length === 0 && (
        <p role="status" className="flex items-center gap-2 py-6 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          A consultar recibos...
        </p>
      )}
      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-800">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setReload((previous) => previous + 1)}
            className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Tentar novamente
          </button>
        </div>
      )}
      {!loading && !error && recibos.length === 0 && (
        <p className="flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-5 text-sm text-slate-500">
          <FileText className="h-4 w-4" aria-hidden />
          Ainda não existem recibos emitidos para este aluno.
        </p>
      )}
      {recibos.length > 0 && (
        <div className="divide-y divide-slate-100">
          {recibos.map((recibo) => (
            <div key={recibo.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-1">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    {recibo.label}
                  </span>
                  <span className="text-xs text-slate-400">{receiptDate(recibo.emittedAt)}</span>
                  {recibo.number !== null && (
                    <span className="text-[11px] text-slate-500">
                      Recibo n.º {String(recibo.number).padStart(6, "0")}
                    </span>
                  )}
                </div>
                <p className="mt-1 break-words text-sm font-medium text-slate-800">
                  {recibo.description}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="whitespace-nowrap text-sm font-semibold text-slate-900">
                  {recibo.amount === null ? "—" : formatKwanza(recibo.amount)}
                </span>
                <a
                  href={"/secretaria/documentos/" + encodeURIComponent(recibo.id) + "/recibo/print"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-emerald-600 hover:text-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
                  aria-label={"Reimprimir recibo de " + recibo.label.toLowerCase() + " de " + receiptDate(recibo.emittedAt)}
                >
                  <Printer className="h-4 w-4" aria-hidden />
                  Reimprimir
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
      {nextOffset !== null && !error && (
        <button
          type="button"
          disabled={loading}
          onClick={() => setOffset(nextOffset)}
          className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Mostrar mais recibos
        </button>
      )}
      <div className="mt-5 border-t border-border pt-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-foreground">Pagamentos registados</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Consulte o recibo de cada pagamento liquidado, mesmo que ainda esteja em processamento.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOffset(0);
              setPaymentOffset(0);
              setReload((previous) => previous + 1);
            }}
            disabled={loading}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium text-foreground disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Atualizar histórico
          </button>
        </div>
        {pagamentos.length === 0 && !loading && !error && (
          <p className="py-3 text-sm text-muted-foreground">Ainda não existem pagamentos liquidados para este aluno.</p>
        )}
        {pagamentos.length > 0 && (
          <div className="divide-y divide-border">
            {pagamentos.map((pagamento) => (
              <div key={pagamento.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {pagamento.kind === "mensalidade" ? "Pagamento de mensalidade" : "Pagamento de serviço ou matrícula"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {receiptDate(pagamento.registeredAt)} · Liquidado · {formatKwanza(pagamento.amount)}
                  </p>
                </div>
                <a
                  href={"/secretaria/recibos/acompanhar?pagamento_id=" + encodeURIComponent(pagamento.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                  aria-label={"Consultar recibo do pagamento registado em " + receiptDate(pagamento.registeredAt)}
                >
                  Consultar recibo
                </a>
              </div>
            ))}
          </div>
        )}
        {nextPaymentOffset !== null && !error && (
          <button
            type="button"
            disabled={loading}
            onClick={() => setPaymentOffset(nextPaymentOffset)}
            className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-50"
          >
            Mostrar mais pagamentos
          </button>
        )}
      </div>
    </section>
  );
}
