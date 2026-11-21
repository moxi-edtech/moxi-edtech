import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, RefreshCw } from "lucide-react";

/** Shared presentation states for Professor resource card grids; no API coupling. */
export function ProfessorResourceGridSkeleton({
  label,
  count = 3,
}: {
  label: string;
  count?: number;
}) {
  return (
    <div role="status" aria-label={label} aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} aria-hidden="true" className="min-w-0 space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="h-9 w-9 rounded-xl bg-muted motion-safe:animate-pulse" />
              <div className="h-5 w-20 rounded-full bg-muted motion-safe:animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-4/5 rounded-full bg-muted motion-safe:animate-pulse" />
              <div className="h-3 w-full rounded-full bg-muted motion-safe:animate-pulse" />
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <div className="h-3 w-24 rounded-full bg-muted motion-safe:animate-pulse" />
              <div className="h-9 w-24 rounded-xl bg-muted motion-safe:animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProfessorResourceEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div role="status" className="rounded-xl border border-dashed border-border bg-card px-5 py-10 text-center sm:p-12">
      <div aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-klasse-green/10 text-klasse-green dark:text-emerald-300">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-3 text-base font-semibold text-foreground">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} className="klasse-portal-cta mt-4 inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function ProfessorResourceErrorState({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="rounded-xl border border-destructive/30 bg-card p-5 text-sm text-foreground sm:p-6">
      <div className="flex items-start gap-3">
        <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="min-w-0">
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 break-words text-muted-foreground">{description}</p>
          <button type="button" onClick={onRetry} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted">
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Tentar novamente
          </button>
        </div>
      </div>
    </div>
  );
}
