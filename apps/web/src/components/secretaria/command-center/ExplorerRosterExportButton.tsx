"use client";

import { useEffect, useRef, useState } from "react";
import type { RosterFilter, RosterSort } from "@/hooks/useExplorerRoster";
import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context";

type ErrorReply = { error?: string };

export function ExplorerRosterExportButton({
  escolaId, entityId, type, yearId, query, filter, sort,
}: {
  escolaId: string;
  entityId: string;
  type: "turma" | "classe";
  yearId: string | null;
  query: string;
  filter: RosterFilter;
  sort: RosterSort;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function download() {
    if (busy) return;
    if (query.trim().length === 1) {
      setError("Introduza pelo menos dois caracteres ou limpe a pesquisa.");
      return;
    }
    if (!window.confirm(
      "Esta exportação contém dados de alunos e será auditada. Confirma que precisa da lista para atendimento autorizado da escola?",
    )) return;
    setBusy(true);
    setError(null);
    controller.current?.abort();
    const signal = new AbortController();
    controller.current = signal;
    try {
      const params = new URLSearchParams({ type, entityId, q: query.trim(), filter, sort });
      if (yearId) params.set(ACADEMIC_YEAR_PARAM, yearId);
      const polo = new URLSearchParams(window.location.search).get("poloId") ??
        new URLSearchParams(window.location.search).get("polo_id");
      if (polo) params.set("poloId", polo);
      const response = await fetch(
        `/api/escolas/${encodeURIComponent(escolaId)}/command-center/roster/export?${params}`,
        { method: "GET", signal: signal.signal, cache: "no-store", credentials: "same-origin" },
      );
      if (!response.ok) {
        const details = (await response.json().catch(() => null)) as ErrorReply | null;
        throw new Error(details?.error ?? "Esta lista não pode ser exportada neste momento.");
      }
      const file = await response.blob();
      if (signal.signal.aborted) return;
      const href = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = "lista_alunos.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (cause) {
      if (!signal.signal.aborted) setError(cause instanceof Error ? cause.message :
        "A exportação falhou. Confirme a autorização.");
    } finally {
      if (!signal.signal.aborted) setBusy(false);
    }
  }
  return (
    <div className="min-w-0">
      <button type="button" onClick={() => void download()} disabled={busy}
        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:border-emerald-400 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-50">
        {busy ? "A validar exportação…" : "Exportar lista"}
      </button>
      <p className="mt-1 text-[11px] text-slate-600">Exige autorização por escola e auditoria registada.</p>
      {error && <p role="alert" className="mt-1 text-xs text-rose-700">{error}</p>}
    </div>
  );
}
