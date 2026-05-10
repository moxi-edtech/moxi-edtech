"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { enqueueOfflineAction } from "@/lib/offline/queue";
import { useToast, useConfirm } from "@/components/feedback/FeedbackSystem";

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
  const { success, error, warning } = useToast();
  const confirm = useConfirm();

  async function handlePay() {
    const ok = await confirm({
      title: "Confirmar recebimento",
      message: `Deseja registar o recebimento de ${formatKz(valor)} para esta mensalidade?`,
      confirmLabel: "Confirmar pagamento",
    });
    if (!ok) return;

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
        warning("Modo offline", "Está sem internet no momento. O pagamento foi guardado e será processado automaticamente assim que a sua ligação voltar.");
        return;
      }

      const res = await fetch("/api/financeiro/pagamentos/registrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao registrar pagamento");
      
      success("Pagamento registado", "O pagamento foi processado com sucesso.");
      router.refresh();
    } catch (e: unknown) {
      error("Falha no registo", "Não foi possível registar o pagamento. Por favor, verifique os dados e tente novamente.");
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
