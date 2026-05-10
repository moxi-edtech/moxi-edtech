"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast, useConfirm } from "@/components/feedback/FeedbackSystem";

export function EstornarMensalidadeButton({ mensalidadeId }: { mensalidadeId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { success, error } = useToast();
  const confirm = useConfirm();

  async function handleEstorno() {
    const ok = await confirm({
      title: "Confirmar estorno",
      message: "Deseja realmente estornar esta mensalidade? Esta acção irá reverter o pagamento e actualizar o saldo do aluno.",
      confirmLabel: "Estornar pagamento",
      variant: "danger",
    });
    if (!ok) return;

    setLoading(true);
    try {
      const res = await fetch("/api/financeiro/mensalidades/estornar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensalidadeId, motivo: "Estorno manual" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Falha ao estornar mensalidade");
      }
      success("Estorno concluído", "O estorno foi processado com sucesso e a mensalidade foi actualizada.");
      router.refresh();
    } catch (err) {
      error("Erro no estorno", "Não foi possível processar o estorno no momento. Por favor, tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleEstorno}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 focus:outline-none focus:ring-4 focus:ring-red-600/20 disabled:opacity-60"
    >
      <Trash2 className="h-4 w-4" />
      <span>{loading ? "Estornando..." : "Estornar"}</span>
    </button>
  );
}
