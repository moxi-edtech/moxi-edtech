"use client";

import React from "react";

/**
 * Five-explorer foundation: semantic, consistent density for operational totals.
 * A partial number is never presented as an exact total; unknown capacity is
 * never invented as zero. Design-only: no data loading or authorisation here.
 */
type MetricProps = {
  label: string;
  value: number | null;
  partial?: boolean;
  hint?: string;
};

export function ExplorerMetric({ label, value, partial = false, hint }: MetricProps) {
  const formatted = value === null ? "Não definida" : new Intl.NumberFormat("pt-AO").format(value);
  return (
    <dl className="min-w-0 space-y-0.5">
      <dt className="text-xs leading-snug text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums text-foreground" aria-label={
        value === null ? `${label}: não definida` : `${label}: ${formatted}${partial ? " ou mais, contagem parcial" : ""}`
      }>
        {formatted}{partial && value !== null ? <span aria-hidden="true">+</span> : null}
        {hint ? <span className="mt-1 block text-[11px] font-normal leading-snug text-muted-foreground">{hint}</span> : null}
      </dd>
    </dl>
  );
}
