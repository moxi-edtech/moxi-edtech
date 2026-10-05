"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import BalcaoAtendimento from "@/components/secretaria/BalcaoAtendimento";
import { BalcaoActionBar } from "@/components/secretaria/BalcaoActionBar";
import { AlunoProfilePanel } from "@/components/secretaria/AlunoProfilePanel";
import { PautaRapidaModal } from "@/components/secretaria/PautaRapidaModal";
import {
  getBalcaoAction,
  type BalcaoActionId,
} from "@/lib/balcao/action-registry";

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

  const action = getBalcaoAction(activeAction);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-2 backdrop-blur-sm sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={`KLASSE Command Center — ${aluno.label}`}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Fechar Command Center"
      />

      <div className="relative flex h-[94vh] w-[98vw] max-w-[1540px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex shrink-0 flex-col gap-3 border-b border-slate-100 bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  KLASSE Command Center
                </p>
              </div>
              <h2 className="mt-1 truncate text-lg font-black text-slate-900">{aluno.label}</h2>
              <p className="mt-0.5 text-xs text-slate-500">{action.description}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <BalcaoActionBar value={activeAction} onChange={setActiveAction} />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60">
          <div className="mx-auto min-h-full w-full max-w-[1440px] p-4 sm:p-6">
            {activeAction === "profile" ? (
              <AlunoProfilePanel alunoId={aluno.id} onSuccess={onSuccess} />
            ) : activeAction === "grade" ? (
              <PautaRapidaModal hideNavigation />
            ) : (
              <BalcaoAtendimento
                escolaId={escolaId}
                selectedAlunoId={aluno.id}
                showSearch={false}
                embedded
                view={
                  activeAction === "payment"
                    ? "payment"
                    : activeAction === "document"
                      ? "document"
                      : activeAction === "reenrollment"
                        ? "reenrollment"
                        : "overview"
                }
                focusAction={action.focusAction ?? null}
                onNavigateAction={setActiveAction}
                onPagamentoConcluido={onSuccess}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BalcaoWorkspace;
