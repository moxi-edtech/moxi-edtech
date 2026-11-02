"use client";

import React from "react";

/** Historic views are read-only. Operational roster RPCs deliberately reject
 * CLOSED years, so do not offer controls that would always return 409. */
export function ExplorerHistoricalScopeNotice({ roster = false }: { roster?: boolean }) {
  return (
    <p role="status" className="rounded-xl border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
      <strong>Histórico · só consulta</strong>
      {roster ? " · Pesquisa e exportação indisponíveis" : null}
    </p>
  );
}
