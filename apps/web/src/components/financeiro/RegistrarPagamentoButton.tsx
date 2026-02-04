"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { enqueueOfflineAction } from "@/lib/offline/queue";

const formatKz = (valor: number) =>
  new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" }).format(
    valor || 0
  );

export function RegistrarPagamentoButton({
  mensalidadeId,
  valor,
}: {
  mensalidadeId: string;
  valor: number;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handlePay() {
    if (
      !confirm(
        `Confirmar recebimento de ${formatKz(
          valor
        )} para esta mensalidade?`
      )
    )
      return;

    setLoading(true);
    try {
      const payload = {
        mensalidade_id: mensalidadeId,
        metodo: "cash",
        meta: { origem: "portal_financeiro" },
      };

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueueOfflineAction({
          url: "/api/financeiro/pagamentos/registrar",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          type: "registrar_pagamento",
        });
        alert("Sem internet. Pagamento será sincronizado quando a conexão voltar.");
        return;
      }

      const res = await fetch("/api/financeiro/pagamentos/registrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao registrar pagamento");
      router.refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Falha ao registrar pagamento";
      alert("Erro: " + message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handlePay}
      disabled={loading}
      className="bg-klasse-gold-400 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:brightness-95 transition disabled:opacity-50 focus:ring-4 focus:ring-klasse-gold-400/20 focus:outline-none"
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Receber"}
    </button>
  );
}
