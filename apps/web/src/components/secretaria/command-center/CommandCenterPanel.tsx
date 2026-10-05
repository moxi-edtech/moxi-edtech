"use client";

import { AlunoProfilePanel } from "@/components/secretaria/AlunoProfilePanel";
import BalcaoAtendimento, {
  type AlunoDossier,
} from "@/components/secretaria/BalcaoAtendimento";
import { PautaRapidaModal } from "@/components/secretaria/PautaRapidaModal";
import {
  getBalcaoAction,
  type BalcaoActionId,
} from "@/lib/balcao/action-registry";

type Props = {
  escolaId: string;
  alunoId: string;
  actionId: BalcaoActionId;
  returnTo?: string | null;
  onActionChange: (actionId: BalcaoActionId) => void;
  onAlunoSelected?: (aluno: AlunoDossier | null) => void;
  onSuccess?: () => void;
};

export function CommandCenterPanel({
  escolaId,
  alunoId,
  actionId,
  returnTo = null,
  onActionChange,
  onAlunoSelected,
  onSuccess,
}: Props) {
  const action = getBalcaoAction(actionId);

  if (action.panel === "profile") {
    return <AlunoProfilePanel alunoId={alunoId} onSuccess={onSuccess} />;
  }

  if (action.panel === "grade") {
    return <PautaRapidaModal hideNavigation />;
  }

  return (
    <BalcaoAtendimento
      escolaId={escolaId}
      selectedAlunoId={alunoId}
      showSearch={false}
      embedded
      view={action.balcaoView ?? "overview"}
      focusAction={action.focusAction ?? null}
      returnTo={returnTo}
      onNavigateAction={onActionChange}
      onAlunoSelected={onAlunoSelected}
      onPagamentoConcluido={onSuccess}
    />
  );
}

export default CommandCenterPanel;
