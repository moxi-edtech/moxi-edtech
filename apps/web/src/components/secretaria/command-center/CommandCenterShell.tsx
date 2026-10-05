"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

import { CommandCenterActionBar } from "@/components/secretaria/command-center/CommandCenterActionBar";
import { getBalcaoAction, type BalcaoActionId } from "@/lib/balcao/action-registry";

export type CommandCenterStudent = {
  id: string;
  label: string;
  subtitle?: string | null;
};

type Props = {
  variant: "modal" | "page";
  student: CommandCenterStudent | null;
  activeAction: BalcaoActionId;
  onActionChange: (actionId: BalcaoActionId) => void;
  onClose?: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
  aboveActions?: ReactNode;
  children: ReactNode;
};

export function CommandCenterShell({
  variant,
  student,
  activeAction,
  onActionChange,
  onClose,
  leading,
  trailing,
  aboveActions,
  children,
}: Props) {
  const action = getBalcaoAction(activeAction);
  const header = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {leading}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                KLASSE Command Center
              </p>
            </div>
            <h1 className="mt-1 truncate text-lg font-black text-slate-900">
              {student?.label || (activeAction === "enrollment" ? "Nova matrícula" : "Atendimento")}
            </h1>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {student?.subtitle || (student || activeAction === "enrollment"
                ? action.description
                : "Pesquise um aluno para iniciar um atendimento.")}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {trailing}
          {variant === "modal" && onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label="Fechar Command Center"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {aboveActions}

      <CommandCenterActionBar
        value={activeAction}
        onChange={onActionChange}
        label={student ? "Atendimento" : "Iniciar"}
        hasStudent={Boolean(student)}
      />
    </>
  );

  if (variant === "modal") {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-2 backdrop-blur-sm sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-label={`KLASSE Command Center — ${student?.label || "Atendimento"}`}
      >
        <button
          type="button"
          className="absolute inset-0 cursor-default"
          onClick={onClose}
          aria-label="Fechar Command Center"
        />
        <div className="relative flex h-[94vh] w-[98vw] max-w-[1540px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <header className="flex shrink-0 flex-col gap-3 border-b border-slate-100 bg-white px-4 py-3 sm:px-6 sm:py-4">
            {header}
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60">
            <div className="mx-auto min-h-full w-full max-w-[1440px] p-4 sm:p-6">
              {children}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3">
          {header}
        </div>
      </header>
      <main className="mx-auto mt-5 w-full max-w-[1600px] px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

export default CommandCenterShell;
