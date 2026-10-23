"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

import { AlunoProfilePanel } from "@/components/secretaria/AlunoProfilePanel";
import BalcaoAtendimento, {
  type AlunoDossier,
} from "@/components/secretaria/BalcaoAtendimento";
import {
  getBalcaoAction,
  type BalcaoActionId,
} from "@/lib/balcao/action-registry";

// Only the frequent reception/payment workspace is included in the initial
// route. Large matrícula, profile and grade modules load on first use.
const AdmissaoWizardClient = dynamic(() => import("@/components/secretaria/AdmissaoWizardClient"), {
  ssr: false,
  loading: () => <p role="status" className="p-5 text-sm text-slate-600">A abrir nova matrícula...</p>,
});
const CommandCenterStudentDossier = dynamic(() => import("@/components/secretaria/command-center/CommandCenterStudentDossier").then(m => m.CommandCenterStudentDossier), {
  ssr: false,
  loading: () => <p role="status" className="p-5 text-sm text-slate-600">A abrir perfil integral...</p>,
});
const PautaRapidaModal = dynamic(() => import("@/components/secretaria/PautaRapidaModal").then(m => m.PautaRapidaModal), {
  ssr: false,
  loading: () => <p role="status" className="p-5 text-sm text-slate-600">A abrir lançamento de notas...</p>,
});

type Props = {
  escolaId: string;
  draftScope?: string | null;
  alunoId?: string | null;
  turmaId?: string | null;
  turmaLabel?: string | null;
  actionId: BalcaoActionId;
  visible?: boolean;
  refreshRevision?: number;
  inModal?: boolean;
  returnTo?: string | null;
  onActionChange: (actionId: BalcaoActionId) => void;
  onAlunoSelected?: (aluno: AlunoDossier | null) => void;
  onSuccess?: (alunoId?: string) => void;
};

export function CommandCenterPanel({
  escolaId,
  draftScope,
  alunoId,
  turmaId = null,
  turmaLabel = null,
  actionId,
  visible = true,
  refreshRevision = 0,
  inModal = false,
  returnTo = null,
  onActionChange,
  onAlunoSelected,
  onSuccess,
}: Props) {
  const action = getBalcaoAction(actionId);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const handleProfileSuccess = () => {
    setProfileRefreshKey((value) => value + 1);
    onSuccess?.();
  };

  if (action.panel === "enrollment") {
    return (
      <AdmissaoWizardClient
        escolaId={escolaId}
        draftScope={draftScope}
        embedded
        modalContext={inModal}
        newCandidateOnly
        onSuccess={(newAlunoId) => onSuccess?.(newAlunoId)}
        onActionChange={onActionChange}
      />
    );
  }

  if (!alunoId) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
        <p className="text-sm font-black text-slate-900">Selecione um aluno</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Pesquise um aluno no atendimento para continuar esta operação.
        </p>
      </div>
    );
  }

  if (action.panel === "profile") {
    return (
      <section className="min-w-0 space-y-3" aria-label="Perfil integral do aluno">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Perfil integral do aluno</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Consulte dados pessoais, financeiro, histórico académico e documentos no mesmo atendimento.
          </p>
        </div>
        <CommandCenterStudentDossier
          key={alunoId}
          escolaId={escolaId}
          alunoId={alunoId}
          refreshKey={profileRefreshKey + refreshRevision}
        />
        <details className="group min-w-0 rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-slate-700 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E3B23C] sm:px-5">
            Atualizar dados pessoais
          </summary>
          <div className="min-w-0 border-t border-slate-100 p-3 sm:p-5">
            <AlunoProfilePanel alunoId={alunoId} onSuccess={handleProfileSuccess} />
          </div>
        </details>
      </section>
    );
  }

  if (action.panel === "grade") {
    return (
      <PautaRapidaModal
        initialTurmaId={turmaId ?? undefined}
        initialTurmaLabel={turmaLabel ?? undefined}
        lockTurma={Boolean(turmaId)}
        focusAlunoId={alunoId}
        hideNavigation
      />
    );
  }

  return (
    <BalcaoAtendimento
      escolaId={escolaId}
      draftScope={draftScope}
      selectedAlunoId={alunoId}
      showSearch={false}
      embedded
      view={action.balcaoView ?? "overview"}
      visible={visible}
      refreshRevision={refreshRevision}
      focusAction={action.focusAction ?? null}
      returnTo={returnTo}
      onNavigateAction={onActionChange}
      onAlunoSelected={onAlunoSelected}
      onPagamentoConcluido={onSuccess}
    />
  );
}

export default CommandCenterPanel;
