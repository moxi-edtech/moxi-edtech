"use client";
import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";


import { useRouter } from "next/navigation";
import FechoCaixaCego from "@/components/secretaria/FechoCaixaCego";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

export default function SecretariaFechoPage() {
  const router = useRouter();
  const { success } = useToast();


  const handleConfirm = async (declaracao: {
    numerario_declarado: number;
    tpa_declarado: number;
    transferencia_declarada: number;
    mcx_declarado: number;
    detalhe_notas: Record<string, number>;
  }) => {
    const dayKey = new Intl.DateTimeFormat("sv-SE", { timeZone: "Africa/Luanda", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const response = await fetch("/api/financeiro/fecho/declarar", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": `fecho-${dayKey}` },
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

    const data = json.data;
    const fields = ["cash", "tpa", "transfer", "mcx"] as const;
    if (!data || fields.some(key => data["system_" + key] == null || data["declared_" + key] == null || !Number.isFinite(Number(data["system_" + key])) || !Number.isFinite(Number(data["declared_" + key])))) {
      throw new Error("Não foi possível carregar os valores registados do fecho.");
    }
    const sistema = { numerario: Number(data.system_cash), tpa: Number(data.system_tpa), transferencia: Number(data.system_transfer), mcx: Number(data.system_mcx) };
    const declarado = { numerario: Number(data.declared_cash), tpa: Number(data.declared_tpa), transferencia: Number(data.declared_transfer), mcx: Number(data.declared_mcx) };
    const differences = (Object.keys(sistema) as (keyof typeof sistema)[]).map(key => Math.round(declarado[key] * 100) - Math.round(sistema[key] * 100));
    success(json.idempotent ? "Fecho já registado." : "Fecho declarado.", "Consulte o resultado da declaração.");
    return { sistema, declarado, diferenca_total: differences.reduce((sum, value) => sum + value, 0) / 100, outros: Number(data.system_other??0), outros_count: Number(data.system_other_count??0), status: differences.every(value => value === 0) && Number(data.system_other_count??0)===0 ? "MATCH" : "DIVERGENT" } as const;
  };

  return (
    <div className={`${PORTAL_PAGE_INSET} space-y-4`}>
      <DashboardHeader
        title="Fecho de caixa"
        description="Registe os valores do expediente para conferência financeira."
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Secretaria", href: "/secretaria" },
          { label: "Fecho" },
        ]}
      />
      <FechoCaixaCego
        onConfirm={handleConfirm}
        onClose={() => router.push("/secretaria")}
      />
    </div>
  );
}
