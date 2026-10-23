"use client";

import { useEffect, useRef, useState } from "react";
import { getBalcaoAction } from "@/lib/balcao/action-registry";
import {
  EXPLORER_STUDENT_ACTION_IDS, type ExplorerActionId,
} from "@/lib/command-center/student-capabilities";

type Reply = { ok: boolean; error?: string; actions?: Record<ExplorerActionId, boolean> };

/** Native modal dialog keeps six operations in the viewport even at 150% zoom.
 * The browser provides keyboard focus containment; Esc closes without
 * navigating, and the opener receives focus again.
 */
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
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (expanded && !dialog.open) dialog.showModal();
    if (!expanded && dialog.open) {
      dialog.close();
      openerRef.current?.focus({ preventScroll: true });
    }
  }, [expanded]);
  useEffect(() => () => {
    controller.current?.abort();
    if (dialogRef.current?.open) dialogRef.current.close();
  }, []);

  async function toggle() {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    setReply(null);
    setLoading(true);
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    try {
      const locationSearch = new URLSearchParams(window.location.search);
      const polo = locationSearch.get("poloId") ?? locationSearch.get("polo_id");
      const params = new URLSearchParams({ alunoId });
      if (polo) params.set("poloId", polo);
      const response = await fetch(
        `/api/escolas/${encodeURIComponent(escolaId)}/command-center/student-capabilities?${params}`,
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
    } finally {
      if (!abort.signal.aborted) setLoading(false);
    }
  }

  return (
    <div className="shrink-0">
      <button ref={openerRef} type="button" onClick={() => void toggle()} aria-haspopup="dialog"
        aria-expanded={expanded} aria-label={`Ações de ${alunoNome}`}
        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-700">
        Ações
      </button>
      <dialog ref={dialogRef} aria-label={`Operações de ${alunoNome}`}
        onCancel={(event) => { event.preventDefault(); setExpanded(false); }}
        className="w-[min(94vw,450px)] max-h-[min(85dvh,660px)] rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl backdrop:bg-slate-900/40">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Operações do aluno</h3>
            <p className="mt-1 break-words text-sm text-slate-700">{alunoNome}</p>
          </div>
          <button type="button" onClick={() => setExpanded(false)}
            aria-label={`Fechar ações de ${alunoNome}`}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-emerald-700">
            Fechar
          </button>
        </div>
        {loading && <p role="status" className="text-sm text-slate-700">A verificar permissões…</p>}
        {!loading && (!reply?.ok || !reply.actions) && (
          <p role="alert" className="text-sm text-rose-700">
            {reply?.error || "As permissões não estão disponíveis."}
          </p>
        )}
        {!loading && reply?.ok && reply.actions && (
          <div role="group" aria-label="Ações autorizadas"
            className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {EXPLORER_STUDENT_ACTION_IDS.map((id) => {
              const available = reply.actions?.[id] === true;
              const action = getBalcaoAction(id);
              return (
                <button type="button" key={id} disabled={!available}
                  title={available ? action.description : "Sem permissão neste perfil"}
                  aria-label={available ? `Abrir ${action.label}` : `${action.label}: sem permissão`}
                  onClick={() => onAction(id)}
                  className="rounded-lg border border-slate-200 px-3 py-3 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">
                  {action.label}
                </button>
              );
            })}
          </div>
        )}
        <p className="mt-4 text-xs text-slate-600">
          Cada módulo confirma novamente a permissão e a situação do aluno antes de guardar alterações.
        </p>
      </dialog>
    </div>
  );
}
