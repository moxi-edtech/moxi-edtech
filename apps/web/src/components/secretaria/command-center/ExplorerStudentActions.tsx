"use client";

import { useEffect, useRef, useState } from "react";
import { getBalcaoAction } from "@/lib/balcao/action-registry";
import {
  EXPLORER_STUDENT_ACTION_IDS, type ExplorerActionId,
} from "@/lib/command-center/student-capabilities";

type Reply = { ok: boolean; error?: string; actions?: Record<ExplorerActionId, boolean> };

export function ExplorerStudentActions({
  escolaId, alunoId, alunoNome, onAction,
}: {
  escolaId: string; alunoId: string; alunoNome: string;
  onAction: (action: ExplorerActionId) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [reply, setReply] = useState<Reply | null>(null);
  const [loading, setLoading] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function toggle() {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    setReply(null);
    setLoading(true);
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    try {
      const response = await fetch(
        `/api/escolas/${encodeURIComponent(escolaId)}/command-center/student-capabilities?alunoId=${encodeURIComponent(alunoId)}`,
        { signal: abort.signal, cache: "no-store", credentials: "same-origin" },
      );
      if (abort.signal.aborted) return;
      const body = (await response.json().catch(() => null)) as Reply | null;
      setReply(response.ok && body?.ok ? body : { ok: false,
        error: body?.error || "Não foi possível verificar as permissões. Tente novamente." });
    } catch {
      if (!abort.signal.aborted) setReply({
        ok: false, error: "Não foi possível verificar as permissões. Tente novamente.",
      });
    } finally { if (!abort.signal.aborted) setLoading(false); }
  }

  return (
    <div className="min-w-0 shrink-0 text-right">
      <button type="button" onClick={() => void toggle()} aria-expanded={expanded}
        aria-label={`Ações de ${alunoNome}`}
        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-700">
        {expanded ? "Fechar" : "Ações"}
      </button>
      {expanded && (
        <div role="group" aria-label={`Operações do aluno ${alunoNome}`}
          className="mt-2 flex max-w-72 flex-wrap justify-end gap-2">
          {loading && <p role="status" className="text-xs text-slate-600">A verificar permissões…</p>}
          {!loading && (!reply?.ok || !reply.actions) && (
            <p role="alert" className="text-xs text-rose-700">
              {reply?.error || "As permissões não estão disponíveis."}
            </p>
          )}
          {!loading && reply?.ok && reply.actions &&
            EXPLORER_STUDENT_ACTION_IDS.map((id) => {
              const available = reply.actions?.[id] === true;
              const action = getBalcaoAction(id);
              return (
                <button type="button" key={id} disabled={!available}
                  title={available ? action.description : "Sem permissão neste perfil"}
                  aria-label={available ? `Abrir ${action.label}` : `${action.label}: sem permissão`}
                  onClick={() => onAction(id)}
                  className="rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">
                  {action.shortLabel}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
