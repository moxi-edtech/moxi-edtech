"use client";

import { AlunoProfilePanel } from "@/components/secretaria/AlunoProfilePanel";
import { ModalShell } from "@/components/ui/ModalShell";

export interface FichaRapidaModalProps {
  alunoId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function FichaRapidaModal({
  alunoId,
  onClose,
  onSuccess,
}: FichaRapidaModalProps) {
  return (
    <ModalShell
      open
      onClose={onClose}
      title="Perfil do aluno"
      description="Consulta e regularização rápida dos dados essenciais."
    >
      <AlunoProfilePanel
        alunoId={alunoId}
        onSuccess={onSuccess}
        onDone={onClose}
      />
    </ModalShell>
  );
}
