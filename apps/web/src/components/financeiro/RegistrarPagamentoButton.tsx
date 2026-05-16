"use client";

import { useState } from "react";
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
      <button
        onClick={() => setModalOpen(true)}
        className="inline-flex items-center gap-2 bg-klasse-gold-500 hover:bg-klasse-gold-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm shadow-klasse-gold-500/10 transition-all focus:ring-4 focus:ring-klasse-gold-500/20 outline-none"
      >
        <Wallet className="w-3.5 h-3.5" />
        Receber
      </button>

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
