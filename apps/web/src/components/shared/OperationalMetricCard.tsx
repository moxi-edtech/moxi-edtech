"use client";

import Link from "next/link";
import type { MouseEventHandler } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { operationalCardTone, operationalCardIconClasses } from "@/lib/ui/operational-card-tone";

type Props = {
  label: string;
  value?: number | string | null;
  icon: LucideIcon;
  needsAttention?: boolean;
  /** Context already visible in the section heading; retained in the accessible name. */
  description?: string;
} & (
  | { href: string; onClick?: never; dialogOpen?: never }
  | { href?: never; onClick: MouseEventHandler<HTMLButtonElement>; dialogOpen: boolean }
  | { href?: never; onClick?: never; dialogOpen?: never }
);

/** One visual contract for daily counters and school overview metrics. */
export function OperationalMetricCard({
  label, value, icon: Icon, needsAttention = false, description, href, onClick, dialogOpen,
}: Props) {
  const unavailable = value == null || (typeof value === "number" && !Number.isFinite(value));
  const tone = operationalCardTone({ unavailable, needsAttention });
  const actionable = Boolean(href || onClick);
  const className = "group operations-metric-card operations-metric-size rounded-xl border border-border bg-card p-4 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const content = (
    <>
      <span className="operations-metric-header text-sm font-medium leading-5 text-muted-foreground">
        <span className="min-w-0 break-words">{label}</span>
        <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${operationalCardIconClasses[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </span>
      <span className="operations-metric-value">
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className={`break-all text-2xl font-semibold tabular-nums ${tone === "attention" ? "text-amber-700 dark:text-amber-300" : "text-foreground"}`}>{unavailable ? "—" : typeof value === "number" ? value.toLocaleString("pt-AO") : value}</span>
          {unavailable && <span className="text-xs leading-4 text-muted-foreground">Dados indisponíveis</span>}
        </span>
        {actionable && <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />}
      </span>
      {description && !unavailable && <span className="sr-only">{description}</span>}
    </>
  );
  if (onClick) return <button type="button" onClick={onClick} aria-haspopup="dialog" aria-expanded={dialogOpen} className={className + " hover:border-ring"}>{content}</button>;
  if (href) return <Link href={href} className={className + " hover:border-ring"}>{content}</Link>;
  return <div className={className}>{content}</div>;
}

export function OperationalMetricSkeleton() {
  return <div aria-hidden="true" className="operations-metric-size motion-safe:animate-pulse rounded-xl border border-border bg-card" />;
}
