"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function EstornarMensalidadeButton({ mensalidadeId }: { mensalidadeId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleEstorno() {
    if (!confirm("Confirmar estorno desta mensalidade?")) return;
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
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`Erro ao estornar: ${message}`);
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
