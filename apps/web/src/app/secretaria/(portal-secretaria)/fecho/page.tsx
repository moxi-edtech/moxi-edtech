"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import FechoCaixaCego from "@/components/secretaria/FechoCaixaCego";
import { useToast } from "@/components/feedback/FeedbackSystem";

export default function SecretariaFechoPage() {
  const router = useRouter();
  const { success } = useToast();
  const dayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const handleConfirm = async (declaracao: {
    numerario_declarado: number;
    tpa_declarado: number;
    transferencia_declarada: number;
    mcx_declarado: number;
    detalhe_notas: Record<string, number>;
  }) => {
    const response = await fetch("/api/financeiro/fecho/declarar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        day_key: dayKey,
        declared: {
          cash: declaracao.numerario_declarado,
          tpa: declaracao.tpa_declarado,
          transfer: declaracao.transferencia_declarada,
          mcx: declaracao.mcx_declarado,
        },
        meta: { origem: "secretaria_fecho", detalhe_notas: declaracao.detalhe_notas },
      }),
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json?.ok) {
      throw new Error(json?.error || "Falha ao declarar fecho.");
    }

    const data = json.data || {};
    const sistema = {
      numerario: Number(data.system_cash ?? 0),
      tpa: Number(data.system_tpa ?? 0),
      transferencia: Number(data.system_transfer ?? 0),
      mcx: Number(data.system_mcx ?? 0),
    };

    const declaradoTotal =
      declaracao.numerario_declarado +
      declaracao.tpa_declarado +
      declaracao.transferencia_declarada +
      declaracao.mcx_declarado;
    const sistemaTotal = sistema.numerario + sistema.tpa + sistema.transferencia + sistema.mcx;
    const diferencaTotal = declaradoTotal - sistemaTotal;

    success("Fecho declarado.", "Aguardando aprovação do financeiro.");

    return {
      sistema,
      diferenca_total: diferencaTotal,
      status: diferencaTotal === 0 ? "MATCH" : "DIVERGENT",
    } as const;
  };

  return (
    <FechoCaixaCego
      onConfirm={handleConfirm}
      onClose={() => router.back()}
    />
  );
}
