"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, X } from "lucide-react";
import TransferForm from "@/components/secretaria/TransferForm";

type Session = { id: string; ano_letivo?: string | number | null; nome?: string | null; data_inicio?: string | null };

export function RetificarMatriculaAction({ matriculaId, turmaId, anoLetivo, anoLetivoId, canRectifyClass, onChanged }: { matriculaId: string; turmaId: string; anoLetivo: number; anoLetivoId?: string | null; canRectifyClass: boolean; onChanged?: () => void }) {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Reuse the already validated current-year ID. Only legacy callers need a lookup.
    if (!open || anoLetivoId) return;
    let active = true;
    fetch("/api/secretaria/school-sessions")
      .then((response) => response.json())
      .then((data) => {
        const sessions: Session[] = Array.isArray(data) ? data : (data.data ?? data.items ?? data.sessions ?? []);
        const selected = sessions.find((session) => Number(session.ano_letivo ?? String(session.nome ?? session.data_inicio ?? "").match(/20\d{2}/)?.[0]) === anoLetivo);
        if (active) setSessionId(selected?.id ?? null);
      })
      .catch(() => { if (active) setSessionId(null); });
    return () => { active = false; };
  }, [open, anoLetivo, anoLetivoId]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500">
        <ArrowUpDown size={16} /> Corrigir classe
      </button>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="retificar-matricula-title" className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 id="retificar-matricula-title" className="text-xl font-bold text-slate-900">Corrigir classe ou turma</h2>
              <button type="button" aria-label="Fechar" onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-slate-100"><X size={20} /></button>
            </div>
            <TransferForm matriculaId={matriculaId} currentTurmaId={turmaId} anoLetivo={anoLetivo} anoLetivoId={anoLetivoId ?? sessionId} canRectifyClass={canRectifyClass} defaultRectifyClass={canRectifyClass} onSuccess={() => { setOpen(false); onChanged?.(); router.refresh(); }} />
          </section>
        </div>
      )}
    </>
  );
}
