"use client";

import { useEffect, useState } from "react";
import { findIssuedOperationalReceiptByPayment } from "@/lib/financeiro/recover-receipt-after-payment";

/** Only reads the operational document of the already-settled payment. */
export function AdmissionReceiptRecovery({ pagamentoId }: { pagamentoId: string }) {
  const [printUrl, setPrintUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"checking" | "pending" | "error">("checking");

  useEffect(() => {
    const controller = new AbortController();
    setPrintUrl(null);
    setStatus("checking");
    void findIssuedOperationalReceiptByPayment(pagamentoId, {
      signal: controller.signal, attempts: 12,
    }).then((url) => {
      if (controller.signal.aborted) return;
      if (url) setPrintUrl(url);
      else setStatus("pending");
    }).catch(() => {
      if (!controller.signal.aborted) setStatus("error");
    });
    return () => controller.abort();
  }, [pagamentoId]);

  async function recheck() {
    setStatus("checking");
    try {
      const url = await findIssuedOperationalReceiptByPayment(pagamentoId, { attempts: 1 });
      if (url) setPrintUrl(url);
      else setStatus("pending");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div aria-live="polite" className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      {printUrl ? (
        <a
          href={printUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white"
        >
          Imprimir recibo
        </a>
      ) : (
        <>
          <span role="status">
            {status === "checking" ? "A consultar o recibo emitido…" :
              status === "pending" ? "Recibo ainda em preparação." :
                "Consulta indisponível. O pagamento não será repetido."}
          </span>
          <button
            type="button" onClick={() => void recheck()} disabled={status === "checking"}
            className="inline-flex min-h-10 items-center rounded-lg border border-border px-4 py-2 font-semibold disabled:opacity-50"
          >
            Verificar recibo
          </button>
        </>
      )}
    </div>
  );
}
