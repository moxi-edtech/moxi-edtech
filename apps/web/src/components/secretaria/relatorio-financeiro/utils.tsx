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
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center">
          <p className="text-sm font-semibold text-slate-700">{title}</p>
          <p className="mt-1 text-sm text-slate-500">{message}</p>
          <Link
            href={ctaHref}
            className="mt-3 inline-flex rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            {ctaLabel}
          </Link>
        </div>
      </td>
    </tr>
  );
}
