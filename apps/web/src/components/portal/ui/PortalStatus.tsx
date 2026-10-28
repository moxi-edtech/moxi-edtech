import type { ReactNode } from "react";

type StatusTone = "neutral" | "pending" | "success" | "danger";

const tones: Record<StatusTone, string> = {
  neutral: "border-border bg-muted text-foreground",
  pending: "border-amber-400/50 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  success: "border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  danger: "border-destructive/40 bg-destructive/10 text-destructive",
};

/** Purely presentational status: do not infer settled payments from it. */
export function PortalStatus({
  tone = "neutral", children, className = "",
}: {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return <span className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-medium leading-4 ${tones[tone]} ${className}`}>{children}</span>;
}
