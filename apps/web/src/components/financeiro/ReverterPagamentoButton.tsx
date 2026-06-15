"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { useConfirm, useToast } from "@/components/feedback/FeedbackSystem";

type ReverterPagamentoButtonProps = {
  pagamentoId: string;
  label?: string;
  compact?: boolean;
  className?: string;
};

export function ReverterPagamentoButton({
  pagamentoId,
  label = "Reverter",
  compact = false,
  className = "",
}: ReverterPagamentoButtonProps) {
  const [loading, setLoading] = useState(false);
  const confirm = useConfirm();
  const router = useRouter();
  const { success, error } = useToast();

  async function handleReverter() {
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
      error("Motivo obrigatório", "Informe um motivo com pelo menos 5 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/financeiro/pagamentos/${pagamentoId}/reverter`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `reverter-pagamento-${pagamentoId}-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({ motivo: motivo.trim() }),
        cache: "no-store",
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Não foi possível reverter o pagamento.");
      }

      success("Pagamento revertido", "A mensalidade foi recalculada e a reversão ficou auditada.");
      router.refresh();
    } catch (err) {
      error("Erro", err instanceof Error ? err.message : "Não foi possível reverter o pagamento.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleReverter}
      disabled={loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 focus:outline-none focus:ring-4 focus:ring-rose-600/10 disabled:opacity-60 ${
        compact ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-1.5 text-sm"
      } ${className}`}
      title="Reverter pagamento realizado"
    >
      <RotateCcw className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      <span>{loading ? "Revertendo..." : label}</span>
    </button>
  );
}
