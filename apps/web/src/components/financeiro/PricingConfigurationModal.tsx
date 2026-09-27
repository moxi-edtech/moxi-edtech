"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

import { ModalShell } from "@/components/ui/ModalShell";

const PrecosClient = dynamic(
  () => import("@/app/escola/[id]/(portal)/financeiro/configuracoes/precos/PrecosClient"),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-64 items-center justify-center gap-3 text-sm font-semibold text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-emerald" />
        A carregar configuração de preços...
      </div>
    ),
  },
);

type PricingConfigurationModalProps = {
  open: boolean;
  escolaId: string;
  onClose: () => void;
};

export default function PricingConfigurationModal({
  open,
  escolaId,
  onClose,
}: PricingConfigurationModalProps) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      size="wide"
      title="Configurar preços"
      description="Defina matrícula, rematrícula e mensalidade sem sair do Radar Operacional."
    >
      <PrecosClient escolaId={escolaId} embedded showDueDate />
    </ModalShell>
  );
}
