import React from "react";
import Link from "next/link";

export const kwanza = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
  maximumFractionDigits: 0,
});

export function formatMonthRef(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-PT", {
    month: "short",
    year: "numeric",
  }).replace(".", "").replace(" de ", "/");
}

export function normalizeMonthKey(value: string) {
  return value.slice(0, 7);
}

export function EducationalEmptyState({
  title,
  message,
  ctaHref,
  ctaLabel,
  colSpan,
}: {
  title: string;
  message: string;
  ctaHref: string;
  ctaLabel: string;
  colSpan: number;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-6">
        <div className="rounded-xl border border-dashed border-border bg-muted px-4 py-5 text-center">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          <Link
            href={ctaHref}
            className="mt-3 inline-flex rounded-xl bg-klasse-gold px-3 py-2 text-xs font-semibold text-klasse-gold-900 hover:brightness-95"
          >
            {ctaLabel}
          </Link>
        </div>
      </td>
    </tr>
  );
}
