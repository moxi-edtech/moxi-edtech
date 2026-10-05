"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  CreditCard,
  FileText,
  RefreshCcw,
  X,
} from "lucide-react";

import BalcaoAtendimento from "@/components/secretaria/BalcaoAtendimento";
import {
  getBalcaoAction,
  getBalcaoWorkspaceActions,
  type BalcaoActionId,
} from "@/lib/balcao/action-registry";

const ACTION_ICONS = {
  desk: BriefcaseBusiness,
  payment: CreditCard,
  document: FileText,
  reenrollment: RefreshCcw,
} as const;

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
  const initialAction = getBalcaoAction(actionId).surface === "balcao" ? actionId : "desk";
  const [activeAction, setActiveAction] = useState<BalcaoActionId>(initialAction);

  useEffect(() => {
    setActiveAction(getBalcaoAction(actionId).surface === "balcao" ? actionId : "desk");
  }, [actionId, aluno.id]);

  const action = getBalcaoAction(activeAction);
  const workspaceActions = useMemo(() => getBalcaoWorkspaceActions(), []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Balcão de atendimento — ${aluno.label}`}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Fechar balcão"
      />

      <div className="relative flex h-[92vh] w-[96vw] max-w-[1480px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl">
        <header className="flex shrink-0 flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <BriefcaseBusiness className="h-4 w-4 text-emerald" />
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald">
                  Balcão de Atendimento
                </p>
              </div>
              <h2 className="mt-1 truncate text-lg font-black text-slate-900">{aluno.label}</h2>
              <p className="text-xs text-slate-500">{action.description}</p>
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

          <div className="flex gap-2 overflow-x-auto pb-1">
            {workspaceActions.map((item) => {
              const Icon = ACTION_ICONS[item.id as keyof typeof ACTION_ICONS];
              const selected = activeAction === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveAction(item.id)}
                  className={[
                    "inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition",
                    selected
                      ? "border-emerald/30 bg-emerald/10 text-emerald"
                      : "border-slate-200 bg-white text-slate-600 hover:border-emerald/20 hover:bg-emerald/5 hover:text-emerald",
                  ].join(" ")}
                >
                  {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                  {item.shortLabel}
                </button>
              );
            })}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="min-h-full rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <BalcaoAtendimento
              escolaId={escolaId}
              selectedAlunoId={aluno.id}
              showSearch={false}
              embedded
              focusAction={action.focusAction ?? null}
              onPagamentoConcluido={onSuccess}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default BalcaoWorkspace;
