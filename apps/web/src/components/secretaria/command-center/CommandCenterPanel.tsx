"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { buildContextualPortalHref, getEscolaParamFromPath } from "@/lib/navigation";

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
  const pathname = usePathname();
  const escolaParam = getEscolaParamFromPath(pathname);

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
    const href = buildContextualPortalHref(
      escolaParam,
      `/secretaria/alunos/${encodeURIComponent(alunoId)}`,
      pathname,
    );
    return (
      <div className="min-w-0 space-y-4">
        <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900">Ficha integral do aluno</h2>
            <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">
              Consulte histórico, dados académicos, financeiro e documentos na ficha completa.
              Utilize os campos abaixo para atualização rápida.
            </p>
          </div>
          <Link href={href} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-800 hover:border-[#E3B23C] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E3B23C]/20">
            Abrir ficha completa <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
        <AlunoProfilePanel alunoId={alunoId} onSuccess={onSuccess} />
      </div>
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
