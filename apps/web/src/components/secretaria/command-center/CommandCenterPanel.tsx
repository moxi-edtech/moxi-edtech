"use client";

import type { ReactNode } from "react";

import { AlunoProfilePanel } from "@/components/secretaria/AlunoProfilePanel";
import AdmissaoWizardClient from "@/components/secretaria/AdmissaoWizardClient";
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
  profileDossier?: ReactNode;
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
  profileDossier,
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
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900">Perfil integral</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Consulte dados pessoais, financeiro, histórico académico e documentos sem sair do atendimento.
          </p>
        </div>
        {profileDossier ?? (
          <div role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            A preparar a ficha integral do aluno...
          </div>
        )}
        <details className="group min-w-0 rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-slate-700 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E3B23C] sm:px-5">
            Atualizar dados pessoais
          </summary>
          <div className="min-w-0 border-t border-slate-100 p-3 sm:p-5">
            <AlunoProfilePanel alunoId={alunoId} onSuccess={onSuccess} />
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
