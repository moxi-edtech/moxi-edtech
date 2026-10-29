"use client";

import { useState } from "react";
import { AppyPayReferenceButton } from "./AppyPayReferenceButton";
import { Wallet } from "lucide-react";
import { RegistoPagamentoModal } from "./RegistoPagamentoModal";

interface RegistrarPagamentoButtonProps {
  escolaId: string;
  alunoId: string;
  alunoNome: string;
  mensalidadeId: string;
  valor: number;
  descricao: string;
}

export function RegistrarPagamentoButton({
  escolaId,
  alunoId,
  alunoNome,
  mensalidadeId,
  valor,
  descricao,
}: RegistrarPagamentoButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
      <button
        onClick={() => setModalOpen(true)}
        className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm shadow-amber-500/10 transition-all focus:ring-4 focus:ring-amber-500/20 outline-none"
      >
        <Wallet className="w-3.5 h-3.5" />
        Receber
      </button>
      <AppyPayReferenceButton escolaId={escolaId} mensalidadeId={mensalidadeId} alunoNome={alunoNome} descricao={descricao} />
      </div>

      {modalOpen && (
        <RegistoPagamentoModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          escolaId={escolaId}
          alunoId={alunoId}
          alunoNome={alunoNome}
          mensalidadeId={mensalidadeId}
          valorSugerido={valor}
          descricao={descricao}
        />
      )}
    </>
  );
}
