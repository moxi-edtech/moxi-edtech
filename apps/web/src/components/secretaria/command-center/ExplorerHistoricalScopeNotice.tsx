"use client";

import React from "react";

/** Historic views are read-only. Operational roster RPCs deliberately reject
 * CLOSED years, so do not offer controls that would always return 409. */
export function ExplorerHistoricalScopeNotice({ roster = false }: { roster?: boolean }) {
  return (
    <p role="status" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700">
      <strong>Histórico · apenas consulta.</strong> Os vínculos apresentados dizem respeito ao ano selecionado.
      {roster ? " A pesquisa operacional, os filtros de pendências e a exportação estão indisponíveis neste ano; utilize a listagem histórica por páginas." : null}
    </p>
  );
}
