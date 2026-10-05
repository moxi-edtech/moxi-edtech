"use client";

import AdmissaoWizardClient from "@/components/secretaria/AdmissaoWizardClient";
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
  alunoId?: string | null;
  turmaId?: string | null;
  turmaLabel?: string | null;
  actionId: BalcaoActionId;
  returnTo?: string | null;
  onActionChange: (actionId: BalcaoActionId) => void;
  onAlunoSelected?: (aluno: AlunoDossier | null) => void;
  onSuccess?: (alunoId?: string) => void;
};

export function CommandCenterPanel({
  escolaId,
  alunoId,
  turmaId = null,
  turmaLabel = null,
  actionId,
  returnTo = null,
  onActionChange,
  onAlunoSelected,
  onSuccess,
}: Props) {
  const action = getBalcaoAction(actionId);

  if (action.panel === "enrollment") {
    return (
      <AdmissaoWizardClient
        escolaId={escolaId}
        embedded
        onSuccess={(newAlunoId) => onSuccess?.(newAlunoId)}
        onActionChange={onActionChange}
      />
    );
  }

  if (!alunoId) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Selecione um aluno para continuar esta operação.
      </div>
    );
  }

  if (action.panel === "profile") {
    return <AlunoProfilePanel alunoId={alunoId} onSuccess={onSuccess} />;
  }

  if (action.panel === "grade") {
    return (
      <PautaRapidaModal
        initialTurmaId={turmaId ?? undefined}
        initialTurmaLabel={turmaLabel ?? undefined}
        lockTurma
        focusAlunoId={alunoId}
        hideNavigation
      />
    );
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
