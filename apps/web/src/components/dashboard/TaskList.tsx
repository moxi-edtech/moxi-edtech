"use client";

import * as React from "react";


import { useState } from "react";
import { AlertCircle, Check, UserCheck, X } from "lucide-react";
import { EstadoVazio } from "@/components/harmonia";

export type DashboardTaskItem = {
  id: string;
  created_at: string;
  aluno: { nome: string };
  turma: { nome: string };
};

type TaskAction = (item: DashboardTaskItem) => Promise<void>;

/**
 * Presentation-only task list. No default approval/rejection action exists:
 * a caller must provide a server-authorized, audited handler for each action.
 * The current Secretaria dashboard does not mount this component.
 */
export function TaskList({
  items,
  onApprove,
  onReject,
}: {
  items: DashboardTaskItem[];
  onApprove?: TaskAction;
  onReject?: TaskAction;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {items.length === 0 ? (
        <div className="p-6"><EstadoVazio tipo="notificacoes.nenhuma" /></div>
      ) : (
        items.map((item) => (
          <TaskItem
            key={item.id}
            item={item}
            onApprove={onApprove}
            onReject={onReject}
          />
        ))
      )}
    </div>
  );
}

function TaskItem({ item, onApprove, onReject }: {
  item: DashboardTaskItem;
  onApprove?: TaskAction;
  onReject?: TaskAction;
}) {
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const execute = async (kind: "approve" | "reject", handler: TaskAction) => {
    if (pending) return;
    setPending(kind);
    setActionError(null);
    try {
      // Only a caller can supply an authenticated endpoint/RPC. Never infer an
      // operation from a task ID or claim success before the server confirms it.
      await handler(item);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Não foi possível concluir a ação. Tente novamente.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-4 border-b border-border p-4 transition-colors last:border-0 hover:bg-muted/50">
      <div aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <UserCheck className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">Matrícula registada</p>
          <span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString("pt-AO")}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Aluno <span className="font-medium text-foreground">{item.aluno.nome}</span> · {item.turma.nome}
        </p>
        {actionError && <p role="alert" className="mt-2 flex items-center gap-1 text-xs text-destructive"><AlertCircle className="h-4 w-4" aria-hidden="true" />{actionError}</p>}
      </div>
      {(onApprove || onReject) && (
        <div className="flex flex-wrap items-center gap-2" aria-busy={pending !== null}>
          {onApprove && (
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => void execute("approve", onApprove)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-klasse-green/30 bg-card px-3 text-sm font-semibold text-klasse-green transition-colors hover:bg-klasse-green/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 disabled:opacity-50"
              aria-label={`Aprovar matrícula de ${item.aluno.nome}`}
            >
              <Check className="h-4 w-4" aria-hidden="true" />{pending === "approve" ? "A aprovar…" : "Aprovar"}
            </button>
          )}
          {onReject && (
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => void execute("reject", onReject)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-destructive/30 bg-card px-3 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 disabled:opacity-50"
              aria-label={`Rejeitar matrícula de ${item.aluno.nome}`}
            >
              <X className="h-4 w-4" aria-hidden="true" />{pending === "reject" ? "A rejeitar…" : "Rejeitar"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
