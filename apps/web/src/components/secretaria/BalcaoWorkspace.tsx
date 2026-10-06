"use client";

import { useEffect, useState } from "react";

import { CommandCenterPanel } from "@/components/secretaria/command-center/CommandCenterPanel";
import { CommandCenterShell } from "@/components/secretaria/command-center/CommandCenterShell";
import type { BalcaoActionId } from "@/lib/balcao/action-registry";

type Props = {
  open: boolean;
  escolaId: string;
  aluno: {
    id: string;
    label: string;
  };
  actionId?: BalcaoActionId;
  onClose: () => void;
  onSuccess?: () => void;
};

export function BalcaoWorkspace({
  open,
  escolaId,
  aluno,
  actionId = "desk",
  onClose,
  onSuccess,
}: Props) {
  const [activeAction, setActiveAction] = useState<BalcaoActionId>(actionId);

  useEffect(() => {
    setActiveAction(actionId);
  }, [actionId, aluno.id]);

  if (!open) return null;

  return (
    <CommandCenterShell
      variant="modal"
      student={{ id: aluno.id, label: aluno.label }}
      activeAction={activeAction}
      onActionChange={setActiveAction}
      onClose={onClose}
    >
      <CommandCenterPanel
        escolaId={escolaId}
        alunoId={aluno.id}
        actionId={activeAction}
        onActionChange={setActiveAction}
        onSuccess={onSuccess}
      />
    </CommandCenterShell>
  );
}

export default BalcaoWorkspace;
