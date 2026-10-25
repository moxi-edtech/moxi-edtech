"use client";

import React from "react";

/** Historic views are read-only. Operational roster RPCs deliberately reject
 * CLOSED years, so do not offer controls that would always return 409. */
export function ExplorerHistoricalScopeNotice({ roster = false }: { roster?: boolean }) {
  return (
    <p role="status" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700">
      <strong>Histórico · apenas consulta.</strong> Informações do ano selecionado.
      {roster ? " Para ver os alunos, navegue pelas páginas da lista. Pesquisa e exportação não estão disponíveis neste ano." : null}
    </p>
  );
}
