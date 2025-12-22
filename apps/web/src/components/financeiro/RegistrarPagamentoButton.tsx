"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

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
  const supabase = createClient();

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
      const { data, error } = await supabase.rpc("registrar_pagamento", {
        p_mensalidade_id: mensalidadeId,
        p_metodo_pagamento: "numerario",
        p_observacao: "Pagamento via balcão",
      });
      if (error) throw error;
      if (data && (data as any).ok === false) {
        throw new Error((data as any).erro || "Falha ao registrar pagamento");
      }
      router.refresh();
    } catch (e: any) {
      alert("Erro: " + (e?.message || "Falha ao registrar pagamento"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handlePay}
      disabled={loading}
      className="bg-black text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-gray-800 transition disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Receber"}
    </button>
  );
}
