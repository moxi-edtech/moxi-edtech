"use client";

import type { ReactNode } from "react";
import { ArrowLeftRight, Keyboard, X } from "lucide-react";

import { CommandCenterActionBar } from "@/components/secretaria/command-center/CommandCenterActionBar";
import { type BalcaoActionId } from "@/lib/balcao/action-registry";

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
  pendingActions?: ReadonlyArray<BalcaoActionId>;
  shortcuts?: { enabled: boolean; setEnabled: (enabled: boolean) => void };
  onSwitchStudent?: () => void;
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
  pendingActions = [],
  shortcuts,
  onSwitchStudent,
  onClose,
  leading,
  trailing,
  aboveActions,
  children,
}: Props) {
  const studentSubtitle = student?.subtitle?.trim();
  const header = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {leading}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-foreground">
              {activeAction === "enrollment" ? "Nova matrícula" : activeAction === "admissions" ? "Admissões" : (student?.label || "Atendimento")}
            </h1>
            {(activeAction !== "enrollment" && activeAction !== "admissions" && studentSubtitle) ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{studentSubtitle}</p>
            ) : !student && activeAction !== "enrollment" && activeAction !== "admissions" ? (
              <p className="mt-0.5 text-xs text-muted-foreground">Selecione um aluno</p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {shortcuts && (
            <button type="button" onClick={() => shortcuts.setEnabled(!shortcuts.enabled)}
              aria-pressed={shortcuts.enabled}
              aria-label={shortcuts.enabled ? "Desativar atalhos do Balcão" : "Ativar atalhos do Balcão"}
              title="Ctrl+Alt+Shift+F: pesquisar aluno · Ctrl+Alt+Shift+T: trocar aluno"
              className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-medium text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber">
              <Keyboard className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Atalhos {shortcuts.enabled ? "ligados" : "desligados"}</span>
              <span className="sm:hidden">Atalhos</span>
            </button>
          )}
          {student && activeAction !== "enrollment" && activeAction !== "admissions" && onSwitchStudent ? (
            <button
              type="button"
              onClick={onSwitchStudent}
              className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-bold text-foreground transition hover:border-amber hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
              aria-label={`Trocar aluno em atendimento: ${student.label}`}
            >
              <ArrowLeftRight className="h-4 w-4" />
              <span className="hidden sm:inline">Trocar aluno</span>
              <span className="sm:hidden">Trocar</span>
            </button>
          ) : null}
          {trailing}
          {variant === "modal" && onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Fechar central de atendimento"
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
        label={activeAction === "enrollment" ? "Novo atendimento" : activeAction === "admissions" ? "Candidaturas" : student ? "Atendimento" : "Iniciar"}
        hasStudent={Boolean(student)}
        pendingActions={pendingActions}
      />
    </>
  );

  if (variant === "modal") {
    return (
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-label={`KLASSE · Central de atendimento — ${activeAction === "enrollment" ? "Nova matrícula" : activeAction === "admissions" ? "Admissões" : student?.label || "Atendimento"}`}
      >
        <button
          type="button"
          className="absolute inset-0 cursor-default"
          onClick={onClose}
          aria-label="Fechar central de atendimento"
        />
        <div className="relative flex h-[min(94dvh,calc(100dvh-1rem))] w-full max-w-[1540px] min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
          <header className="flex shrink-0 flex-col gap-3 border-b border-border bg-card px-4 py-3 sm:px-6 sm:py-4">
            {header}
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto bg-muted/60">
            <div className="mx-auto min-h-full w-full max-w-[1440px] px-3 py-4 sm:px-5 sm:py-6 xl:px-8">
              {children}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 bg-muted pb-6 sm:pb-8">
      <header className="relative z-20 border-b border-border bg-card/90 px-3 py-3 backdrop-blur sm:px-5 lg:px-6 2xl:px-8">
        <div className="mx-auto flex w-full max-w-[1440px] min-w-0 flex-col gap-3">
          {header}
        </div>
      </header>
      <main className="mx-auto mt-4 w-full max-w-[1440px] min-w-0 px-3 sm:mt-5 sm:px-5 lg:px-6 2xl:px-8">
        {children}
      </main>
    </div>
  );
}

export default CommandCenterShell;
